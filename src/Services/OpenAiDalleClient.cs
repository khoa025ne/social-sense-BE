using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SocialSense.Configuration;

namespace SocialSense.Services;

public class OpenAiDalleClient : IImageGenerationClient
{
    private readonly HttpClient _client;
    private readonly ImageGeneratorOptions _options;
    private readonly ILogger<OpenAiDalleClient> _logger;

    public OpenAiDalleClient(
        HttpClient client,
        IOptions<ImageGeneratorOptions> options,
        ILogger<OpenAiDalleClient> logger)
    {
        _client = client;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string?> GenerateImageAsync(string prompt, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey) || _options.ApiKey == "change-me")
        {
            _logger.LogWarning("DALL-E 3 API Key is not configured.");
            return null;
        }

        var requestBody = new
        {
            model = "dall-e-3",
            prompt = prompt,
            n = 1,
            size = "1024x1024"
        };

        var json = JsonSerializer.Serialize(requestBody);
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/images/generations")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

        try
        {
            using var response = await _client.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync(ct);
                _logger.LogError("OpenAI DALL-E 3 API returned error status: {StatusCode}, Details: {Error}", response.StatusCode, errorContent);
                return null;
            }

            var responseBody = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(responseBody);
            if (doc.RootElement.TryGetProperty("data", out var dataArray) && dataArray.GetArrayLength() > 0)
            {
                var firstItem = dataArray[0];
                if (firstItem.TryGetProperty("url", out var urlElement))
                {
                    return urlElement.GetString();
                }
            }

            _logger.LogWarning("OpenAI DALL-E 3 response was successful but could not parse image URL.");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception occurred while calling OpenAI DALL-E 3 API");
            return null;
        }
    }
}
