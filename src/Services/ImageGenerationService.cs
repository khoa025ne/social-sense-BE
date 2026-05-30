using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
        var finalPromptTask = BuildFinalPromptAsync(
            contentText, request.DraftPrompt, request.DetectedIndustry,
            request.Platform, specs, request.Answers, ct);

        var finalPrompt = await finalPromptTask;

        // Thử generate ảnh nếu có image slot
        string? imageUrl = null;
        var imageSlot = _keyPool.GetImageSlot();

        if (imageSlot.SupportsImageGen)
        {
            imageUrl = await TryGenerateImageAsync(finalPrompt, imageSlot, ct);
        }

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
        var caption = answers.TryGetValue("q3", out var q3) && !string.IsNullOrWhiteSpace(q3) ? q3 : null;

        // Map color tone → English style
        var styleMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Tối & sang trọng"]   = "dark luxury, deep charcoal background, gold accents, dramatic lighting",
            ["Sáng & năng động"]   = "bright vibrant, white background, bold colors, energetic composition",
            ["Tự nhiên & ấm áp"]   = "natural warm tones, soft lighting, earthy colors, organic feel",
        };
        var styleDesc = styleMap.TryGetValue(colorTone, out var s) ? s : "professional, clean design";

        // Industry-specific tricks
        var industryTricks = GetIndustryTricks(industry);

        // Platform dimensions
        var dimStr = $"{specs.Dimensions} banner";

        // Build prompt với formula
        var promptParts = new List<string> { draftPrompt };

        promptParts.Add(styleDesc);
        promptParts.Add(industryTricks);
        promptParts.Add($"{dimStr}, {specs.AspectRatio} aspect ratio");
        promptParts.Add("8K quality, commercial photography, ultra-detailed");

        if (hasProductPhoto)
            promptParts.Add("with real product prominently featured, rule of thirds composition");

        if (caption != null)
            promptParts.Add($"text overlay: '{caption}' in bold white sans-serif font, high contrast");
        else
            promptParts.Add("minimal text, negative space for text overlay");

        // Urgency visual nếu content có từ khóa bán hàng
        if (content.Contains("gấp") || content.Contains("nhanh") || content.Contains("limited") || content.Contains("khan hiếm"))
            promptParts.Add("urgency badge 'HOT DEAL' or 'LIMITED' in corner, attention-grabbing");

        var finalPrompt = string.Join(", ", promptParts.Where(p => !string.IsNullOrWhiteSpace(p)));

        // Nếu có AI slot, dùng AI để tinh chỉnh prompt thêm
        if (_keyPool.HasKeys)
        {
            var refined = await RefinePromptWithAiAsync(finalPrompt, industry, platform, ct);
            if (!string.IsNullOrWhiteSpace(refined)) return refined;
        }

        return finalPrompt;
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
- Output in English only";

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
        // Hiện tại OpenRouter image generation dùng endpoint khác
        // Placeholder — tích hợp thực tế khi có image model key
        _logger.LogInformation("Image generation requested with slot {Label} — feature coming soon", slot.Label);
        return null;
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
