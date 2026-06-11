using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SocialSense.Configuration;
using SocialSense.Data;
using SocialSense.DTOs.Content;
using SocialSense.Models;

namespace SocialSense.Services;

public class ContentGeneratorService : IContentGeneratorService
{
    private readonly AppDbContext _db;
    private readonly HttpClient _client;
    private readonly ContentGeneratorOptions _options;
    private readonly IContentHistoryService _historyService;
    private readonly IImageGenerationClient _imageClient;
    private readonly GeminiApiKeyPool _keyPool;
    private readonly ILogger<ContentGeneratorService> _logger;

    public ContentGeneratorService(
        AppDbContext db,
        HttpClient client,
        IOptions<ContentGeneratorOptions> options,
        IContentHistoryService historyService,
        IImageGenerationClient imageClient,
        GeminiApiKeyPool keyPool,
        ILogger<ContentGeneratorService> logger)
    {
        _db = db;
        _client = client;
        _options = options.Value;
        _historyService = historyService;
        _imageClient = imageClient;
        _keyPool = keyPool;
        _logger = logger;
    }

    // ─── Unified response wrapper cho GenerateAsync (1 API call) ───────────────
    private class UnifiedGenerateResult
    {
        public string SelectedTrendId { get; set; } = string.Empty;
        public string SmartMatchReason { get; set; } = string.Empty;
        public List<GeneratedContentItem> Items { get; set; } = new();
    }

    public async Task<GenerateContentResponse?> GenerateAsync(GenerateContentRequest request, CancellationToken ct)
    {
        var persona = await ResolvePersonaAsync(request.UserId, request.Language, ct);
        var outputCount = Math.Clamp(request.OutputCount, 1, 3);

        // ── PersonaDriven mode: không cần trend, AI tự suy luận từ persona ───
        if (request.Mode == ContentMode.PersonaDriven)
        {
            return await GeneratePersonaDrivenAsync(request, persona, outputCount, ct);
        }

        // ── Bước 1: Lấy dữ liệu từ DB (không tốn quota) ──────────────────────
        List<Trend> candidateTrends;
        Trend? preselectedTrend = null;

        if (!request.TrendId.HasValue || request.TrendId.Value == 0)
        {
            candidateTrends = await _db.Trends.AsNoTracking()
                .OrderByDescending(t => t.HotLevel)
                .ThenByDescending(t => t.CreatedAt)
                .Take(10)
                .ToListAsync(ct);

            if (candidateTrends.Count == 0)
            {
                _logger.LogWarning("GenerateAsync failed: No trends found in Database.");
                return null;
            }
        }
        else
        {
            preselectedTrend = await _db.Trends.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == request.TrendId.Value, ct);

            if (preselectedTrend == null) return null;
            candidateTrends = new List<Trend> { preselectedTrend };
        }

        // Giới hạn RawContent để tránh token bloat (dùng config MaxKnowledgeItems)
        var knowledges = await _db.KnowledgeItems.AsNoTracking()
            .OrderByDescending(k => k.CreatedAt)
            .Take(_options.MaxKnowledgeItems)
            .ToListAsync(ct);

        var tags = preselectedTrend != null
            ? await GetTagsAsync(preselectedTrend.Id, ct)
            : new List<string>();

        // ── Bước 2: Fallback nếu AI bị tắt hoặc không có key ─────────────────
        if (!_options.Enabled || !_keyPool.HasKeys)
        {
            var trend = preselectedTrend ?? candidateTrends[0];
            if (tags.Count == 0) tags = await GetTagsAsync(trend.Id, ct);
            var fb = BuildFallback(trend, tags, persona, outputCount, request.TargetPlatforms);
            fb.SelectedTrendTitle = trend.Title;
            fb.SmartMatchReason = "[Fallback] AI bị tắt hoặc không có API key.";
            return fb;
        }

        // ── Bước 3: 1 API call duy nhất làm tất cả ───────────────────────────
        var prompt = BuildUnifiedGeneratePrompt(
            candidateTrends, preselectedTrend, knowledges, persona, outputCount, request.TargetPlatforms, request.UserInstruction);

        Func<HttpRequestMessage> requestFactory = () =>
            BuildRequest(prompt, _options.Temperature, _options.MaxOutputTokens);

        Trend? selectedTrend = preselectedTrend;
        string? smartMatchReason = null;
        List<GeneratedContentItem> items = new();

        try
        {
            using var response = await SendWithRetryAsync(requestFactory, ct);
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Gemini unified generate failed: {StatusCode}. Response: {ErrorBody}", response.StatusCode, errorBody);
            }
            else
            {
                await using var stream = await response.Content.ReadAsStreamAsync(ct);
                using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
                var text = ExtractText(doc);

                if (!string.IsNullOrWhiteSpace(text))
                {
                    var cleaned = StripCodeFence(text);
                    var result = ParseUnifiedGenerateResult(cleaned);

                    if (result != null)
                    {
                        // Resolve trend từ selectedTrendId trả về
                        if (preselectedTrend == null && int.TryParse(result.SelectedTrendId, out var parsedId))
                        {
                            selectedTrend = candidateTrends.FirstOrDefault(t => t.Id == parsedId);
                        }
                        smartMatchReason = result.SmartMatchReason;
                        items = result.Items
                            .Select(item => SanitizeContentItem(item, persona.Language))
                            .Take(outputCount)
                            .ToList();
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gemini unified content generation error.");
        }

        // Fallback nếu AI không trả về kết quả hợp lệ
        if (selectedTrend == null)
        {
            selectedTrend = candidateTrends[0];
            smartMatchReason = "[Fallback] Tự động chọn xu hướng nổi bật nhất.";
        }

        if (tags.Count == 0) tags = await GetTagsAsync(selectedTrend.Id, ct);

        if (items.Count == 0)
        {
            var fb = BuildFallback(selectedTrend, tags, persona, outputCount, request.TargetPlatforms);
            fb.SelectedTrendTitle = selectedTrend.Title;
            fb.SmartMatchReason = smartMatchReason;
            return fb;
        }

        // ── Bước 4: Tạo ảnh nếu được yêu cầu (dùng bannerImagePrompt có sẵn) ─
        string? mediaUrl = null;
        if (request.GenerateImage && items.Count > 0)
        {
            try
            {
                // Dùng bannerImagePrompt đã được AI generate trong cùng 1 call, không cần call thêm
                var imagePrompt = items[0].BannerImagePrompt ?? selectedTrend.Title;
                mediaUrl = await _imageClient.GenerateImageAsync(imagePrompt, ct);
                if (!string.IsNullOrWhiteSpace(mediaUrl))
                {
                    foreach (var item in items) item.MediaUrl = mediaUrl;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to generate image (Non-blocking)");
            }
        }

        // ── Bước 5: Lưu history và trừ quota (chỉ khi AI thật thành công) ──────
        try
        {
            var serialized = JsonSerializer.Serialize(items);
            if (mediaUrl == null)
                await _historyService.SaveHistoryAsync(request.UserId, selectedTrend.Id, serialized, ct);
            else
                await _historyService.SaveHistoryAsync(request.UserId, selectedTrend.Id, serialized, mediaUrl, ct);

            // Trừ quota: bỏ qua nếu DailyQuotaLimit = -1 (unlimited / Enterprise)
            await _db.Database.ExecuteSqlRawAsync(
                "UPDATE Users SET RemainingQuota = RemainingQuota - 1 WHERE Id = {0} AND RemainingQuota > 0 AND DailyQuotaLimit != -1",
                new object[] { request.UserId }, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save history or update quota for user {UserId} (Non-blocking)", request.UserId);
        }

        return new GenerateContentResponse
        {
            Items = items,
            SelectedTrendTitle = selectedTrend.Title,
            SmartMatchReason = smartMatchReason
        };
    }

    // ── PersonaDriven: sinh content thuần từ persona, không cần trend ─────────
    private async Task<GenerateContentResponse?> GeneratePersonaDrivenAsync(
        GenerateContentRequest request,
        PersonaProfile persona,
        int outputCount,
        CancellationToken ct)
    {
        // Vẫn load knowledge base để AI có thể dùng thông tin sản phẩm/thương hiệu
        var knowledges = await _db.KnowledgeItems.AsNoTracking()
            .OrderByDescending(k => k.CreatedAt)
            .Take(_options.MaxKnowledgeItems)
            .ToListAsync(ct);

        if (!_options.Enabled || !_keyPool.HasKeys)
        {
            return new GenerateContentResponse
            {
                Items = new List<GeneratedContentItem>(),
                SelectedTrendTitle = null,
                SmartMatchReason = "[Fallback] AI bị tắt hoặc không có API key."
            };
        }

        var prompt = BuildPersonaDrivenPrompt(knowledges, persona, outputCount, request.TargetPlatforms, request.UserInstruction);
        Func<HttpRequestMessage> requestFactory = () => BuildRequest(prompt, _options.Temperature, _options.MaxOutputTokens);

        List<GeneratedContentItem> items = new();
        string smartMatchReason = "Nội dung được sinh thuần từ persona — không phụ thuộc trend.";

        try
        {
            using var response = await SendWithRetryAsync(requestFactory, ct);
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("PersonaDriven generate failed: {StatusCode}. Response: {ErrorBody}", response.StatusCode, errorBody);
            }
            else
            {
                await using var stream = await response.Content.ReadAsStreamAsync(ct);
                using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
                var text = ExtractText(doc);
                if (!string.IsNullOrWhiteSpace(text))
                {
                    var cleaned = StripCodeFence(text);
                    _logger.LogDebug("PersonaDriven raw AI text (first 500): {Text}", text.Length > 500 ? text[..500] : text);
                    // PersonaDriven trả về mảng items trực tiếp
                    try
                    {
                        var parsed = JsonSerializer.Deserialize<List<GeneratedContentItem>>(cleaned,
                            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        if (parsed != null)
                            items = parsed.Select(i => SanitizeContentItem(i, persona.Language)).Take(outputCount).ToList();
                    }
                    catch (JsonException)
                    {
                        // Thử parse dạng object có field "items" (fallback)
                        try
                        {
                            var wrapper = JsonSerializer.Deserialize<UnifiedGenerateResult>(cleaned,
                                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                            if (wrapper?.Items != null)
                            {
                                items = wrapper.Items.Select(i => SanitizeContentItem(i, persona.Language)).Take(outputCount).ToList();
                                if (!string.IsNullOrWhiteSpace(wrapper.SmartMatchReason))
                                    smartMatchReason = wrapper.SmartMatchReason;
                            }
                        }
                        catch (JsonException ex2)
                        {
                            _logger.LogError(ex2, "PersonaDriven: failed to parse response. Raw text: {Raw}", text);
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "PersonaDriven content generation error.");
        }

        // Lưu history (không có trendId — dùng null), chỉ trừ quota khi AI thật thành công
        try
        {
            if (items.Count > 0)
            {
                var serialized = JsonSerializer.Serialize(items);
                await _historyService.SaveHistoryAsync(request.UserId, null, serialized, ct);
                // Trừ quota: bỏ qua nếu DailyQuotaLimit = -1 (unlimited / Enterprise)
                await _db.Database.ExecuteSqlRawAsync(
                    "UPDATE Users SET RemainingQuota = RemainingQuota - 1 WHERE Id = {0} AND RemainingQuota > 0 AND DailyQuotaLimit != -1",
                    new object[] { request.UserId }, ct);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save PersonaDriven history for user {UserId}", request.UserId);
        }

        return new GenerateContentResponse
        {
            Items = items,
            SelectedTrendTitle = null,
            SmartMatchReason = smartMatchReason
        };
    }

    /// <summary>
    /// Prompt "playbook tâm lý" — AI đọc persona, tự suy luận ngành nghề,
    /// sản phẩm, pain point của khách hàng rồi áp dụng đúng công thức tâm lý.
    /// Không phụ thuộc trend — phù hợp BĐS, bán hàng, dịch vụ, v.v.
    /// </summary>
    private string BuildPersonaDrivenPrompt(
        List<KnowledgeItem> knowledges,
        PersonaProfile persona,
        int outputCount,
        List<string>? targetPlatforms,
        string? userInstruction = null)
    {
        List<string> platformsToUse;
        if (_options.MultiPlatformEnabled && targetPlatforms != null && targetPlatforms.Count > 0)
            platformsToUse = targetPlatforms;
        else if (persona.PlatformPreferences.Count > 0)
            platformsToUse = persona.PlatformPreferences;
        else
            platformsToUse = new List<string> { "General" };

        var platformListStr = string.Join(", ", platformsToUse);
        var audienceStr = persona.TargetAudience.Count > 0 ? string.Join(", ", persona.TargetAudience) : "General public";
        var formatsStr = persona.ContentFormats.Count > 0 ? string.Join(", ", persona.ContentFormats) : "Standard posts";
        var negativesStr = persona.NegativeConstraints.Count > 0 ? string.Join(", ", persona.NegativeConstraints) : "None";

        var knowledgeSection = knowledges.Count > 0
            ? string.Join("\n", knowledges.Select((k, i) =>
                $"[K{i + 1}] {k.Title}: {(k.RawContent?.Length > _options.MaxKnowledgeContentLength ? k.RawContent[.._options.MaxKnowledgeContentLength] + "..." : k.RawContent)}"))
            : "No internal knowledge available.";

        // Xác định topic chính: ưu tiên UserInstruction, fallback về JobTitle/ngành
        var topicHint = !string.IsNullOrWhiteSpace(userInstruction)
            ? $"User's requested topic: {userInstruction.Trim()}"
            : $"Infer topic from Job Title: {persona.JobTitle}";

        var userInstructionSection = !string.IsNullOrWhiteSpace(userInstruction)
            ? $"\n⚡ USER INSTRUCTION (THIS DEFINES THE CONTENT TOPIC — highest priority):\n{userInstruction.Trim()}\nWrite content specifically about this topic. Do NOT redirect to a different industry.\n"
            : string.Empty;

        return $@"You are an expert social media copywriter. Create engaging content for the specified topic, written in the brand's voice.
Return ONLY a raw JSON array — no markdown, no explanation.
{userInstructionSection}

CONTENT TOPIC (what to write about):
{topicHint}
The content MUST stay on this topic. Do not substitute it with a different industry or subject.

BRAND VOICE (how to write — tone and style only):
Use the Brand Persona below to shape writing style, vocabulary, and audience targeting.
The persona defines HOW you write, not WHAT you write about.
- Job Title: {persona.JobTitle} — understand the writer's perspective
- Tone of Voice: {persona.ToneOfVoice} — match this writing style exactly
- Language: {persona.Language}
- Target Audience: {audienceStr} — write for these readers
- Preferred Formats: {formatsStr}
- Negative Constraints (avoid in style): {negativesStr}

PSYCHOLOGICAL TRIGGERS (apply based on the TOPIC above, not the job title):
- Insight Hook: surprising or counterintuitive fact about the topic
- FOMO / Urgency: time-sensitive angle relevant to the topic
- Social Proof: reference scale, adoption, or community around the topic
- Solution Frame: position the reader as someone who can benefit from this topic

Internal Knowledge Base (use ONLY if directly relevant to the content topic):
{knowledgeSection}

Target Platforms: [{platformListStr}] — one platform per item, vary platforms if multiple items.

Generate exactly {outputCount} content item(s).

Return ONLY this raw JSON array (no ```json wrapper, no object wrapper):
[
  {{
    ""platform"": ""platform name"",
    ""hook"": ""scroll-stopping first line about the content topic"",
    ""body"": ""engaging body content about the topic, under {_options.MaxBodyLength} chars"",
    ""cta"": ""clear call to action relevant to the topic"",
    ""hashtags"": [""tag1"", ""tag2""],
    ""bannerImagePrompt"": ""detailed English image prompt representing the content topic"",
    ""bestTimeToPost"": ""Vietnamese recommendation with reasoning""
  }}
]

RULES:
- Start response with [ and end with ] — nothing before or after
- body must be under {_options.MaxBodyLength} characters
- max {_options.MaxHashtags} hashtags per item
- Content topic MUST match the user instruction or job title context — never redirect to unrelated industry
- NO explanation, NO preamble, NO markdown — ONLY the JSON array";
    }

    private string BuildEndpoint()
    {
        var slot = _keyPool.GetNextSlot();
        var baseUrl = GetBaseUrl(slot.Provider, _options.Endpoint);
        return $"{baseUrl}/chat/completions";
    }

    private HttpRequestMessage BuildRequest(string prompt, double temperature, int maxTokens)
    {
        var slot = _keyPool.GetNextSlot();
        var baseUrl = GetBaseUrl(slot.Provider, _options.Endpoint);
        var url = $"{baseUrl}/chat/completions";
        var model = slot.ModelOverride ?? _options.Model;

        var body = new
        {
            model,
            messages = new[] { new { role = "user", content = prompt } },
            temperature,
            max_tokens = maxTokens
        };

        var msg = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(
                System.Text.Json.JsonSerializer.Serialize(body),
                Encoding.UTF8, "application/json")
        };
        msg.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", slot.Key);

        // OpenRouter yêu cầu thêm header này
        if (slot.Provider == "openrouter")
        {
            msg.Headers.TryAddWithoutValidation("HTTP-Referer", "https://socialsense.app");
            msg.Headers.TryAddWithoutValidation("X-Title", "SocialSense");
        }

        return msg;
    }

    private static string GetBaseUrl(string provider, string configEndpoint)
    {
        return provider?.ToLowerInvariant() switch
        {
            "groq"   => "https://api.groq.com/openai/v1",
            "openai" => "https://api.openai.com/v1",
            // Chỉ dùng Groq cho text generation — loại bỏ OpenRouter/HuggingFace
            _        => "https://api.groq.com/openai/v1"
        };
    }

    /// <summary>
    /// Prompt duy nhất thực hiện cả 3 việc trong 1 lần gọi:
    /// 1. Chọn trend phù hợp nhất với persona (nếu chưa có trendId)
    /// 2. Tìm và lồng ghép knowledge liên quan
    /// 3. Sinh nội dung hoàn chỉnh
    /// </summary>
    private string BuildUnifiedGeneratePrompt(
        List<Trend> candidateTrends,
        Trend? preselectedTrend,
        List<KnowledgeItem> knowledges,
        PersonaProfile persona,
        int outputCount,
        List<string>? targetPlatforms,
        string? userInstruction = null)
    {
        List<string> platformsToUse;
        if (_options.MultiPlatformEnabled && targetPlatforms != null && targetPlatforms.Count > 0)
            platformsToUse = targetPlatforms;
        else if (persona.PlatformPreferences.Count > 0)
            platformsToUse = persona.PlatformPreferences;
        else
            platformsToUse = new List<string> { "General" };

        var platformListStr = string.Join(", ", platformsToUse);
        var audienceStr = persona.TargetAudience.Count > 0 ? string.Join(", ", persona.TargetAudience) : "General public";
        var formatsStr = persona.ContentFormats.Count > 0 ? string.Join(", ", persona.ContentFormats) : "Standard posts";
        var negativesStr = persona.NegativeConstraints.Count > 0 ? string.Join(", ", persona.NegativeConstraints) : "None";

        // Giới hạn RawContent để tránh token bloat — dùng config thay vì hardcode
        var knowledgeSection = knowledges.Count > 0
            ? string.Join("\n", knowledges.Select((k, i) =>
                $"[K{i + 1}] {k.Title}: {(k.RawContent?.Length > _options.MaxKnowledgeContentLength ? k.RawContent[.._options.MaxKnowledgeContentLength] + "..." : k.RawContent)}"))
            : "No internal knowledge available.";

        string trendSection;
        string trendSelectionInstruction;

        if (preselectedTrend != null)
        {
            // Trend đã được chọn sẵn — không cần AI chọn
            trendSection = $"Selected Trend:\n- ID: {preselectedTrend.Id}\n- Title: {preselectedTrend.Title}\n- Summary: {preselectedTrend.Summary}";
            trendSelectionInstruction = $@"The trend has already been selected by the user. Use it directly.
Set ""selectedTrendId"" to ""{preselectedTrend.Id}"" and ""smartMatchReason"" to ""Trend được chọn trực tiếp bởi người dùng."" in your response.";
        }
        else
        {
            // AI cần chọn trend phù hợp nhất
            trendSection = "Available Trends (pick the BEST one for this persona):\n" +
                string.Join("\n", candidateTrends.Select(t =>
                    $"- ID: {t.Id}, Title: {t.Title}, Summary: {(t.Summary?.Length > 150 ? t.Summary[..150] + "..." : t.Summary)}"));
            trendSelectionInstruction = @"STEP 1 - TREND SELECTION: Analyze the Brand Persona AND the User Instruction (if any) to pick the single MOST compatible trend from the list above.
Set ""selectedTrendId"" to the chosen trend's ID (exact Guid string).
Set ""smartMatchReason"" to a professional Vietnamese explanation of why this trend fits the brand.";
        }

        // Inject user instruction nếu có
        var userInstructionSection = !string.IsNullOrWhiteSpace(userInstruction)
            ? $@"

⚡ USER INSTRUCTION (HIGHEST PRIORITY — override defaults if needed):
{userInstruction.Trim()}
This instruction takes precedence over general persona defaults. Follow it precisely."
            : string.Empty;

        return $@"You are an expert social media copywriter. Your task is to create engaging content about the selected trend, adapted to the brand's communication style.
Complete ALL steps in a SINGLE response. Return ONLY a raw JSON object — no markdown, no explanation.
{userInstructionSection}

{trendSelectionInstruction}

STEP 2 - KNOWLEDGE INTEGRATION: From the Internal Knowledge Base below, find any facts that are DIRECTLY relevant to the selected trend's topic. Only use knowledge that genuinely relates to the trend — do NOT force unrelated knowledge into the content.

STEP 3 - CONTENT GENERATION: Generate exactly {outputCount} content item(s).

PRIMARY RULE — TOPIC FIRST:
The content MUST be about the selected trend's topic. The trend title and summary define what the content is about.
Example: if the trend is about IPO startup, write about IPO startup — NOT about real estate.

BRAND PERSONA ROLE (secondary — tone & style only):
Use the Brand Persona to shape HOW you write, not WHAT you write about:
- Tone of Voice → writing style, vocabulary, formality level
- Target Audience → who the reader is (adjust language accordingly)
- Negative Constraints → things to avoid in writing style
- Job Title → helps understand the reader's perspective, but does NOT change the topic

PSYCHOLOGICAL TRIGGERS (apply based on the TREND's topic, not the persona's industry):
- FOMO / Urgency: time-sensitive angles from the trend
- Social Proof: reference the trend's scale/impact (numbers, names)
- Insight Hook: surprising facts from the trend that make people stop scrolling
- Solution Frame: position the reader as someone who can act on this trend

Brand Persona (for tone & style adaptation only):
- Job Title: {persona.JobTitle}
- Tone of Voice: {persona.ToneOfVoice}
- Language: {persona.Language}
- Target Audience: {audienceStr}
- Preferred Formats: {formatsStr}
- Negative Constraints (AVOID these in writing style): {negativesStr}

{trendSection}

Internal Knowledge Base (use ONLY if directly relevant to the trend topic):
{knowledgeSection}

Target Platforms: [{platformListStr}] — assign one platform per item, cover different platforms if multiple items.

Return ONLY this raw JSON object (no ```json wrapper):
{{
  ""selectedTrendId"": ""<id of selected trend>"",
  ""smartMatchReason"": ""<Vietnamese explanation of why this trend is interesting for the audience>"",
  ""items"": [
    {{
      ""platform"": ""platform name"",
      ""hook"": ""scroll-stopping first line about the trend topic"",
      ""body"": ""engaging body content about the trend, under {_options.MaxBodyLength} chars"",
      ""cta"": ""clear call to action relevant to the trend"",
      ""hashtags"": [""tag1"", ""tag2""],
      ""bannerImagePrompt"": ""detailed English image prompt representing the trend topic"",
      ""bestTimeToPost"": ""Vietnamese recommendation with reasoning""
    }}
  ]
}}

Rules:
- body must be under {_options.MaxBodyLength} characters
- max {_options.MaxHashtags} hashtags per item
- Content topic MUST match the trend — never redirect to an unrelated industry
- Return ONLY the raw JSON, no markdown code blocks";
    }

    private UnifiedGenerateResult? ParseUnifiedGenerateResult(string text)
    {
        try
        {
            return JsonSerializer.Deserialize<UnifiedGenerateResult>(text, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse unified generate result. Raw: {RawText}", text);
            return null;
        }
    }

    private GeneratedContentItem SanitizeContentItem(GeneratedContentItem item, string language)
    {
        var body = item.Body?.Trim() ?? string.Empty;
        if (body.Length > _options.MaxBodyLength)
            body = body[.._options.MaxBodyLength];

        var hashtags = (item.Hashtags ?? new List<string>())
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => t.Trim())
            .Where(t => t.Length <= 60)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(Math.Max(_options.MaxHashtags, 1))
            .ToList();

        return new GeneratedContentItem
        {
            Platform = item.Platform?.Trim() ?? "General",
            Hook = item.Hook?.Trim() ?? string.Empty,
            Body = body,
            Cta = item.Cta?.Trim() ?? string.Empty,
            Hashtags = hashtags,
            Language = language,
            BannerImagePrompt = string.IsNullOrWhiteSpace(item.BannerImagePrompt)
                ? "A modern professional social media banner, clean design, 4k"
                : item.BannerImagePrompt.Trim(),
            BestTimeToPost = string.IsNullOrWhiteSpace(item.BestTimeToPost)
                ? "Thứ Ba lúc 19:30 - Khung giờ vàng tương tác cao của mạng xã hội"
                : item.BestTimeToPost.Trim()
        };
    }

    private static string ExtractText(JsonDocument doc)
    {
        // OpenAI-compatible format: choices[0].message.content
        if (doc.RootElement.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
        {
            var first = choices[0];
            if (first.TryGetProperty("message", out var message) &&
                message.TryGetProperty("content", out var content))
            {
                return content.GetString() ?? string.Empty;
            }
        }
        return string.Empty;
    }

    private static string StripCodeFence(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }

        var trimmed = text.Trim();

        // 1. Loại bỏ các block markdown (```json ... ``` hoặc ``` ... ```)
        var match = System.Text.RegularExpressions.Regex.Match(
            trimmed, 
            @"```(?:json)?\s*(.*?)\s*```", 
            System.Text.RegularExpressions.RegexOptions.Singleline);
        
        if (match.Success)
        {
            trimmed = match.Groups[1].Value.Trim();
        }

        // 2. Tìm vị trí bắt đầu là '[' hoặc '{' và kết thúc là ']' hoặc '}'
        var firstBracket = trimmed.IndexOf('[');
        var firstBrace = trimmed.IndexOf('{');
        
        var startIdx = -1;
        var endIdx = -1;

        if (firstBracket >= 0 && (firstBrace < 0 || firstBracket < firstBrace))
        {
            startIdx = firstBracket;
            endIdx = trimmed.LastIndexOf(']');
        }
        else if (firstBrace >= 0)
        {
            startIdx = firstBrace;
            endIdx = trimmed.LastIndexOf('}');
        }

        if (startIdx >= 0 && endIdx > startIdx)
        {
            return trimmed.Substring(startIdx, endIdx - startIdx + 1);
        }

        return trimmed;
    }

    private async Task<List<string>> GetTagsAsync(int trendId, CancellationToken ct)
    {
        return await _db.TrendTags.AsNoTracking()
            .Where(tt => tt.TrendId == trendId)
            .Join(_db.Tags.AsNoTracking(), tt => tt.TagId, t => t.Id, (tt, tag) => tag.Name)
            .ToListAsync(ct);
    }

    private async Task<PersonaProfile> ResolvePersonaAsync(int userId, string? language, CancellationToken ct)
    {
        var latest = await _db.UserContexts.AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(ct);

        var profile = new PersonaProfile
        {
            JobTitle = latest?.JobTitle,
            ToneOfVoice = latest?.ToneOfVoice,
            PlatformPreferences = ParseStringList(latest?.PlatformPreferencesJson),
            TargetAudience = ParseStringList(latest?.TargetAudienceJson),
            ContentFormats = ParseStringList(latest?.ContentFormatsJson),
            NegativeConstraints = ParseStringList(latest?.NegativeConstraintsJson),
            Language = language ?? latest?.Language ?? "vi"
        };

        return profile;
    }

    private static List<string> ParseStringList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new List<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
        }
        catch
        {
            return new List<string>();
        }
    }

    private GenerateContentResponse BuildFallback(Trend trend, List<string> tags, PersonaProfile persona, int outputCount, List<string>? targetPlatforms)
    {
        var hashtags = tags
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => t.Trim())
            .Where(t => t.Length <= 60)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(Math.Max(_options.MaxHashtags, 1))
            .ToList();

        var platformsToUse = (_options.MultiPlatformEnabled && targetPlatforms != null && targetPlatforms.Count > 0)
            ? targetPlatforms
            : (persona.PlatformPreferences.Count > 0 ? persona.PlatformPreferences : new List<string> { "General" });

        var items = new List<GeneratedContentItem>();
        for (int i = 0; i < outputCount; i++)
        {
            var platform = platformsToUse[i % platformsToUse.Count];
            items.Add(new GeneratedContentItem
            {
                Platform = platform,
                Hook = $"[Fallback] Đang quan tâm về xu hướng: {trend.Title}",
                Body = trend.Summary,
                Cta = $"Tìm hiểu thêm tại: {trend.SourceUrl}",
                Hashtags = hashtags,
                Language = persona.Language,
                BannerImagePrompt = $"A high-quality social media banner for the topic '{trend.Title}', clean design, 4k",
                BestTimeToPost = "Thứ Ba lúc 19:30 - Khung giờ vàng tương tác cao của mạng xã hội"
            });
        }

        return new GenerateContentResponse { Items = items };
    }

    private async Task<HttpResponseMessage> SendWithRetryAsync(Func<HttpRequestMessage> requestFactory, CancellationToken ct)
    {
        var maxRetryAttempts = _keyPool.KeyCount;
        int delayMs = 1000;

        for (int attempt = 1; attempt <= maxRetryAttempts; attempt++)
        {
            if (_keyPool.AllKeysInCooldown)
            {
                _logger.LogWarning("⛔ Tất cả {Count} API keys đang trong cooldown. Dừng retry ngay, trả về fallback.", _keyPool.KeyCount);
                return new HttpResponseMessage((System.Net.HttpStatusCode)429)
                {
                    Content = new System.Net.Http.StringContent("{\"error\":\"all_keys_in_cooldown\"}")
                };
            }

            var request = requestFactory();
            // Lấy key từ Authorization header (Bearer <key>)
            var usedKey = request.Headers.Authorization?.Parameter ?? string.Empty;
            _logger.LogDebug("🔑 Attempt {Attempt}: provider={Provider}, url={Url}, keyLen={KeyLen}",
                attempt,
                request.Headers.Authorization?.Scheme ?? "none",
                request.RequestUri?.ToString() ?? "null",
                usedKey.Length);
            try
            {
                var response = await _client.SendAsync(request, ct);

                if (response.StatusCode == (System.Net.HttpStatusCode)429)
                {
                    _keyPool.MarkRateLimited(usedKey, TimeSpan.FromSeconds(60));
                    _logger.LogWarning("🔄 Key bị rate-limit (429) ở lần {Attempt}/{MaxAttempts}. Xoay sang key tiếp theo...",
                        attempt, maxRetryAttempts);
                    if (attempt == maxRetryAttempts) return response;
                    await Task.Delay(200, ct);
                    continue;
                }

                // 401 = key không hợp lệ hoặc bị thu hồi → xoay sang key tiếp theo
                if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    var errBody = await response.Content.ReadAsStringAsync(ct);
                    _logger.LogWarning("🔄 Key bị 401 Unauthorized ở lần {Attempt}/{MaxAttempts}. Body: {Body}. Xoay sang key tiếp theo...",
                        attempt, maxRetryAttempts, errBody);
                    _keyPool.MarkRateLimited(usedKey, TimeSpan.FromSeconds(300)); // cooldown 5 phút
                    if (attempt == maxRetryAttempts) return response;
                    await Task.Delay(200, ct);
                    continue;
                }

                // 402 = account hết credits (OpenRouter) → key này không dùng được, xoay sang key khác
                if (response.StatusCode == System.Net.HttpStatusCode.PaymentRequired)
                {
                    var errBody = await response.Content.ReadAsStringAsync(ct);
                    _logger.LogWarning("🔄 Key bị 402 PaymentRequired ở lần {Attempt}/{MaxAttempts}. Body: {Body}. Xoay sang key tiếp theo...",
                        attempt, maxRetryAttempts, errBody);
                    _keyPool.MarkRateLimited(usedKey, TimeSpan.FromSeconds(3600)); // cooldown 1 giờ — không retry liên tục
                    if (attempt == maxRetryAttempts) return response;
                    await Task.Delay(200, ct);
                    continue;
                }

                if (response.StatusCode == System.Net.HttpStatusCode.ServiceUnavailable ||
                    response.StatusCode == System.Net.HttpStatusCode.BadGateway)
                {
                    _logger.LogWarning("AI API lỗi tạm thời {StatusCode} ở lần {Attempt}/{MaxAttempts}. Thử lại sau {DelayMs}ms...",
                        response.StatusCode, attempt, maxRetryAttempts, delayMs);
                    if (attempt == maxRetryAttempts) return response;
                    await Task.Delay(delayMs, ct);
                    delayMs *= 2;
                    continue;
                }

                return response;
            }
            catch (HttpRequestException ex) when (attempt < maxRetryAttempts)
            {
                _logger.LogWarning(ex, "Lỗi mạng AI API lần {Attempt}/{MaxAttempts}. Thử lại sau {DelayMs}ms...",
                    attempt, maxRetryAttempts, delayMs);
                await Task.Delay(delayMs, ct);
                delayMs *= 2;
            }
        }

        _logger.LogWarning("⛔ Đã thử hết {Count} keys, tất cả đều bị rate-limit. Trả về fallback.", _keyPool.KeyCount);
        return new HttpResponseMessage((System.Net.HttpStatusCode)429)
        {
            Content = new System.Net.Http.StringContent("{\"error\":\"all_keys_exhausted\"}")
        };
    }
}
