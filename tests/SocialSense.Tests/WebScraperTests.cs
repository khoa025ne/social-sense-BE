using System;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Moq;
using Moq.Protected;
using SocialSense.Services.Scrapers;
using Xunit;

namespace SocialSense.Tests;

public class WebScraperTests
{
    [Fact]
    public async Task WebScraperClient_ScrapesAndCleansHtmlCorrectly()
    {
        // Arrange
        var htmlContent = @"
            <html>
                <head><title>Test</title></head>
                <body>
                    <header><h1>Header Title</h1></header>
                    <nav><a href='#'>Link</a></nav>
                    <main>
                        <p>This is the main article content.</p>
                        <script>console.log('Ignore me');</script>
                        <style>body { color: red; }</style>
                        <p>Another paragraph.</p>
                    </main>
                    <footer>Copyright</footer>
                </body>
            </html>";

        var mockHandler = new Mock<HttpMessageHandler>();
        mockHandler.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>()
            )
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(htmlContent)
            });

        var httpClient = new HttpClient(mockHandler.Object);
        var scraper = new WebScraperClient(httpClient);

        // Act
        var result = await scraper.ScrapeUrlAsync("https://wikipedia.org/wiki/Test", CancellationToken.None);

        // Assert
        Assert.NotNull(result);
        // Script, Style, Nav, Header, Footer should be removed
        Assert.DoesNotContain("console.log", result);
        Assert.DoesNotContain("color: red", result);
        Assert.DoesNotContain("Link", result);
        Assert.DoesNotContain("Header Title", result);
        Assert.DoesNotContain("Copyright", result);
        // Main content should exist
        Assert.Contains("This is the main article content.", result);
        Assert.Contains("Another paragraph.", result);
        // Whitespace normalized
        Assert.Equal("This is the main article content. Another paragraph.", result);
    }
}
