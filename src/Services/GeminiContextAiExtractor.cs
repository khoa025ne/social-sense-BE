using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SocialSense.Configuration;

namespace SocialSense.Services;

public class GeminiContextAiExtractor : IContextAiExtractor
{
    private readonly HttpClient _client;
    private readonly GeminiOptions _options;
    private readonly GeminiApiKeyPool _keyPool;
    private readonly ILogger<GeminiContextAiExtractor> _logger;

    public GeminiContextAiExtractor(
        HttpClient client,
        IOptions<GeminiOptions> options,
        GeminiApiKeyPool keyPool,
        ILogger<GeminiContextAiExtractor> logger)
    {
        _client = client;
        _options = options.Value;
        _keyPool = keyPool;
        _logger = logger;
    }

    public async Task<ExtractedPersona> ExtractPersonaAsync(List<string> answers, string language, CancellationToken ct)
    {
        if (!_options.Enabled || !_keyPool.HasKeys)
            return BuildFallback();

        var prompt = BuildPrompt(answers, language);

        Func<HttpRequestMessage> requestFactory = () => BuildRequest(prompt);

        try
        {
            using var response = await SendWithRetryAsync(requestFactory, ct);
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("AI context request failed: {StatusCode}. Response: {ErrorBody}", response.StatusCode, errorBody);
                return BuildFallback();
            }

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            var text = ExtractText(doc);
            if (string.IsNullOrWhiteSpace(text))
            {
                _logger.LogWarning("AI context response missing text.");
                return BuildFallback();
            }

            var cleaned = StripCodeFence(text);
            var persona = ParseResult(cleaned);
            return persona ?? BuildFallback();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI context extractor error.");
            return BuildFallback();
        }
    }

    // ── OpenAI-compatible request builder ────────────────────────────────────
    private HttpRequestMessage BuildRequest(string prompt)
    {
        var slot = _keyPool.GetNextSlot();
        var baseUrl = GetBaseUrl(slot.Provider);
        var url = $"{baseUrl}/chat/completions";
        var model = slot.ModelOverride ?? _options.Model;

        var body = new
        {
            model,
            messages = new[] { new { role = "user", content = prompt } },
            temperature = _options.Temperature,
            max_tokens = _options.MaxOutputTokens
        };

        var msg = new HttpRequestMessage(HttpMethod.Post, url)
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

    private static string GetBaseUrl(string provider) => provider switch
    {
        "groq" => "https://api.groq.com/openai/v1",
        "openai" => "https://api.openai.com/v1",
        _ => "https://openrouter.ai/api/v1"
    };

    private static string BuildPrompt(List<string> answers, string language)
    {
        var joined = string.Join("\n", answers.Select(a => $"- {a}"));
        return $@"You are an onboarding analyzer. Return STRICT JSON only.
Schema: {{
  ""jobTitle"": ""string"",
  ""toneOfVoice"": ""string"",
  ""platformPreferences"": [""string"", ...],
  ""targetAudience"": [""string"", ...],
  ""contentFormats"": [""string"", ...],
  ""negativeConstraints"": [""string"", ...]
}}
Rules: 
- language={language}
- platformPreferences, targetAudience, contentFormats, negativeConstraints: max 6 items each, short strings only.
- If answers are too short or lack information, output an empty array [] for that field. Do NOT invent data.
Answers:
{joined}";
    }

    private static ExtractedPersona? ParseResult(string text)
    {
        try
        {
            var parsed = JsonSerializer.Deserialize<ExtractedPersona>(text, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (parsed == null) return null;

            parsed.PlatformPreferences = parsed.PlatformPreferences
                ?.Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim())
                .Where(t => t.Length <= 60).Distinct(StringComparer.OrdinalIgnoreCase).Take(6).ToList()
                ?? new List<string>();

            parsed.TargetAudience = parsed.TargetAudience
                ?.Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim())
                .Where(t => t.Length <= 100).Distinct(StringComparer.OrdinalIgnoreCase).Take(6).ToList()
                ?? new List<string>();

            parsed.ContentFormats = parsed.ContentFormats
                ?.Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim())
                .Where(t => t.Length <= 100).Distinct(StringComparer.OrdinalIgnoreCase).Take(6).ToList()
                ?? new List<string>();

            parsed.NegativeConstraints = parsed.NegativeConstraints
                ?.Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim())
                .Where(t => t.Length <= 100).Distinct(StringComparer.OrdinalIgnoreCase).Take(6).ToList()
                ?? new List<string>();

            return parsed;
        }
        catch { return null; }
    }

    // ── OpenAI-compatible response parser ────────────────────────────────────
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
        var trimmed = text.Trim();

        var match = System.Text.RegularExpressions.Regex.Match(
            trimmed, @"```(?:json)?\s*(.*?)\s*```",
            System.Text.RegularExpressions.RegexOptions.Singleline);
        if (match.Success) trimmed = match.Groups[1].Value.Trim();

        var firstBracket = trimmed.IndexOf('[');
        var firstBrace = trimmed.IndexOf('{');
        int startIdx = -1, endIdx = -1;

        if (firstBracket >= 0 && (firstBrace < 0 || firstBracket < firstBrace))
        { startIdx = firstBracket; endIdx = trimmed.LastIndexOf(']'); }
        else if (firstBrace >= 0)
        { startIdx = firstBrace; endIdx = trimmed.LastIndexOf('}'); }

        return (startIdx >= 0 && endIdx > startIdx)
            ? trimmed.Substring(startIdx, endIdx - startIdx + 1)
            : trimmed;
    }

    private static ExtractedPersona BuildFallback() => new()
    {
        JobTitle = "Unknown",
        ToneOfVoice = "neutral",
        PlatformPreferences = new List<string>(),
        TargetAudience = new List<string>(),
        ContentFormats = new List<string>(),
        NegativeConstraints = new List<string>()
    };

    private async Task<HttpResponseMessage> SendWithRetryAsync(Func<HttpRequestMessage> requestFactory, CancellationToken ct)
    {
        var maxRetryAttempts = _keyPool.KeyCount;
        int delayMs = 1000;

        for (int attempt = 1; attempt <= maxRetryAttempts; attempt++)
        {
            if (_keyPool.AllKeysInCooldown)
            {
                _logger.LogWarning("⛔ Tất cả {Count} API keys đang trong cooldown (Onboarding). Dừng retry ngay.", _keyPool.KeyCount);
                return new HttpResponseMessage((System.Net.HttpStatusCode)429)
                {
                    Content = new System.Net.Http.StringContent("{\"error\":\"all_keys_in_cooldown\"}")
                };
            }

            var request = requestFactory();
            var usedKey = request.Headers.Authorization?.Parameter ?? string.Empty;
            try
            {
                var response = await _client.SendAsync(request, ct);

                if (response.StatusCode == (System.Net.HttpStatusCode)429)
                {
                    _keyPool.MarkRateLimited(usedKey, TimeSpan.FromSeconds(60));
                    _logger.LogWarning("🔄 Key bị rate-limit (429) lần {Attempt}/{MaxAttempts} (Onboarding). Xoay key...", attempt, maxRetryAttempts);
                    if (attempt == maxRetryAttempts) return response;
                    await Task.Delay(200, ct);
                    continue;
                }

                if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    var errBody = await response.Content.ReadAsStringAsync(ct);
                    _logger.LogWarning("🔄 Key 401 Unauthorized (Onboarding) lần {Attempt}/{MaxAttempts}. Body: {Body}. Xoay key...", attempt, maxRetryAttempts, errBody);
                    _keyPool.MarkRateLimited(usedKey, TimeSpan.FromSeconds(300));
                    if (attempt == maxRetryAttempts) return response;
                    await Task.Delay(200, ct);
                    continue;
                }

                if (response.StatusCode == System.Net.HttpStatusCode.ServiceUnavailable ||
                    response.StatusCode == System.Net.HttpStatusCode.BadGateway)
                {
                    _logger.LogWarning("AI API lỗi tạm thời {StatusCode} lần {Attempt}/{MaxAttempts} (Onboarding). Thử lại sau {DelayMs}ms...",
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
                _logger.LogWarning(ex, "Lỗi mạng AI API lần {Attempt}/{MaxAttempts} (Onboarding). Thử lại sau {DelayMs}ms...",
                    attempt, maxRetryAttempts, delayMs);
                await Task.Delay(delayMs, ct);
                delayMs *= 2;
            }
        }

        _logger.LogWarning("⛔ Đã thử hết {Count} keys (Onboarding), tất cả đều bị rate-limit.", _keyPool.KeyCount);
        return new HttpResponseMessage((System.Net.HttpStatusCode)429)
        {
            Content = new System.Net.Http.StringContent("{\"error\":\"all_keys_exhausted\"}")
        };
    }
}
