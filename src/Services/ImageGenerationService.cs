using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SocialSense.Configuration;
using SocialSense.Data;
using SocialSense.DTOs.Content;

namespace SocialSense.Services;

public interface IImageGenerationService
{
    Task<ImageAnalyzeResponse> AnalyzeAsync(ImageAnalyzeRequest request, int userId, CancellationToken ct);
    Task<ImageGenerateResponse> GenerateAsync(ImageGenerateRequest request, int userId, CancellationToken ct);
}

public class ImageGenerationService : IImageGenerationService
{
    private readonly AppDbContext _db;
    private readonly HttpClient _client;
    private readonly GeminiApiKeyPool _keyPool;
    private readonly ILogger<ImageGenerationService> _logger;

    private static readonly JsonSerializerOptions _jsonOpts = new() { PropertyNameCaseInsensitive = true };

    // Platform banner specs
    private static readonly Dictionary<string, BannerSpecs> _platformSpecs = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Facebook"]  = new() { Platform = "Facebook",  Dimensions = "1200x630",  AspectRatio = "1.91:1", RecommendedStyle = "Bold text, high contrast, product-focused" },
        ["Instagram"] = new() { Platform = "Instagram", Dimensions = "1080x1080", AspectRatio = "1:1",    RecommendedStyle = "Aesthetic, lifestyle, minimal text" },
        ["TikTok"]    = new() { Platform = "TikTok",    Dimensions = "1080x1920", AspectRatio = "9:16",   RecommendedStyle = "Vertical, dynamic, eye-catching colors" },
        ["Zalo"]      = new() { Platform = "Zalo",      Dimensions = "1200x628",  AspectRatio = "1.91:1", RecommendedStyle = "Clean, professional, Vietnamese-friendly" },
        ["LinkedIn"]  = new() { Platform = "LinkedIn",  Dimensions = "1200x627",  AspectRatio = "1.91:1", RecommendedStyle = "Professional, data-driven, corporate" },
        ["Twitter"]   = new() { Platform = "Twitter",   Dimensions = "1600x900",  AspectRatio = "16:9",   RecommendedStyle = "Bold, punchy, high contrast" },
    };

    public ImageGenerationService(
        AppDbContext db,
        HttpClient client,
        GeminiApiKeyPool keyPool,
        IOptions<ImageGeneratorOptions> imageOpts,
        ILogger<ImageGenerationService> logger)
    {
        _db = db;
        _client = client;
        _keyPool = keyPool;
        _logger = logger;
    }

    // ── Bước 1: Analyze ───────────────────────────────────────────────────────
    public async Task<ImageAnalyzeResponse> AnalyzeAsync(
        ImageAnalyzeRequest request, int userId, CancellationToken ct)
    {
        var contentText = await ResolveContentTextAsync(request.ContentHistoryId, request.ContentText, userId, ct);
        var specs = GetBannerSpecs(request.Platform);

        var prompt = BuildAnalyzePrompt(contentText, request.Platform, specs);

        try
        {
            var slot = _keyPool.GetNextSlot();
            var httpReq = BuildHttpRequest(prompt, slot, temperature: 0.3, maxTokens: 1024);
            using var response = await _client.SendAsync(httpReq, ct);

            if (response.IsSuccessStatusCode)
            {
                await using var stream = await response.Content.ReadAsStreamAsync(ct);
                using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
                var text = ExtractText(doc);
                if (!string.IsNullOrWhiteSpace(text))
                {
                    var cleaned = StripCodeFence(text);
                    var result = JsonSerializer.Deserialize<ImageAnalyzeResponse>(cleaned, _jsonOpts);
                    if (result != null)
                    {
                        result.BannerSpecs = specs;
                        return result;
                    }
                }
            }
            else
            {
                var err = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("ImageAnalyze AI failed: {Status} — {Body}", response.StatusCode, err);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ImageAnalyze error");
        }

        // Fallback
        return BuildFallbackAnalyze(contentText, request.Platform, specs);
    }

    // ── Bước 3: Generate ─────────────────────────────────────────────────────
    public async Task<ImageGenerateResponse> GenerateAsync(
        ImageGenerateRequest request, int userId, CancellationToken ct)
    {
        var contentText = await ResolveContentTextAsync(request.ContentHistoryId, request.ContentText, userId, ct);
        var specs = GetBannerSpecs(request.Platform);

        // Build final prompt từ draft + answers
        var finalPrompt = await BuildFinalPromptAsync(
            contentText, request.DraftPrompt, request.DetectedIndustry,
            request.Platform, specs, request.Answers, ct);

        // Tạo ảnh miễn phí qua Pollinations.ai (không cần API key)
        string? imageUrl = await TryGenerateImagePollinationsAsync(finalPrompt, specs, ct);

        return new ImageGenerateResponse
        {
            ImageUrl = imageUrl,
            FinalPrompt = finalPrompt,
            BannerSpecs = specs,
            IsGenerated = imageUrl != null,
            PromptUsageTip = imageUrl == null
                ? "Copy prompt trên và dùng với: Midjourney (/imagine), DALL-E 3 (ChatGPT Plus), hoặc Adobe Firefly để tạo ảnh miễn phí."
                : null
        };
    }

    // ── Build Analyze Prompt ──────────────────────────────────────────────────
    private static string BuildAnalyzePrompt(string content, string platform, BannerSpecs specs)
    {
        return $@"You are an expert visual marketing strategist and banner designer.
Analyze the following social media content and return a JSON object for banner creation planning.
Return ONLY raw JSON — no markdown, no explanation.

Content to analyze:
{content}

Target Platform: {platform} ({specs.Dimensions}, {specs.AspectRatio})

Detect the industry from the content (real_estate, fashion, food, tech, finance, education, beauty, travel, fitness, other).

Return this exact JSON structure:
{{
  ""imageSummary"": ""2-3 sentence Vietnamese description of the ideal banner visual"",
  ""draftPrompt"": ""English image generation prompt using: [Subject] + [Style] + [Lighting] + [Color Palette] + [Platform specs]"",
  ""detectedIndustry"": ""industry_key"",
  ""clarifyingQuestions"": [
    {{
      ""id"": ""q1"",
      ""question"": ""Vietnamese question about product/subject image"",
      ""type"": ""yesno""
    }},
    {{
      ""id"": ""q2"",
      ""question"": ""Vietnamese question about color tone"",
      ""type"": ""choice"",
      ""options"": [""Tối & sang trọng"", ""Sáng & năng động"", ""Tự nhiên & ấm áp""]
    }},
    {{
      ""id"": ""q3"",
      ""question"": ""Có muốn thêm text/caption trên banner không? Nếu có, nhập nội dung:"",
      ""type"": ""text_optional""
    }}
  ]
}}

Rules:
- imageSummary must be in Vietnamese
- draftPrompt must be in English, professional image generation style
- clarifyingQuestions[0] must ask about adding real product/subject photo
- Tailor questions to the detected industry
- Return ONLY the JSON object, nothing else";
    }

    // ── Build Final Prompt ────────────────────────────────────────────────────
    private async Task<string> BuildFinalPromptAsync(
        string content, string draftPrompt, string industry,
        string platform, BannerSpecs specs,
        Dictionary<string, string> answers, CancellationToken ct)
    {
        var hasProductPhoto = answers.TryGetValue("q1", out var q1) && q1.ToLower() is "yes" or "có";
        var colorTone = answers.TryGetValue("q2", out var q2) ? q2 : "Tối & sang trọng";

        // q3 chỉ là caption nếu user thực sự nhập text — không phải option từ q2
        var q3Raw = answers.TryGetValue("q3", out var q3val) ? q3val?.Trim() : null;
        var captionBlacklist = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            { "yes", "no", "có", "không", "skip", "none", "Tối & sang trọng", "Sáng & năng động", "Tự nhiên & ấm áp" };
        var caption = !string.IsNullOrWhiteSpace(q3Raw) && !captionBlacklist.Contains(q3Raw)
            ? q3Raw : null;

        // Map color tone → English style (ngắn gọn)
        var styleMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Tối & sang trọng"] = "dark luxury, charcoal background, gold accents",
            ["Sáng & năng động"] = "bright vibrant, white background, bold colors",
            ["Tự nhiên & ấm áp"] = "warm natural tones, soft lighting, earthy colors",
        };
        var styleDesc = styleMap.TryGetValue(colorTone, out var s) ? s : "professional, clean design";

        // Làm sạch draftPrompt — bỏ các từ sẽ bị lặp lại
        var cleanDraft = CleanDraftPrompt(draftPrompt);

        // Build prompt ngắn gọn, không lặp
        var parts = new List<string>();
        parts.Add(cleanDraft);
        parts.Add(styleDesc);
        if (hasProductPhoto) parts.Add("product featured prominently");
        if (caption != null) parts.Add($"text: '{caption}'");
        parts.Add($"{specs.Dimensions}");
        parts.Add("8K, photorealistic, commercial banner");

        // Urgency
        if (content.Contains("gấp") || content.Contains("nhanh") ||
            content.Contains("limited") || content.Contains("khan hiếm"))
            parts.Add("HOT DEAL badge");

        var rawPrompt = string.Join(", ", parts.Where(p => !string.IsNullOrWhiteSpace(p)));

        // Giới hạn 180 từ để URL không quá dài
        rawPrompt = TruncateToWordLimit(rawPrompt, 180);

        // Nếu có AI slot, dùng AI để tinh chỉnh
        if (_keyPool.HasKeys)
        {
            var refined = await RefinePromptWithAiAsync(rawPrompt, industry, platform, ct);
            if (!string.IsNullOrWhiteSpace(refined))
                return TruncateToWordLimit(refined, 180);
        }

        return rawPrompt;
    }

    /// <summary>Bỏ các cụm từ thừa trong draftPrompt để tránh lặp khi ghép với styleDesc và industryTricks.</summary>
    private static string CleanDraftPrompt(string draft)
    {
        // Bỏ các suffix thường bị lặp
        var redundant = new[]
        {
            "photorealistic", "8K", "ultra-detailed", "commercial photography",
            "high contrast", "rule of thirds", "golden hour lighting",
            "dramatic lighting", "soft lighting", "warm lighting",
            "luxury real estate photography", "architectural visualization",
            "premium property aesthetic", "river view or city skyline background"
        };
        var result = draft;
        foreach (var r in redundant)
            result = System.Text.RegularExpressions.Regex.Replace(
                result, $@",?\s*{System.Text.RegularExpressions.Regex.Escape(r)}", "",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();

        // Dọn dấu phẩy thừa
        result = System.Text.RegularExpressions.Regex.Replace(result, @",\s*,", ",").Trim(' ', ',');
        return result;
    }

    /// <summary>Cắt prompt xuống còn tối đa maxWords từ.</summary>
    private static string TruncateToWordLimit(string prompt, int maxWords)
    {
        var words = prompt.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (words.Length <= maxWords) return prompt;
        return string.Join(" ", words.Take(maxWords));
    }

    private async Task<string?> RefinePromptWithAiAsync(
        string rawPrompt, string industry, string platform, CancellationToken ct)
    {
        var refinePrompt = $@"You are a professional image prompt engineer specializing in social media banners.
Refine and enhance this image generation prompt for maximum visual impact on {platform}.
Return ONLY the refined prompt string — no JSON, no explanation, no quotes.

Industry: {industry}
Raw prompt: {rawPrompt}

Enhancement rules:
- Apply rule of thirds composition
- Ensure high contrast between subject and background
- Add specific lighting direction (front-lit, rim-lit, dramatic side lighting)
- Include depth of field specification
- Add color grading style (cinematic, commercial, editorial)
- Keep under 200 words
- Output in English only
- CRITICAL: Do NOT include any Vietnamese text, color names in Vietnamese, or UI option labels in the prompt
- CRITICAL: Do NOT add any text overlay instructions unless the raw prompt already contains a specific caption to display
- CRITICAL: Remove any phrases like 'text overlay: ...' that contain Vietnamese words or option labels";

        try
        {
            var slot = _keyPool.GetNextSlot();
            var req = BuildHttpRequest(refinePrompt, slot, temperature: 0.4, maxTokens: 300);
            using var response = await _client.SendAsync(req, ct);
            if (response.IsSuccessStatusCode)
            {
                await using var stream = await response.Content.ReadAsStreamAsync(ct);
                using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
                var text = ExtractText(doc)?.Trim();
                if (!string.IsNullOrWhiteSpace(text) && text.Length > 20)
                    return text;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "RefinePrompt AI call failed — using raw prompt");
        }
        return null;
    }

    private async Task<string?> TryGenerateImageAsync(
        string prompt, GeminiApiKeyPool.KeySlot slot, CancellationToken ct)
    {
        try
        {
            // OpenRouter image generation: dùng /chat/completions với modalities: ["image"]
            // Model: x-ai/grok-imagine-image-quality hoặc bất kỳ image model nào
            var model = slot.ModelOverride ?? "x-ai/grok-imagine-image-quality";

            var body = new
            {
                model,
                messages = new[]
                {
                    new { role = "user", content = prompt }
                },
                modalities = new[] { "image" }
            };

            var baseUrl = slot.Provider switch
            {
                "groq" => "https://api.groq.com/openai/v1",
                "openai" => "https://api.openai.com/v1",
                _ => "https://openrouter.ai/api/v1"
            };

            var msg = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/chat/completions")
            {
                Content = new StringContent(
                    System.Text.Json.JsonSerializer.Serialize(body),
                    Encoding.UTF8, "application/json")
            };
            msg.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", slot.Key);
            if (slot.Provider == "openrouter" || string.IsNullOrEmpty(slot.Provider))
            {
                msg.Headers.TryAddWithoutValidation("HTTP-Referer", "https://socialsense.app");
                msg.Headers.TryAddWithoutValidation("X-Title", "SocialSense");
            }

            using var response = await _client.SendAsync(msg, ct);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Image generation failed: {Status} — {Body}", response.StatusCode, err);
                return null;
            }

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var doc = await System.Text.Json.JsonDocument.ParseAsync(stream, cancellationToken: ct);

            // OpenRouter trả về ảnh dạng base64 data URL trong choices[0].message.content
            // Format: [{ "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }]
            if (doc.RootElement.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
            {
                var message = choices[0].GetProperty("message");

                // Content có thể là string hoặc array
                if (message.TryGetProperty("content", out var content))
                {
                    if (content.ValueKind == System.Text.Json.JsonValueKind.String)
                    {
                        var text = content.GetString() ?? string.Empty;
                        // Nếu là data URL trực tiếp
                        if (text.StartsWith("data:image"))
                            return text;
                    }
                    else if (content.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        foreach (var item in content.EnumerateArray())
                        {
                            if (item.TryGetProperty("type", out var type) &&
                                type.GetString() == "image_url" &&
                                item.TryGetProperty("image_url", out var imageUrl) &&
                                imageUrl.TryGetProperty("url", out var url))
                            {
                                return url.GetString();
                            }
                        }
                    }
                }
            }

            _logger.LogWarning("Image generation: unexpected response format from {Model}", model);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TryGenerateImageAsync error");
            return null;
        }
    }

    // ── Pollinations.ai — download ảnh tại BE, trả base64 về FE ──────────────
    // Lý do: Android fetch/OkHttp không handle được URL dài + long-polling của Pollinations
    // BE download ảnh → convert base64 → FE dùng data URI trực tiếp, không cần fetch thêm
    private async Task<string?> TryGenerateImagePollinationsAsync(
        string prompt, BannerSpecs specs, CancellationToken ct)
    {
        try
        {
            var dims = specs.Dimensions.Split('x');
            var width  = dims.Length > 0 && int.TryParse(dims[0], out var w) ? Math.Min(w, 1280) : 1200;
            var height = dims.Length > 1 && int.TryParse(dims[1], out var h) ? Math.Min(h, 1280) : 630;
            var seed = Random.Shared.Next(1, 99999);

            var safePrompt = prompt.Replace("\r\n", " ").Replace("\n", " ").Replace("\r", " ");
            var encodedPrompt = Uri.EscapeDataString(safePrompt);

            var pollinationsKeys = _keyPool.GetPollinationsKeys();
            _logger.LogInformation("Generating image via Pollinations.ai ({W}x{H}, keys={Count})",
                width, height, pollinationsKeys.Count);

            var keysToTry = pollinationsKeys.Count > 0
                ? pollinationsKeys
                : (IReadOnlyList<string>)new List<string> { string.Empty };

            foreach (var key in keysToTry)
            {
                var url = string.IsNullOrWhiteSpace(key)
                    ? $"https://image.pollinations.ai/prompt/{encodedPrompt}?width={width}&height={height}&seed={seed}&nologo=true&model=flux"
                    : $"https://image.pollinations.ai/prompt/{encodedPrompt}?width={width}&height={height}&seed={seed}&nologo=true&model=flux&enhance=true&token={key}";

                try
                {
                    // GET trực tiếp — Pollinations generate và trả ảnh trong 1 request (15-60s)
                    using var getReq = new HttpRequestMessage(HttpMethod.Get, url);
                    using var getResp = await _client.SendAsync(getReq, HttpCompletionOption.ResponseHeadersRead, ct);

                    var statusCode = (int)getResp.StatusCode;
                    _logger.LogInformation("Pollinations GET → {Status} (key=****{Suffix})",
                        statusCode, key.Length >= 4 ? key[^4..] : "none");

                    if (statusCode == 402)
                    {
                        _logger.LogWarning("Pollinations key ****{Suffix} hết balance, thử key tiếp",
                            key.Length >= 4 ? key[^4..] : "none");
                        if (!string.IsNullOrWhiteSpace(key))
                            _keyPool.MarkRateLimited(key, TimeSpan.FromHours(24));
                        continue;
                    }

                    if (!getResp.IsSuccessStatusCode)
                    {
                        _logger.LogWarning("Pollinations GET failed: {Status}", statusCode);
                        return null;
                    }

                    // Download bytes và convert sang base64 data URL
                    var imageBytes = await getResp.Content.ReadAsByteArrayAsync(ct);
                    if (imageBytes.Length < 1000)
                    {
                        _logger.LogWarning("Pollinations trả ảnh quá nhỏ ({Bytes} bytes), bỏ qua", imageBytes.Length);
                        return null;
                    }

                    var contentType = getResp.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
                    var base64 = Convert.ToBase64String(imageBytes);
                    _logger.LogInformation("Pollinations ảnh OK: {Bytes} bytes → base64 {B64Len} chars",
                        imageBytes.Length, base64.Length);

                    return $"data:{contentType};base64,{base64}";
                }
                catch (TaskCanceledException)
                {
                    _logger.LogWarning("Pollinations request bị cancel (user navigate đi hoặc timeout)");
                    return null;
                }
            }

            _logger.LogWarning("Tất cả Pollinations keys đều hết balance");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Pollinations.ai image generation failed");
            return null;
        }
    }

    // ── Industry tricks ───────────────────────────────────────────────────────
    private static string GetIndustryTricks(string industry) => industry.ToLower() switch
    {
        "real_estate" =>
            "luxury real estate photography, architectural visualization, golden hour lighting, " +
            "river view or city skyline background, premium property aesthetic",
        "fashion" =>
            "fashion editorial photography, model lifestyle shot, studio or outdoor setting, " +
            "clothing detail close-up, trendy composition",
        "food" =>
            "food photography, appetizing close-up, steam or freshness cues, " +
            "warm restaurant lighting, bokeh background",
        "tech" =>
            "product photography, clean white or dark background, tech aesthetic, " +
            "blue accent lighting, minimalist composition",
        "finance" =>
            "professional financial imagery, growth charts, confident business person, " +
            "blue and gold color scheme, trust-inspiring composition",
        "beauty" =>
            "beauty product photography, soft pastel tones, glowing skin texture, " +
            "luxury cosmetic aesthetic, feminine composition",
        "fitness" =>
            "dynamic fitness photography, motion blur, energetic pose, " +
            "gym or outdoor setting, motivational composition",
        "education" =>
            "educational imagery, bright and inspiring, books or digital devices, " +
            "clean modern design, knowledge-inspiring composition",
        _ =>
            "professional commercial photography, clean composition, " +
            "brand-appropriate color scheme, high-end advertising aesthetic"
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    private async Task<string> ResolveContentTextAsync(
        int? historyId, string? directText, int userId, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(directText))
            return directText;

        if (historyId.HasValue)
        {
            var history = await _db.ContentHistories.AsNoTracking()
                .FirstOrDefaultAsync(h => h.Id == historyId.Value && h.UserId == userId, ct);

            if (history != null)
            {
                try
                {
                    var items = JsonSerializer.Deserialize<List<GeneratedContentItem>>(
                        history.GeneratedContent, _jsonOpts);
                    var first = items?.FirstOrDefault();
                    if (first != null)
                        return $"{first.Hook}\n\n{first.Body}\n\n{first.Cta}";
                }
                catch { /* ignore */ }
            }
        }

        return "Social media content for banner creation";
    }

    private static BannerSpecs GetBannerSpecs(string platform)
    {
        return _platformSpecs.TryGetValue(platform, out var specs)
            ? specs
            : new BannerSpecs { Platform = platform, Dimensions = "1200x630", AspectRatio = "1.91:1", RecommendedStyle = "Professional, clean design" };
    }

    private HttpRequestMessage BuildHttpRequest(
        string prompt, GeminiApiKeyPool.KeySlot slot, double temperature, int maxTokens)
    {
        var baseUrl = slot.Provider switch
        {
            "groq" => "https://api.groq.com/openai/v1",
            "openai" => "https://api.openai.com/v1",
            _ => "https://openrouter.ai/api/v1"
        };
        var model = slot.ModelOverride ?? "meta-llama/llama-4-scout";

        var body = new
        {
            model,
            messages = new[] { new { role = "user", content = prompt } },
            temperature,
            max_tokens = maxTokens
        };

        var msg = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/chat/completions")
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
        };
        msg.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", slot.Key);

        if (slot.Provider == "openrouter")
        {
            msg.Headers.TryAddWithoutValidation("HTTP-Referer", "https://socialsense.app");
            msg.Headers.TryAddWithoutValidation("X-Title", "SocialSense");
        }
        return msg;
    }

    private static string ExtractText(JsonDocument doc)
    {
        if (doc.RootElement.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
        {
            var first = choices[0];
            if (first.TryGetProperty("message", out var message) &&
                message.TryGetProperty("content", out var content))
                return content.GetString() ?? string.Empty;
        }
        return string.Empty;
    }

    private static string StripCodeFence(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var t = text.Trim();
        var match = System.Text.RegularExpressions.Regex.Match(t, @"```(?:json)?\s*(.*?)\s*```",
            System.Text.RegularExpressions.RegexOptions.Singleline);
        if (match.Success) t = match.Groups[1].Value.Trim();
        var brace = t.IndexOf('{');
        var lastBrace = t.LastIndexOf('}');
        if (brace >= 0 && lastBrace > brace) return t[brace..(lastBrace + 1)];
        return t;
    }

    private static ImageAnalyzeResponse BuildFallbackAnalyze(string content, string platform, BannerSpecs specs)
    {
        return new ImageAnalyzeResponse
        {
            ImageSummary = "Banner chuyên nghiệp phù hợp với nội dung của bạn, tone màu thu hút, bố cục rõ ràng.",
            DraftPrompt = $"Professional social media banner for {platform}, {specs.Dimensions}, clean modern design, high contrast, commercial photography style",
            DetectedIndustry = "other",
            BannerSpecs = specs,
            ClarifyingQuestions = new List<ClarifyingQuestion>
            {
                new() { Id = "q1", Question = "Bạn có muốn thêm ảnh sản phẩm/chủ thể thực tế vào banner không?", Type = "yesno" },
                new() { Id = "q2", Question = "Tone màu bạn muốn:", Type = "choice", Options = new() { "Tối & sang trọng", "Sáng & năng động", "Tự nhiên & ấm áp" } },
                new() { Id = "q3", Question = "Có muốn thêm text/caption trên banner không? Nếu có, nhập nội dung:", Type = "text_optional" }
            }
        };
    }
}
