using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;
using SocialSense.Configuration;
using SocialSense.Services;
using Xunit;

namespace SocialSense.Tests
{
    public class GeminiContextAiExtractorTests
    {
        private readonly Mock<ILogger<GeminiContextAiExtractor>> _mockLogger;

        public GeminiContextAiExtractorTests()
        {
            _mockLogger = new Mock<ILogger<GeminiContextAiExtractor>>();
        }

        private HttpClient CreateMockHttpClient(HttpResponseMessage responseMessage)
        {
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>()
                )
                .ReturnsAsync(responseMessage);

            return new HttpClient(mockHandler.Object);
        }

        [Fact]
        public async Task ExtractPersonaAsync_WhenOptionsDisabled_ReturnsFallback()
        {
            // Arrange
            var options = Options.Create(new GeminiOptions { Enabled = false });
            var client = new HttpClient();
            var extractor = new GeminiContextAiExtractor(client, options, _mockLogger.Object);

            // Act
            var result = await extractor.ExtractPersonaAsync(new List<string> { "ans1" }, "vi", CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Equal("Unknown", result.JobTitle);
            Assert.Equal("neutral", result.ToneOfVoice);
            Assert.Empty(result.TargetAudience);
            Assert.Empty(result.ContentFormats);
            Assert.Empty(result.NegativeConstraints);
        }

        [Fact]
        public async Task ExtractPersonaAsync_WithValidJsonResponse_ParsesSuccessfully()
        {
            // Arrange
            var options = Options.Create(new GeminiOptions
            {
                Enabled = true,
                ApiKey = "fake-key",
                Model = "gemini-1.5-flash",
                Endpoint = "https://generativelanguage.googleapis.com/v1beta"
            });

            var geminiResponseJson = """
            {
                "candidates": [{
                    "content": {
                        "parts": [{
                            "text": "{\n  \"jobTitle\": \"Content Creator\",\n  \"toneOfVoice\": \"fun\",\n  \"platformPreferences\": [\"TikTok\", \"Instagram\"],\n  \"targetAudience\": [\"Students\", \"Gamers\"],\n  \"contentFormats\": [\"Short Video\", \"Memes\"],\n  \"negativeConstraints\": [\"No corporate talk\"]\n}"
                        }]
                    }
                }]
            }
            """;

            var httpResponse = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(geminiResponseJson)
            };
            var httpClient = CreateMockHttpClient(httpResponse);
            var extractor = new GeminiContextAiExtractor(httpClient, options, _mockLogger.Object);

            // Act
            var result = await extractor.ExtractPersonaAsync(new List<string> { "ans1", "ans2", "ans3" }, "vi", CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Equal("Content Creator", result.JobTitle);
            Assert.Equal("fun", result.ToneOfVoice);
            Assert.Equal(new[] { "TikTok", "Instagram" }, result.PlatformPreferences);
            Assert.Equal(new[] { "Students", "Gamers" }, result.TargetAudience);
            Assert.Equal(new[] { "Short Video", "Memes" }, result.ContentFormats);
            Assert.Equal(new[] { "No corporate talk" }, result.NegativeConstraints);
        }

        [Fact]
        public async Task ExtractPersonaAsync_WithCodeFenceResponse_ParsesSuccessfully()
        {
            // Arrange
            var options = Options.Create(new GeminiOptions
            {
                Enabled = true,
                ApiKey = "fake-key",
                Model = "gemini-1.5-flash",
                Endpoint = "https://generativelanguage.googleapis.com/v1beta"
            });

            var geminiResponseJson = """
            {
                "candidates": [{
                    "content": {
                        "parts": [{
                            "text": "```json\n{\n  \"jobTitle\": \"Designer\",\n  \"toneOfVoice\": \"artistic\",\n  \"platformPreferences\": [],\n  \"targetAudience\": [\"Artists\"],\n  \"contentFormats\": [],\n  \"negativeConstraints\": []\n}\n```"
                        }]
                    }
                }]
            }
            """;

            var httpResponse = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(geminiResponseJson)
            };
            var httpClient = CreateMockHttpClient(httpResponse);
            var extractor = new GeminiContextAiExtractor(httpClient, options, _mockLogger.Object);

            // Act
            var result = await extractor.ExtractPersonaAsync(new List<string> { "ans1", "ans2", "ans3" }, "vi", CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Equal("Designer", result.JobTitle);
            Assert.Equal("artistic", result.ToneOfVoice);
            Assert.Empty(result.PlatformPreferences);
            Assert.Equal(new[] { "Artists" }, result.TargetAudience);
            Assert.Empty(result.ContentFormats);
            Assert.Empty(result.NegativeConstraints);
        }

        [Fact]
        public async Task ExtractPersonaAsync_WithMissingFields_FallbackToEmptyLists()
        {
            // Arrange
            var options = Options.Create(new GeminiOptions
            {
                Enabled = true,
                ApiKey = "fake-key",
                Model = "gemini-1.5-flash",
                Endpoint = "https://generativelanguage.googleapis.com/v1beta"
            });

            // JSON response does not have platformPreferences, targetAudience, contentFormats, or negativeConstraints
            var geminiResponseJson = """
            {
                "candidates": [{
                    "content": {
                        "parts": [{
                            "text": "{\n  \"jobTitle\": \"Writer\",\n  \"toneOfVoice\": \"formal\"\n}"
                        }]
                    }
                }]
            }
            """;

            var httpResponse = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(geminiResponseJson)
            };
            var httpClient = CreateMockHttpClient(httpResponse);
            var extractor = new GeminiContextAiExtractor(httpClient, options, _mockLogger.Object);

            // Act
            var result = await extractor.ExtractPersonaAsync(new List<string> { "ans1", "ans2", "ans3" }, "vi", CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Equal("Writer", result.JobTitle);
            Assert.Equal("formal", result.ToneOfVoice);
            Assert.NotNull(result.PlatformPreferences);
            Assert.Empty(result.PlatformPreferences);
            Assert.NotNull(result.TargetAudience);
            Assert.Empty(result.TargetAudience);
            Assert.NotNull(result.ContentFormats);
            Assert.Empty(result.ContentFormats);
            Assert.NotNull(result.NegativeConstraints);
            Assert.Empty(result.NegativeConstraints);
        }
    }
}
