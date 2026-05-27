using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SocialSense.Configuration;
using SocialSense.DTOs.Knowledge;

namespace SocialSense.Services;

public class GeminiKnowledgeExtractor : IKnowledgeExtractor
{
    private readonly HttpClient _client;
    private readonly GeminiOptions _options;
    private readonly GeminiApiKeyPool _keyPool;
    private readonly ILogger<GeminiKnowledgeExtractor> _logger;

    public GeminiKnowledgeExtractor(
        HttpClient client,
        IOptions<GeminiOptions> options,
        GeminiApiKeyPool keyPool,
        ILogger<GeminiKnowledgeExtractor> logger)
    {
        _client = client;
        _options = options.Value;
        _keyPool = keyPool;
        _logger = logger;
    }

    public async Task<GeminiKnowledgeOutput> ExtractKnowledgeAsync(string chunkText, CancellationToken ct)
    {
        if (!_options.Enabled || !_keyPool.HasKeys)
            return BuildFallback(chunkText);

        var prompt = BuildKnowledgePrompt(chunkText);
        Func<HttpRequestMessage> requestFactory = () => BuildRequest(prompt);

        try
        {
            using var response = await SendWithRetryAsync(requestFactory, ct);
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("AI knowledge extraction failed: {StatusCode}. Response: {ErrorBody}", response.StatusCode, errorBody);
                return BuildFallback(chunkText);
            }

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            var text = ExtractText(doc);
            if (string.IsNullOrWhiteSpace(text))
            {
                _logger.LogWarning("AI knowledge extraction response missing text.");
                return BuildFallback(chunkText);
            }

            var cleaned = StripCodeFence(text);
            try
            {
                var output = JsonSerializer.Deserialize<GeminiKnowledgeOutput>(cleaned, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (output != null)
                {
                    if (string.IsNullOrWhiteSpace(output.Title))
                        output.Title = chunkText.Length > 50 ? chunkText[..50] + "..." : chunkText;
                    if (string.IsNullOrWhiteSpace(output.Summary))
                        output.Summary = chunkText.Length > 300 ? chunkText[..300] : chunkText;
                    if (string.IsNullOrWhiteSpace(output.Category))
                        output.Category = "General";
                    output.Insights ??= new List<string>();
                    output.Keywords ??= new List<string>();
                    return output;
                }
            }
            catch (Exception jsonEx)
            {
                _logger.LogWarning(jsonEx, "Failed to deserialize AI knowledge output. Fallback triggered.");
            }

            return BuildFallback(chunkText);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI knowledge extractor error.");
            return BuildFallback(chunkText);
        }
    }

    public async Task<GeminiTrendOutput> ExtractTrendAsync(string text, List<RecentTrendDto> recentTrends, CancellationToken ct)
    {
        if (!_options.Enabled || !_keyPool.HasKeys)
            return BuildTrendFallback(text);

        var prompt = BuildTrendPrompt(text, recentTrends);
        Func<HttpRequestMessage> requestFactory = () => BuildRequest(prompt);

        try
        {
            using var response = await SendWithRetryAsync(requestFactory, ct);
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("AI trend extraction failed: {StatusCode}. Response: {ErrorBody}", response.StatusCode, errorBody);
                return new GeminiTrendOutput { IsTrend = false };
            }

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            var resultText = ExtractText(doc);
            if (string.IsNullOrWhiteSpace(resultText))
                return new GeminiTrendOutput { IsTrend = false };

            var cleaned = StripCodeFence(resultText);
            try
            {
                var output = JsonSerializer.Deserialize<GeminiTrendOutput>(cleaned, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
                return output ?? new GeminiTrendOutput { IsTrend = false };
            }
            catch (Exception jsonEx)
            {
                _logger.LogWarning(jsonEx, "Failed to deserialize AI trend output: {CleanedText}", cleaned);
                return new GeminiTrendOutput { IsTrend = false };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI trend extractor error.");
            return new GeminiTrendOutput { IsTrend = false };
        }
    }

    // ── OpenAI-compatible request builder ────────────────────────────────────
    private HttpRequestMessage BuildRequest(string prompt)
    {
        var slot = _keyPool.GetNextSlot();
        var baseUrl = GetBaseUrl(slot.Provider);
        var url = $"{baseUrl}/chat/completions";

        var body = new
        {
            model = _options.Model,
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

    private static string BuildTrendPrompt(string text, List<RecentTrendDto> recentTrends)
    {
        var trendsListStr = JsonSerializer.Serialize(recentTrends);
        return $@"Analyze the following text and determine if it contains an emerging or hot social media trend.
Return ONLY a STRICT raw JSON string. No markdown code blocks.

Recent trends already in database:
{trendsListStr}

Instructions:
1. Set ""isTrend"" to true or false.
2. If true: compare with recent trends.
   - If matches existing trend: set ""matchedTrendId"" to that trend's id, write updated ""summary"".
   - If new trend: set ""matchedTrendId"" to null, generate ""title"" (max 200 chars), ""summary"" (max 1000 chars), ""hotLevel"" (1-5), ""sentiment"" (positive/negative/neutral), ""tags"".

JSON Schema:
{{
  ""isTrend"": true,
  ""matchedTrendId"": ""guid-or-null"",
  ""title"": ""title here"",
  ""summary"": ""summary here"",
  ""hotLevel"": 3,
  ""sentiment"": ""neutral"",
  ""tags"": [""tag1"", ""tag2""]
}}

Text to analyze:
{text}";
    }

    private static string BuildKnowledgePrompt(string text)
    {
        return $@"Analyze the following text chunk and extract structured information.
Return ONLY a STRICT raw JSON string. No markdown code blocks.

JSON Schema:
{{
  ""title"": ""A concise title summarizing this chunk"",
  ""summary"": ""A condensed summary in 2-3 sentences"",
  ""category"": ""General category (e.g. Marketing, Technology, Finance, Business)"",
  ""insights"": [""Key point #1"", ""Key point #2""],
  ""keywords"": [""Keyword1"", ""Keyword2"", ""Keyword3""]
}}

Text to analyze:
{text}";
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

    private static GeminiKnowledgeOutput BuildFallback(string chunkText) => new()
    {
        Title = chunkText.Length > 50 ? chunkText[..50] + "..." : chunkText,
        Summary = chunkText.Length > 300 ? chunkText[..300] : chunkText,
        Category = "General",
        Insights = new List<string>(),
        Keywords = new List<string>()
    };

    private static GeminiTrendOutput BuildTrendFallback(string text)
    {
        var lines = text.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        var title = "Emerging Trend";
        var summary = text.Length > 500 ? text[..500] + "..." : text;

        foreach (var line in lines)
        {
            if (line.StartsWith("Xu hướng Google Trends:", StringComparison.OrdinalIgnoreCase))
            { title = line.Replace("Xu hướng Google Trends:", "").Trim(); break; }
            if (line.StartsWith("Xu hướng:", StringComparison.OrdinalIgnoreCase))
            { title = line.Replace("Xu hướng:", "").Trim(); break; }
        }

        if (title.Length > 200) title = title[..197] + "...";

        return new GeminiTrendOutput
        {
            IsTrend = true,
            MatchedTrendId = null,
            Title = title,
            Summary = summary,
            HotLevel = 3,
            Sentiment = "neutral",
            Tags = new List<string> { "General", "GoogleTrends" }
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
                _logger.LogWarning("⛔ Tất cả {Count} API keys đang trong cooldown (Knowledge/Trend). Dừng retry ngay.", _keyPool.KeyCount);
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
                    _logger.LogWarning("🔄 Key bị rate-limit (429) lần {Attempt}/{MaxAttempts} (Knowledge/Trend). Xoay key...", attempt, maxRetryAttempts);
                    if (attempt == maxRetryAttempts) return response;
                    await Task.Delay(200, ct);
                    continue;
                }

                if (response.StatusCode == System.Net.HttpStatusCode.ServiceUnavailable ||
                    response.StatusCode == System.Net.HttpStatusCode.BadGateway)
                {
                    _logger.LogWarning("AI API lỗi tạm thời {StatusCode} lần {Attempt}/{MaxAttempts} (Knowledge/Trend). Thử lại sau {DelayMs}ms...",
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
                _logger.LogWarning(ex, "Lỗi mạng AI API lần {Attempt}/{MaxAttempts} (Knowledge/Trend). Thử lại sau {DelayMs}ms...",
                    attempt, maxRetryAttempts, delayMs);
                await Task.Delay(delayMs, ct);
                delayMs *= 2;
            }
        }

        _logger.LogWarning("⛔ Đã thử hết {Count} keys (Knowledge/Trend), tất cả đều bị rate-limit.", _keyPool.KeyCount);
        return new HttpResponseMessage((System.Net.HttpStatusCode)429)
        {
            Content = new System.Net.Http.StringContent("{\"error\":\"all_keys_exhausted\"}")
        };
    }
}
