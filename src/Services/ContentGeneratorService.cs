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

    // ─── Unified response wrapper cho CheckBrandAlignmentAsync (1 API call) ───
    private class UnifiedBrandAlignmentResult
    {
        public int BrandScore { get; set; }
        public string Analysis { get; set; } = string.Empty;
        public string Suggestions { get; set; } = string.Empty;
        public string RefinedContent { get; set; } = string.Empty;
    }

    public async Task<GenerateContentResponse?> GenerateAsync(GenerateContentRequest request, CancellationToken ct)
    {
        var persona = await ResolvePersonaAsync(request.UserId, request.Language, ct);
        var outputCount = Math.Clamp(request.OutputCount, 1, 3);

        // ── Bước 1: Lấy dữ liệu từ DB (không tốn quota) ──────────────────────
        List<Trend> candidateTrends;
        Trend? preselectedTrend = null;

        if (!request.TrendId.HasValue || request.TrendId.Value == Guid.Empty)
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
            candidateTrends, preselectedTrend, knowledges, persona, outputCount, request.TargetPlatforms);

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
                        if (preselectedTrend == null && Guid.TryParse(result.SelectedTrendId, out var parsedId))
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

        // ── Bước 5: Lưu history và trừ quota ─────────────────────────────────
        try
        {
            var serialized = JsonSerializer.Serialize(items);
            if (mediaUrl == null)
                await _historyService.SaveHistoryAsync(request.UserId, selectedTrend.Id, serialized, ct);
            else
                await _historyService.SaveHistoryAsync(request.UserId, selectedTrend.Id, serialized, mediaUrl, ct);

            await _db.Database.ExecuteSqlRawAsync(
                "UPDATE Users SET RemainingQuota = RemainingQuota - 1 WHERE Id = {0} AND RemainingQuota > 0",
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

        var body = new
        {
            model = _options.Model,
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
        return provider switch
        {
            "groq" => "https://api.groq.com/openai/v1",
            "openai" => "https://api.openai.com/v1",
            "openrouter" => "https://openrouter.ai/api/v1",
            _ => configEndpoint.TrimEnd('/')
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
        List<string>? targetPlatforms)
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
            trendSelectionInstruction = @"STEP 1 - TREND SELECTION: Analyze the Brand Persona and pick the single MOST compatible trend from the list above.
Set ""selectedTrendId"" to the chosen trend's ID (exact Guid string).
Set ""smartMatchReason"" to a professional Vietnamese explanation of why this trend fits the brand.";
        }

        return $@"You are the world's most powerful AI copywriter, brand strategist, and RAG expert combined.
Complete ALL of the following steps in a SINGLE response. Return ONLY a raw JSON object — no markdown, no explanation.

{trendSelectionInstruction}

STEP 2 - KNOWLEDGE INTEGRATION: From the Internal Knowledge Base below, identify the most relevant facts, brand values, or product details that match the selected trend and persona. Weave them naturally into the content.

STEP 3 - CONTENT GENERATION: Generate exactly {outputCount} content item(s) using master-class psychological copywriting triggers:
- FOMO / Scarcity: Limited slots, rising prices, last batch
- Status & Self-Worth: Make buyer feel elite, smart, valued
- Pain Point Agitation: Expose weakness, present product as the ONLY cure
- Emotional Ownership: Talk as if they already own it
- Strict Context Binding: NEVER write off-brand content. Match the Job Title and audience exactly.

Brand Persona:
- Job Title: {persona.JobTitle}
- Tone of Voice: {persona.ToneOfVoice}
- Language: {persona.Language}
- Target Audience: {audienceStr}
- Preferred Formats: {formatsStr}
- Negative Constraints (AVOID these): {negativesStr}

{trendSection}

Internal Knowledge Base (use relevant items to enrich content):
{knowledgeSection}

Target Platforms: [{platformListStr}] — assign one platform per item, cover different platforms if multiple items.

Return ONLY this raw JSON object (no ```json wrapper):
{{
  ""selectedTrendId"": ""<guid of selected trend>"",
  ""smartMatchReason"": ""<Vietnamese explanation>"",
  ""items"": [
    {{
      ""platform"": ""platform name"",
      ""hook"": ""scroll-stopping psychological hook"",
      ""body"": ""core content under {_options.MaxBodyLength} chars"",
      ""cta"": ""compelling call to action"",
      ""hashtags"": [""tag1"", ""tag2""],
      ""bannerImagePrompt"": ""detailed English image prompt for DALL-E/Midjourney"",
      ""bestTimeToPost"": ""Vietnamese recommendation with justification""
    }}
  ]
}}

Rules:
- body must be under {_options.MaxBodyLength} characters
- max {_options.MaxHashtags} hashtags per item
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

    private async Task<List<string>> GetTagsAsync(Guid trendId, CancellationToken ct)
    {
        return await _db.TrendTags.AsNoTracking()
            .Where(tt => tt.TrendId == trendId)
            .Join(_db.Tags.AsNoTracking(), tt => tt.TagId, t => t.Id, (tt, tag) => tag.Name)
            .ToListAsync(ct);
    }

    private async Task<PersonaProfile> ResolvePersonaAsync(string userId, string? language, CancellationToken ct)
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

    public async Task<CheckBrandAlignmentResponse?> CheckBrandAlignmentAsync(CheckBrandAlignmentRequest request, CancellationToken ct)
    {
        var persona = await ResolvePersonaAsync(request.UserId, null, ct);
        var audienceStr = persona.TargetAudience.Count > 0 ? string.Join(", ", persona.TargetAudience) : "General public";
        var formatsStr = persona.ContentFormats.Count > 0 ? string.Join(", ", persona.ContentFormats) : "Standard posts";
        var negativesStr = persona.NegativeConstraints.Count > 0 ? string.Join(", ", persona.NegativeConstraints) : "None";

        // Giới hạn knowledge để tránh token bloat (dùng config MaxKnowledgeItems)
        var knowledges = await _db.KnowledgeItems.AsNoTracking()
            .OrderByDescending(k => k.CreatedAt)
            .Take(_options.MaxKnowledgeItems)
            .ToListAsync(ct);

        var knowledgeSection = knowledges.Count > 0
            ? string.Join("\n", knowledges.Select((k, i) =>
                $"[K{i + 1}] {k.Title}: {(k.RawContent?.Length > _options.MaxKnowledgeContentLength ? k.RawContent[.._options.MaxKnowledgeContentLength] + "..." : k.RawContent)}"))
            : "No internal knowledge available.";

        // 1 prompt duy nhất: tìm brand rules liên quan + đánh giá + đề xuất cải thiện
        var prompt = $@"You are the legendary master brand strategist and world-class expert in customer psychology copywriting.
Complete ALL steps below in a SINGLE response. Return ONLY a raw JSON object — no markdown, no explanation.

STEP 1 - BRAND RULES EXTRACTION: From the Internal Knowledge Base, identify the most relevant brand guidelines, forbidden topics, required keywords, or communication rules that apply to this draft content.

STEP 2 - BRAND ALIGNMENT EVALUATION: Critically evaluate the Draft Content against the Brand Persona and the extracted brand rules. Grade it and provide aggressive improvement suggestions.

Brand Persona:
- Job Title: {persona.JobTitle}
- Tone of Voice: {persona.ToneOfVoice}
- Language: {persona.Language}
- Target Audience: {audienceStr}
- Preferred Formats: {formatsStr}
- Negative Constraints (AVOID): {negativesStr}

Internal Knowledge Base (brand guidelines, product info, rules):
{knowledgeSection}

Draft Content to evaluate:
{request.DraftContent}

Return ONLY this raw JSON object (no ```json wrapper):
{{
  ""brandScore"": 85,
  ""analysis"": ""Sharp Vietnamese analysis: strengths and specific weaknesses of the current writing"",
  ""suggestions"": ""Step-by-step Vietnamese suggestions using psychological copy techniques (FOMO, Status, Pain Point, Emotional Ownership)"",
  ""refinedContent"": ""The ultimate rewritten version in Vietnamese with aggressive hook, emotional body, and urgent CTA""
}}";

        Func<HttpRequestMessage> requestFactory = () =>
            BuildRequest(prompt, 0.4, _options.MaxOutputTokens);

        try
        {
            using var response = await SendWithRetryAsync(requestFactory, ct);
            if (response.IsSuccessStatusCode)
            {
                await using var stream = await response.Content.ReadAsStreamAsync(ct);
                using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
                var text = ExtractText(doc);
                if (!string.IsNullOrWhiteSpace(text))
                {
                    var cleaned = StripCodeFence(text).Trim();
                    try
                    {
                        return JsonSerializer.Deserialize<CheckBrandAlignmentResponse>(cleaned, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });
                    }
                    catch (JsonException ex)
                    {
                        _logger.LogError(ex, "Failed to parse brand alignment response. Raw: {RawText}", text);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to analyze draft brand alignment with Gemini.");
        }

        return new CheckBrandAlignmentResponse
        {
            BrandScore = 50,
            Analysis = "Không thể phân tích nội dung nháp vào lúc này. Vui lòng kiểm tra lại cấu hình kết nối hoặc API Key.",
            Suggestions = "Hãy đảm bảo bài viết nháp của bạn dài tối thiểu 10 ký tự và chứa từ khóa liên quan đến sản phẩm.",
            RefinedContent = request.DraftContent
        };
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
