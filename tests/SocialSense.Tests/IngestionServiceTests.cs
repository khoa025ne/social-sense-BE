using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using SocialSense.Configuration;
using SocialSense.Data;
using SocialSense.DTOs.Knowledge;
using SocialSense.Models;
using SocialSense.Services;
using SocialSense.Services.Parsers;
using SocialSense.Services.Scrapers;
using Xunit;

namespace SocialSense.Tests;

public class IngestionServiceTests
{
    private readonly Mock<IKnowledgeExtractor> _mockExtractor;
    private readonly Mock<IWebScraperClient> _mockScraperClient;
    private readonly Mock<ILogger<KnowledgeIngestionService>> _mockLogger;
    private readonly Mock<IServiceScopeFactory> _mockScopeFactory;
    private readonly IOptions<KnowledgeOptions> _options;

    public IngestionServiceTests()
    {
        _mockExtractor = new Mock<IKnowledgeExtractor>();
        _mockScraperClient = new Mock<IWebScraperClient>();
        _mockLogger = new Mock<ILogger<KnowledgeIngestionService>>();
        _mockScopeFactory = new Mock<IServiceScopeFactory>();

        _options = Options.Create(new KnowledgeOptions
        {
            WebScrapeWhitelist = new List<string> { "wikipedia.org", "dev.to" }
        });
    }

    private AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task IngestManualAsync_SavesSuccessfully()
    {
        // Arrange
        using var db = CreateDbContext();
        var parserFactory = new FileParserFactory();

        var request = new ManualKnowledgeRequest
        {
            Title = "Manual Title Test",
            RawContent = new string('A', 150) // Length >= 100
        };

        var extractedOutput = new GeminiKnowledgeOutput
        {
            Title = "Extracted Title",
            Summary = "Extracted Summary",
            Category = "Technology",
            Insights = new List<string> { "Insight 1" },
            Keywords = new List<string> { "keyword1" }
        };

        _mockExtractor.Setup(x => x.ExtractKnowledgeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(extractedOutput);

        var service = new KnowledgeIngestionService(
            db,
            _mockExtractor.Object,
            _mockScraperClient.Object,
            parserFactory,
            _options,
            _mockLogger.Object,
            _mockScopeFactory.Object
        );

        // Act
        var result = await service.IngestManualAsync(request, CancellationToken.None);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("ManualText", result.SourceType);
        Assert.Equal(request.Title, result.Title);

        // Verify database state
        var savedItem = await db.KnowledgeItems.FirstOrDefaultAsync(x => x.Id == result.Id);
        Assert.NotNull(savedItem);
        Assert.Equal(request.RawContent, savedItem.RawContent);

        var savedChunk = await db.KnowledgeChunks.FirstOrDefaultAsync(x => x.ItemId == result.Id);
        Assert.NotNull(savedChunk);
        Assert.Equal("Technology", savedChunk.Category);
        Assert.Contains("keyword1", savedChunk.KeywordsJson);
    }

    [Fact]
    public async Task IngestManualAsync_ThrowsDuplicateKnowledgeException_WhenContentAlreadyExists()
    {
        // Arrange
        using var db = CreateDbContext();
        var parserFactory = new FileParserFactory();

        var content = "This is some unique content that will be duplicated.";
        // Pre-insert an item with the same hash
        var hash = ComputeSHA256(content);
        
        var existingItem = new KnowledgeItem
        {
            Id = Guid.NewGuid(),
            Title = "Existing",
            SourceType = "ManualText",
            ContentHash = hash,
            RawContent = content,
            CreatedAt = DateTime.UtcNow
        };
        db.KnowledgeItems.Add(existingItem);
        await db.SaveChangesAsync();

        var request = new ManualKnowledgeRequest
        {
            Title = "New Title",
            RawContent = content
        };

        var service = new KnowledgeIngestionService(
            db,
            _mockExtractor.Object,
            _mockScraperClient.Object,
            parserFactory,
            _options,
            _mockLogger.Object,
            _mockScopeFactory.Object
        );

        // Act & Assert
        await Assert.ThrowsAsync<DuplicateKnowledgeException>(() => service.IngestManualAsync(request, CancellationToken.None));
    }

    private static string ComputeSHA256(string input)
    {
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(input);
        var hashBytes = sha256.ComputeHash(bytes);
        var sb = new StringBuilder();
        foreach (var b in hashBytes)
        {
            sb.Append(b.ToString("x2"));
        }
        return sb.ToString();
    }

    [Fact]
    public async Task IngestScrapedAsync_ThrowsUnsupportedWebsiteException_WhenDomainIsNotWhitelisted()
    {
        // Arrange
        using var db = CreateDbContext();
        var parserFactory = new FileParserFactory();
        var request = new ScrapeKnowledgeRequest
        {
            TargetUrl = "https://unsupported-domain.com/article"
        };

        var service = new KnowledgeIngestionService(
            db,
            _mockExtractor.Object,
            _mockScraperClient.Object,
            parserFactory,
            _options,
            _mockLogger.Object,
            _mockScopeFactory.Object
        );

        // Act & Assert
        await Assert.ThrowsAsync<UnsupportedWebsiteException>(() => service.IngestScrapedAsync(request, CancellationToken.None));
    }

    [Fact]
    public async Task IngestFileAsync_ThrowsEmptyContentException_WhenParsedTextTooShort()
    {
        // Arrange
        using var db = CreateDbContext();
        var parserFactory = new FileParserFactory();
        
        // Simulating txt parser via factory with very short content
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes("Too short"));

        var service = new KnowledgeIngestionService(
            db,
            _mockExtractor.Object,
            _mockScraperClient.Object,
            parserFactory,
            _options,
            _mockLogger.Object,
            _mockScopeFactory.Object
        );

        // Act & Assert
        await Assert.ThrowsAsync<EmptyContentException>(() => service.IngestFileAsync("test.txt", stream, CancellationToken.None));
    }

    [Fact]
    public async Task IngestManualAsync_WithTrendDetected_CreatesNewTrendAndTagsSuccessfully()
    {
        // Arrange
        using var db = CreateDbContext();
        var parserFactory = new FileParserFactory();

        var request = new ManualKnowledgeRequest
        {
            Title = "Manual Trend Test",
            RawContent = new string('T', 150)
        };

        var extractedOutput = new GeminiKnowledgeOutput
        {
            Title = "Extracted Title",
            Summary = "Extracted Summary",
            Category = "AI",
            Insights = new List<string> { "Insight 1" },
            Keywords = new List<string> { "AI" }
        };

        var trendOutput = new GeminiTrendOutput
        {
            IsTrend = true,
            MatchedTrendId = null,
            Title = "New AI Breakthrough Trend",
            Summary = "A brand new trend about AI breaking barriers.",
            HotLevel = 4,
            Sentiment = "positive",
            Tags = new List<string> { "AI", "Technology" }
        };

        _mockExtractor.Setup(x => x.ExtractKnowledgeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(extractedOutput);

        _mockExtractor.Setup(x => x.ExtractTrendAsync(It.IsAny<string>(), It.IsAny<List<RecentTrendDto>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(trendOutput);

        var service = new KnowledgeIngestionService(
            db,
            _mockExtractor.Object,
            _mockScraperClient.Object,
            parserFactory,
            _options,
            _mockLogger.Object,
            _mockScopeFactory.Object
        );

        // Act
        var result = await service.IngestManualAsync(request, CancellationToken.None);

        // Assert
        Assert.NotNull(result);
        
        // Verify Trend is created in Db
        var trend = await db.Trends.FirstOrDefaultAsync(t => t.Title == "New AI Breakthrough Trend");
        Assert.NotNull(trend);
        Assert.Equal("A brand new trend about AI breaking barriers.", trend.Summary);
        Assert.Equal(4, trend.HotLevel);
        Assert.Equal("positive", trend.Sentiment);

        // Verify Tags are created and linked
        var tags = await db.Tags.ToListAsync();
        Assert.Contains(tags, t => t.Name == "AI");
        Assert.Contains(tags, t => t.Name == "Technology");

        var trendTags = await db.TrendTags.Where(tt => tt.TrendId == trend.Id).ToListAsync();
        Assert.Equal(2, trendTags.Count);
    }

    [Fact]
    public async Task IngestManualAsync_WithMatchedTrend_UpdatesExistingTrendHotLevel()
    {
        // Arrange
        using var db = CreateDbContext();
        var parserFactory = new FileParserFactory();

        // Pre-insert an existing trend within 24 hours
        var existingTrendId = Guid.NewGuid();
        var existingTrend = new Trend
        {
            Id = existingTrendId,
            Title = "Existing Trend",
            Summary = "Old summary",
            SourceUrl = "internal-knowledge-base",
            HotLevel = 2,
            Sentiment = "neutral",
            CreatedAt = DateTime.UtcNow.AddHours(-2),
            UpdatedAt = DateTime.UtcNow.AddHours(-2)
        };
        db.Trends.Add(existingTrend);
        await db.SaveChangesAsync();

        var request = new ManualKnowledgeRequest
        {
            Title = "Manual Trend Match Test",
            RawContent = new string('M', 150)
        };

        var extractedOutput = new GeminiKnowledgeOutput
        {
            Title = "Extracted Title",
            Summary = "Extracted Summary",
            Category = "AI",
            Insights = new List<string> { "Insight 1" },
            Keywords = new List<string> { "AI" }
        };

        var trendOutput = new GeminiTrendOutput
        {
            IsTrend = true,
            MatchedTrendId = existingTrendId.ToString(),
            Title = "Existing Trend Updated",
            Summary = "Synthesized summary from both old and new data.",
            HotLevel = 3,
            Sentiment = "positive"
        };

        _mockExtractor.Setup(x => x.ExtractKnowledgeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(extractedOutput);

        _mockExtractor.Setup(x => x.ExtractTrendAsync(It.IsAny<string>(), It.IsAny<List<RecentTrendDto>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(trendOutput);

        var service = new KnowledgeIngestionService(
            db,
            _mockExtractor.Object,
            _mockScraperClient.Object,
            parserFactory,
            _options,
            _mockLogger.Object,
            _mockScopeFactory.Object
        );

        // Act
        var result = await service.IngestManualAsync(request, CancellationToken.None);

        // Assert
        Assert.NotNull(result);
        
        // Verify existing trend was updated
        var trendInDb = await db.Trends.FirstOrDefaultAsync(t => t.Id == existingTrendId);
        Assert.NotNull(trendInDb);
        Assert.Equal("Synthesized summary from both old and new data.", trendInDb.Summary);
        Assert.Equal(3, trendInDb.HotLevel); // 2 + 1 = 3
    }

    [Fact]
    public async Task IngestScrapedAsync_WithGoogleTrendsUrl_ParsesRssAndCreatesMultipleTrendsSuccessfully()
    {
        // Arrange
        using var db = CreateDbContext();
        var parserFactory = new FileParserFactory();

        var request = new ScrapeKnowledgeRequest
        {
            TargetUrl = "https://trends.google.com.vn/trending?geo=VN"
        };

        var googleTrendsRssXml = @"<?xml version=""1.0"" encoding=""utf-8""?>
<rss version=""2.0"" xmlns:ht=""http://namespaces.google.com/trends"">
  <channel>
    <title>Daily Search Trends</title>
    <item>
      <title>Manchester United</title>
      <link>https://trends.google.com/trends/trendingsearches/daily?geo=VN#Manchester-United</link>
      <description>Manchester United F.C., Chelsea F.C.</description>
      <ht:approx_traffic>20,000+</ht:approx_traffic>
      <ht:news_item>
        <ht:news_item_title>Manchester United vs Chelsea match analysis</ht:news_item_title>
        <ht:news_item_snippet>The Premier League match ended in an intense draw.</ht:news_item_snippet>
        <ht:news_item_source>VnExpress</ht:news_item_source>
        <ht:news_item_url>https://vnexpress.net/mu-chelsea</ht:news_item_url>
      </ht:news_item>
    </item>
  </channel>
</rss>";

        _mockScraperClient.Setup(x => x.ScrapeRawAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(googleTrendsRssXml);

        var extractedOutput = new GeminiKnowledgeOutput
        {
            Title = "Extracted Title",
            Summary = "Extracted Summary",
            Category = "Sports",
            Insights = new List<string> { "Insight 1" },
            Keywords = new List<string> { "football" }
        };

        _mockExtractor.Setup(x => x.ExtractKnowledgeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(extractedOutput);

        var trendOutput = new GeminiTrendOutput
        {
            IsTrend = true,
            MatchedTrendId = null,
            Title = "Manchester United Trend",
            Summary = "Manchester United has high search interest.",
            HotLevel = 4,
            Sentiment = "neutral",
            Tags = new List<string> { "Football", "Sports" }
        };

        _mockExtractor.Setup(x => x.ExtractTrendAsync(It.IsAny<string>(), It.IsAny<List<RecentTrendDto>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(trendOutput);

        // Setup scope factory mock to return scoped providers
        var mockScope = new Mock<IServiceScope>();
        var mockServiceProvider = new Mock<IServiceProvider>();
        
        mockServiceProvider.Setup(x => x.GetService(typeof(AppDbContext))).Returns(db);
        mockServiceProvider.Setup(x => x.GetService(typeof(IKnowledgeExtractor))).Returns(_mockExtractor.Object);
        mockServiceProvider.Setup(x => x.GetService(typeof(ILogger<KnowledgeIngestionService>))).Returns(_mockLogger.Object);
        
        mockScope.Setup(x => x.ServiceProvider).Returns(mockServiceProvider.Object);
        _mockScopeFactory.Setup(x => x.CreateScope()).Returns(mockScope.Object);

        // Add google.com.vn to whitelist
        var options = Options.Create(new KnowledgeOptions
        {
            WebScrapeWhitelist = new List<string> { "google.com.vn", "trends.google.com.vn" }
        });

        var service = new KnowledgeIngestionService(
            db,
            _mockExtractor.Object,
            _mockScraperClient.Object,
            parserFactory,
            options,
            _mockLogger.Object,
            _mockScopeFactory.Object
        );

        // Act
        var result = await service.IngestScrapedAsync(request, CancellationToken.None);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Google Trends: Manchester United", result.Title);

        // Verify Trend was created
        var trend = await db.Trends.FirstOrDefaultAsync(t => t.Title == "Manchester United Trend");
        Assert.NotNull(trend);
        Assert.Equal(4, trend.HotLevel);
        
        var tags = await db.Tags.ToListAsync();
        Assert.Contains(tags, t => t.Name == "Football");
    }
}
