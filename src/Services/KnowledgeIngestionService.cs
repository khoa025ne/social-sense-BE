using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Xml.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SocialSense.Configuration;
using SocialSense.Data;
using SocialSense.DTOs.Knowledge;
using SocialSense.Models;
using SocialSense.Services.Parsers;
using SocialSense.Services.Scrapers;

namespace SocialSense.Services;

public class KnowledgeIngestionService : IKnowledgeIngestionService
{
    private readonly AppDbContext _db;
    private readonly IKnowledgeExtractor _extractor;
    private readonly IWebScraperClient _scraperClient;
    private readonly FileParserFactory _parserFactory;
    private readonly KnowledgeOptions _options;
    private readonly ILogger<KnowledgeIngestionService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
 
    public KnowledgeIngestionService(
        AppDbContext db,
        IKnowledgeExtractor extractor,
        IWebScraperClient scraperClient,
        FileParserFactory parserFactory,
        IOptions<KnowledgeOptions> options,
        ILogger<KnowledgeIngestionService> logger,
        IServiceScopeFactory scopeFactory)
    {
        _db = db;
        _extractor = extractor;
        _scraperClient = scraperClient;
        _parserFactory = parserFactory;
        _options = options.Value;
        _logger = logger;
        _scopeFactory = scopeFactory;
    }

    public async Task<KnowledgeItem> IngestManualAsync(ManualKnowledgeRequest request, CancellationToken ct)
    {
        var hash = ComputeSHA256(request.RawContent);
        await CheckDeduplicationAsync(hash, ct);

        var item = new KnowledgeItem
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            SourceType = "ManualText",
            SourceUrlOrFileName = null,
            ContentHash = hash,
            RawContent = request.RawContent,
            CreatedAt = DateTime.UtcNow
        };

        await ProcessAndIngestItemAsync(item, ct);
        return item;
    }

    public async Task<KnowledgeItem> IngestScrapedAsync(ScrapeKnowledgeRequest request, CancellationToken ct)
    {
        // 1. Validate Whitelist Domain
        Uri uri;
        try
        {
            uri = new Uri(request.TargetUrl);
        }
        catch (Exception ex)
        {
            throw new ArgumentException("Invalid URL format.", ex);
        }

        var host = uri.Host;
        bool isWhitelisted = false;
        foreach (var domain in _options.WebScrapeWhitelist)
        {
            if (host.Equals(domain, StringComparison.OrdinalIgnoreCase) || host.EndsWith("." + domain, StringComparison.OrdinalIgnoreCase))
            {
                isWhitelisted = true;
                break;
            }
        }

        if (!isWhitelisted)
        {
            throw new UnsupportedWebsiteException("UNSUPPORTED_WEBSITE_SOURCE");
        }

        // Handle Google Trends URL specifically
        if (host.Contains("trends.google"))
        {
            return await IngestGoogleTrendsAsync(request.TargetUrl, ct);
        }

        // 2. Scrape raw content
        var rawContent = await _scraperClient.ScrapeUrlAsync(request.TargetUrl, ct);
        if (string.IsNullOrWhiteSpace(rawContent) || rawContent.Trim().Length < 50)
        {
            throw new EmptyContentException("CANNOT_EXTRACT_TEXT_FROM_FILE");
        }

        var hash = ComputeSHA256(rawContent);
        await CheckDeduplicationAsync(hash, ct);

        // Derive Title from URL or a placeholder
        var title = uri.Segments.LastOrDefault()?.Trim('/') ?? "Web Article";
        if (string.IsNullOrWhiteSpace(title) || title.Length < 5)
        {
            title = $"Scraped content from {host}";
        }
        if (title.Length > 250)
        {
            title = title.Substring(0, 247) + "...";
        }

        var item = new KnowledgeItem
        {
            Id = Guid.NewGuid(),
            Title = title,
            SourceType = "WebScraper",
            SourceUrlOrFileName = request.TargetUrl,
            ContentHash = hash,
            RawContent = rawContent,
            CreatedAt = DateTime.UtcNow
        };

        await ProcessAndIngestItemAsync(item, ct);
        return item;
    }

    public async Task<KnowledgeItem> IngestFileAsync(string fileName, Stream fileStream, CancellationToken ct)
    {
        var ext = Path.GetExtension(fileName);
        var allowedExtensions = new[] { ".txt", ".md", ".docx", ".pdf" };
        if (!allowedExtensions.Contains(ext, StringComparer.OrdinalIgnoreCase))
        {
            throw new InvalidFileException("INVALID_FILE_FORMAT");
        }

        // Parse content
        var parser = _parserFactory.GetParser(ext);
        var rawContent = await parser.ParseAsync(fileStream, ct);

        if (string.IsNullOrWhiteSpace(rawContent) || rawContent.Trim().Length < 50)
        {
            throw new EmptyContentException("CANNOT_EXTRACT_TEXT_FROM_FILE");
        }

        var hash = ComputeSHA256(rawContent);
        await CheckDeduplicationAsync(hash, ct);

        var sourceType = ext.ToLowerInvariant() switch
        {
            ".txt" => "ManualText",
            ".pdf" => "PDF",
            ".docx" => "DOCX",
            ".md" => "Markdown",
            _ => "ManualText"
        };

        var title = Path.GetFileNameWithoutExtension(fileName);
        if (title.Length > 250)
        {
            title = title.Substring(0, 247) + "...";
        }

        var item = new KnowledgeItem
        {
            Id = Guid.NewGuid(),
            Title = title,
            SourceType = sourceType,
            SourceUrlOrFileName = fileName,
            ContentHash = hash,
            RawContent = rawContent,
            CreatedAt = DateTime.UtcNow
        };

        await ProcessAndIngestItemAsync(item, ct);
        return item;
    }

    private async Task CheckDeduplicationAsync(string hash, CancellationToken ct)
    {
        var exists = await _db.KnowledgeItems.AnyAsync(x => x.ContentHash == hash, ct);
        if (exists)
        {
            throw new DuplicateKnowledgeException("KNOWLEDGE_ALREADY_EXISTS");
        }
    }

    private async Task ProcessAndIngestItemAsync(KnowledgeItem item, CancellationToken ct)
    {
        // 1. Chunking
        var chunksText = ChunkText(item.RawContent);
        var chunks = new List<KnowledgeChunk>();

        // Save Item first so foreign key constraints are met
        _db.KnowledgeItems.Add(item);
        await _db.SaveChangesAsync(ct);

        for (int i = 0; i < chunksText.Count; i++)
        {
            var chunkText = chunksText[i];
            
            // Rate limiting - delay 4 seconds between AI calls (Gemini Free Tier Rate Limits)
            if (i > 0)
            {
                await Task.Delay(4000, ct);
            }

            // AI Insight Extraction
            var aiOutput = await _extractor.ExtractKnowledgeAsync(chunkText, ct);

            var chunk = new KnowledgeChunk
            {
                Id = Guid.NewGuid(),
                ItemId = item.Id,
                ChunkText = chunkText,
                AiSummary = aiOutput.Summary,
                AiInsightsJson = JsonSerializer.Serialize(aiOutput.Insights),
                Category = aiOutput.Category,
                KeywordsJson = JsonSerializer.Serialize(aiOutput.Keywords)
            };

            chunks.Add(chunk);


        }

        // Save chunks to DB
        _db.KnowledgeChunks.AddRange(chunks);
        await _db.SaveChangesAsync(ct);

        // Auto extract or update trend dynamically (Non-blocking)
        await AutoExtractTrendAsync(item, ct);
    }

    private async Task AutoExtractTrendAsync(KnowledgeItem item, CancellationToken ct)
    {
        try
        {
            // 1. Get recent trends (past 24 hours)
            var oneDayAgo = DateTime.UtcNow.AddDays(-1);
            var recentTrends = await _db.Trends
                .AsNoTracking()
                .Where(t => t.CreatedAt >= oneDayAgo)
                .Select(t => new RecentTrendDto
                {
                    Id = t.Id,
                    Title = t.Title
                })
                .ToListAsync(ct);

            // 2. Dùng tối đa 1500 ký tự đầu làm đại diện cho trend analysis — đủ context, ít token hơn
            var sampleText = item.RawContent.Length > 1500 ? item.RawContent.Substring(0, 1500) : item.RawContent;

            // 3. Call AI to extract trend
            var aiOutput = await _extractor.ExtractTrendAsync(sampleText, recentTrends, ct);
            if (aiOutput == null || !aiOutput.IsTrend)
            {
                return;
            }

            // 4. Update or Create Trend
            if (!string.IsNullOrWhiteSpace(aiOutput.MatchedTrendId) && Guid.TryParse(aiOutput.MatchedTrendId, out var matchedId))
            {
                var existingTrend = await _db.Trends.FirstOrDefaultAsync(t => t.Id == matchedId, ct);
                if (existingTrend != null)
                {
                    // Update trend (Ý 3 & Ý 4)
                    existingTrend.Summary = aiOutput.Summary.Length > 1000 ? aiOutput.Summary.Substring(0, 997) + "..." : aiOutput.Summary;
                    existingTrend.HotLevel = Math.Min(existingTrend.HotLevel + 1, 5); // Tăng độ nóng
                    existingTrend.UpdatedAt = DateTime.UtcNow;

                    _db.Trends.Update(existingTrend);
                    _logger.LogInformation("Trend '{Title}' (ID: {Id}) updated and HotLevel incremented.", existingTrend.Title, existingTrend.Id);
                }
            }
            else
            {
                // Create a new Trend (Ý 1)
                var newTrend = new Trend
                {
                    Id = Guid.NewGuid(),
                    Title = aiOutput.Title.Length > 200 ? aiOutput.Title.Substring(0, 197) + "..." : aiOutput.Title,
                    Summary = aiOutput.Summary.Length > 1000 ? aiOutput.Summary.Substring(0, 997) + "..." : aiOutput.Summary,
                    SourceUrl = item.SourceUrlOrFileName ?? "internal-knowledge-base",
                    HotLevel = Math.Clamp(aiOutput.HotLevel, 1, 5),
                    Sentiment = string.IsNullOrWhiteSpace(aiOutput.Sentiment) ? "neutral" : aiOutput.Sentiment.ToLowerInvariant(),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.Trends.Add(newTrend);
                _logger.LogInformation("New Trend '{Title}' created dynamically from KnowledgeItem.", newTrend.Title);

                // Handle Tags
                if (aiOutput.Tags != null && aiOutput.Tags.Count > 0)
                {
                    foreach (var tagName in aiOutput.Tags)
                    {
                        var slug = GenerateSlug(tagName);
                        var tag = await _db.Tags.FirstOrDefaultAsync(t => t.Slug == slug, ct);
                        if (tag == null)
                        {
                            tag = new Tag
                            {
                                Id = Guid.NewGuid(),
                                Name = tagName.Length > 60 ? tagName.Substring(0, 60) : tagName,
                                Slug = slug
                            };
                            _db.Tags.Add(tag);
                        }

                        var trendTag = new TrendTag
                        {
                            TrendId = newTrend.Id,
                            TagId = tag.Id
                        };
                        _db.TrendTags.Add(trendTag);
                    }
                }
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to automatically extract or update trend for KnowledgeItem {ItemId} (Non-blocking)", item.Id);
        }
    }

    private static string GenerateSlug(string phrase)
    {
        var str = phrase.ToLowerInvariant();
        str = RemoveAccents(str);
        str = System.Text.RegularExpressions.Regex.Replace(str, @"[^a-z0-9\s-]", "");
        str = System.Text.RegularExpressions.Regex.Replace(str, @"\s+", " ").Trim();
        str = str.Substring(0, Math.Min(str.Length, 80));
        str = System.Text.RegularExpressions.Regex.Replace(str, @"\s", "-");
        return str;
    }

    private static string RemoveAccents(string text)
    {
        var stringBuilder = new StringBuilder();
        var normalizedString = text.Normalize(NormalizationForm.FormD);
        foreach (var c in normalizedString)
        {
            var unicodeCategory = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c);
            if (unicodeCategory != System.Globalization.UnicodeCategory.NonSpacingMark)
            {
                stringBuilder.Append(c);
            }
        }
        return stringBuilder.ToString().Normalize(NormalizationForm.FormC);
    }

    public static List<string> ChunkText(string text, int chunkSize = 1500, int overlap = 200)
    {
        var chunks = new List<string>();
        if (string.IsNullOrWhiteSpace(text))
        {
            return chunks;
        }

        if (text.Length <= chunkSize)
        {
            chunks.Add(text);
            return chunks;
        }

        int start = 0;
        while (start < text.Length)
        {
            int end = Math.Min(start + chunkSize, text.Length);
            var chunk = text.Substring(start, end - start);
            chunks.Add(chunk);
            if (end == text.Length)
            {
                break;
            }
            start += (chunkSize - overlap);
        }

        return chunks;
    }

    private static string ComputeSHA256(string input)
    {
        using var sha256 = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(input);
        var hashBytes = sha256.ComputeHash(bytes);
        var sb = new StringBuilder();
        foreach (var b in hashBytes)
        {
            sb.Append(b.ToString("x2"));
        }
        return sb.ToString();
    }

    private async Task<KnowledgeItem> IngestGoogleTrendsAsync(string targetUrl, CancellationToken ct)
    {
        // 1. Convert normal Google Trends URL to RSS URL
        var rssUrl = targetUrl;
        if (rssUrl.Contains("/trending") && !rssUrl.Contains("/trending/rss"))
        {
            rssUrl = rssUrl.Replace("/trending", "/trending/rss");
        }

        // 2. Scrape raw RSS XML content
        var xmlContent = await _scraperClient.ScrapeRawAsync(rssUrl, ct);
        if (string.IsNullOrWhiteSpace(xmlContent))
        {
            throw new EmptyContentException("CANNOT_EXTRACT_TEXT_FROM_FILE");
        }

        // 3. Parse RSS XML into individual trends
        var rssItems = ParseGoogleTrendsRss(xmlContent);
        if (rssItems.Count == 0)
        {
            throw new EmptyContentException("CANNOT_EXTRACT_TEXT_FROM_FILE");
        }

        // 4. Transform into distinct KnowledgeItems
        var knowledgeItemsToIngest = new List<KnowledgeItem>();
        foreach (var rssItem in rssItems)
        {
            var contentBuilder = new StringBuilder();
            contentBuilder.AppendLine($"Xu hướng Google Trends: {rssItem.Title}");
            if (!string.IsNullOrWhiteSpace(rssItem.ApproxTraffic))
            {
                contentBuilder.AppendLine($"Lượng tìm kiếm ước tính: {rssItem.ApproxTraffic}");
            }
            if (!string.IsNullOrWhiteSpace(rssItem.Description))
            {
                contentBuilder.AppendLine($"Mô tả xu hướng: {rssItem.Description}");
            }
            if (!string.IsNullOrWhiteSpace(rssItem.NewsContext))
            {
                contentBuilder.AppendLine("Các nguồn tin liên quan:");
                contentBuilder.AppendLine(rssItem.NewsContext);
            }

            var rawContent = contentBuilder.ToString();
            var hash = ComputeSHA256(rawContent);

            // Skip duplication check during batch ingestion to prevent blocking, but still apply locally
            var exists = await _db.KnowledgeItems.AnyAsync(x => x.ContentHash == hash, ct);
            if (exists)
            {
                continue;
            }

            var item = new KnowledgeItem
            {
                Id = Guid.NewGuid(),
                Title = $"Google Trends: {rssItem.Title}",
                SourceType = "WebScraper",
                SourceUrlOrFileName = rssItem.SourceUrl,
                ContentHash = hash,
                RawContent = rawContent,
                CreatedAt = DateTime.UtcNow
            };
            knowledgeItemsToIngest.Add(item);
        }

        if (knowledgeItemsToIngest.Count == 0)
        {
            throw new DuplicateKnowledgeException("KNOWLEDGE_ALREADY_EXISTS");
        }

        // 5. Ingest the first trend synchronously to return a valid KnowledgeItem immediately
        var firstItem = knowledgeItemsToIngest[0];
        await ProcessAndIngestItemAsync(firstItem, ct);

        // 6. Ingest the remaining trends asynchronously in a background task
        if (knowledgeItemsToIngest.Count > 1)
        {
            var remainingItems = knowledgeItemsToIngest.Skip(1).ToList();
            _ = Task.Run(async () =>
            {
                foreach (var item in remainingItems)
                {
                    try
                    {
                        using var scope = _scopeFactory.CreateScope();
                        var scopedDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                        var scopedExtractor = scope.ServiceProvider.GetRequiredService<IKnowledgeExtractor>();
                        var scopedLogger = scope.ServiceProvider.GetRequiredService<ILogger<KnowledgeIngestionService>>();

                        await ProcessAndIngestScopedItemAsync(
                            item, 
                            scopedDb, 
                            scopedExtractor, 
                            scopedLogger, 
                            CancellationToken.None
                        );
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to ingest background Google Trend item: {Title}", item.Title);
                    }
                }
            });
        }

        return firstItem;
    }

    private List<GoogleTrendRssItem> ParseGoogleTrendsRss(string xmlContent)
    {
        var results = new List<GoogleTrendRssItem>();
        try
        {
            var doc = XDocument.Parse(xmlContent);
            XNamespace ht = "http://namespaces.google.com/trends";
            var items = doc.Descendants("item");

            foreach (var item in items)
            {
                var title = item.Element("title")?.Value ?? string.Empty;
                var description = item.Element("description")?.Value ?? string.Empty;
                var approxTraffic = item.Element(ht + "approx_traffic")?.Value ?? string.Empty;
                var sourceUrl = item.Element("link")?.Value ?? string.Empty;

                var newsBuilder = new StringBuilder();
                var newsItems = item.Elements(ht + "news_item");
                foreach (var ni in newsItems)
                {
                    var niTitle = ni.Element(ht + "news_item_title")?.Value;
                    var niSnippet = ni.Element(ht + "news_item_snippet")?.Value;
                    var niSource = ni.Element(ht + "news_item_source")?.Value;
                    var niUrl = ni.Element(ht + "news_item_url")?.Value;

                    newsBuilder.AppendLine($"- Tin tức: {niTitle}");
                    if (!string.IsNullOrWhiteSpace(niSource))
                    {
                        newsBuilder.AppendLine($"  Nguồn: {niSource}");
                    }
                    if (!string.IsNullOrWhiteSpace(niSnippet))
                    {
                        newsBuilder.AppendLine($"  Tóm tắt: {niSnippet}");
                    }
                    if (!string.IsNullOrWhiteSpace(niUrl))
                    {
                        newsBuilder.AppendLine($"  Link: {niUrl}");
                    }
                }

                results.Add(new GoogleTrendRssItem
                {
                    Title = title,
                    ApproxTraffic = approxTraffic,
                    Description = description,
                    NewsContext = newsBuilder.ToString(),
                    SourceUrl = sourceUrl
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse Google Trends RSS XML.");
        }
        return results;
    }

    private async Task ProcessAndIngestScopedItemAsync(
        KnowledgeItem item,
        AppDbContext db,
        IKnowledgeExtractor extractor,
        ILogger logger,
        CancellationToken ct)
    {
        // 1. Chunking
        var chunksText = ChunkText(item.RawContent);
        var chunks = new List<KnowledgeChunk>();

        // Save Item first so foreign key constraints are met
        db.KnowledgeItems.Add(item);
        await db.SaveChangesAsync(ct);

        for (int i = 0; i < chunksText.Count; i++)
        {
            var chunkText = chunksText[i];
            
            // Rate limiting - delay 4 seconds between AI calls (Gemini Free Tier Rate Limits)
            if (i > 0)
            {
                await Task.Delay(4000, ct);
            }

            // AI Insight Extraction
            var aiOutput = await extractor.ExtractKnowledgeAsync(chunkText, ct);

            var chunk = new KnowledgeChunk
            {
                Id = Guid.NewGuid(),
                ItemId = item.Id,
                ChunkText = chunkText,
                AiSummary = aiOutput.Summary,
                AiInsightsJson = JsonSerializer.Serialize(aiOutput.Insights),
                Category = aiOutput.Category,
                KeywordsJson = JsonSerializer.Serialize(aiOutput.Keywords)
            };

            chunks.Add(chunk);
        }

        // Save chunks to DB
        db.KnowledgeChunks.AddRange(chunks);
        await db.SaveChangesAsync(ct);

        // Auto extract or update trend dynamically (Non-blocking)
        await AutoExtractTrendScopedAsync(item, db, extractor, logger, ct);
    }

    private async Task AutoExtractTrendScopedAsync(
        KnowledgeItem item,
        AppDbContext db,
        IKnowledgeExtractor extractor,
        ILogger logger,
        CancellationToken ct)
    {
        try
        {
            // 1. Get recent trends (past 24 hours)
            var oneDayAgo = DateTime.UtcNow.AddDays(-1);
            var recentTrends = await db.Trends
                .AsNoTracking()
                .Where(t => t.CreatedAt >= oneDayAgo)
                .Select(t => new RecentTrendDto
                {
                    Id = t.Id,
                    Title = t.Title
                })
                .ToListAsync(ct);

            // 2. Dùng tối đa 1500 ký tự đầu làm đại diện cho trend analysis — đủ context, ít token hơn
            var sampleText = item.RawContent.Length > 1500 ? item.RawContent.Substring(0, 1500) : item.RawContent;

            // 3. Call AI to extract trend
            var aiOutput = await extractor.ExtractTrendAsync(sampleText, recentTrends, ct);
            if (aiOutput == null || !aiOutput.IsTrend)
            {
                return;
            }

            // 4. Update or Create Trend
            if (!string.IsNullOrWhiteSpace(aiOutput.MatchedTrendId) && Guid.TryParse(aiOutput.MatchedTrendId, out var matchedId))
            {
                var existingTrend = await db.Trends.FirstOrDefaultAsync(t => t.Id == matchedId, ct);
                if (existingTrend != null)
                {
                    // Update trend (Ý 3 & Ý 4)
                    existingTrend.Summary = aiOutput.Summary.Length > 1000 ? aiOutput.Summary.Substring(0, 997) + "..." : aiOutput.Summary;
                    existingTrend.HotLevel = Math.Min(existingTrend.HotLevel + 1, 5); // Tăng độ nóng
                    existingTrend.UpdatedAt = DateTime.UtcNow;

                    db.Trends.Update(existingTrend);
                    logger.LogInformation("Trend '{Title}' (ID: {Id}) updated and HotLevel incremented.", existingTrend.Title, existingTrend.Id);
                }
            }
            else
            {
                // Create a new Trend (Ý 1)
                var newTrend = new Trend
                {
                    Id = Guid.NewGuid(),
                    Title = aiOutput.Title.Length > 200 ? aiOutput.Title.Substring(0, 197) + "..." : aiOutput.Title,
                    Summary = aiOutput.Summary.Length > 1000 ? aiOutput.Summary.Substring(0, 997) + "..." : aiOutput.Summary,
                    SourceUrl = item.SourceUrlOrFileName ?? "internal-knowledge-base",
                    HotLevel = Math.Clamp(aiOutput.HotLevel, 1, 5),
                    Sentiment = string.IsNullOrWhiteSpace(aiOutput.Sentiment) ? "neutral" : aiOutput.Sentiment.ToLowerInvariant(),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                db.Trends.Add(newTrend);
                logger.LogInformation("New Trend '{Title}' created dynamically from KnowledgeItem.", newTrend.Title);

                // Handle Tags
                if (aiOutput.Tags != null && aiOutput.Tags.Count > 0)
                {
                    foreach (var tagName in aiOutput.Tags)
                    {
                        var slug = GenerateSlug(tagName);
                        var tag = await db.Tags.FirstOrDefaultAsync(t => t.Slug == slug, ct);
                        if (tag == null)
                        {
                            tag = new Tag
                            {
                                Id = Guid.NewGuid(),
                                Name = tagName.Length > 60 ? tagName.Substring(0, 60) : tagName,
                                Slug = slug
                            };
                            db.Tags.Add(tag);
                        }

                        var trendTag = new TrendTag
                        {
                            TrendId = newTrend.Id,
                            TagId = tag.Id
                        };
                        db.TrendTags.Add(trendTag);
                    }
                }
            }

            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to automatically extract or update trend for KnowledgeItem {ItemId} (Non-blocking)", item.Id);
        }
    }

    private class GoogleTrendRssItem
    {
        public string Title { get; set; } = string.Empty;
        public string ApproxTraffic { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string NewsContext { get; set; } = string.Empty;
        public string SourceUrl { get; set; } = string.Empty;
    }
}
