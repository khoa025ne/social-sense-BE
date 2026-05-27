using System;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HtmlAgilityPack;

namespace SocialSense.Services.Scrapers;

public class WebScraperClient : IWebScraperClient
{
    private readonly HttpClient _httpClient;

    public WebScraperClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<string> ScrapeUrlAsync(string url, CancellationToken ct)
    {
        var html = await _httpClient.GetStringAsync(url, ct);
        if (string.IsNullOrWhiteSpace(html))
        {
            return string.Empty;
        }

        var doc = new HtmlDocument();
        doc.LoadHtml(html);

        // Remove junk tags
        var junkTags = new[] { "head", "script", "style", "nav", "header", "footer", "form", "noscript", "iframe", "svg" };
        foreach (var tag in junkTags)
        {
            var nodes = doc.DocumentNode.SelectNodes($"//{tag}");
            if (nodes != null)
            {
                foreach (var node in nodes)
                {
                    node.Remove();
                }
            }
        }

        var rawText = doc.DocumentNode.InnerText;
        if (string.IsNullOrWhiteSpace(rawText))
        {
            return string.Empty;
        }

        // Clean up whitespace: decode HTML entities, replace multiple spaces/newlines with single space
        var decoded = HtmlEntity.DeEntitize(rawText);
        var cleaned = Regex.Replace(decoded, @"\s+", " ").Trim();

        return cleaned;
    }

    public async Task<string> ScrapeRawAsync(string url, CancellationToken ct)
    {
        var content = await _httpClient.GetStringAsync(url, ct);
        return content ?? string.Empty;
    }
}
