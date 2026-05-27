using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;
using SocialSense.Configuration;
using SocialSense.Data;
using SocialSense.DTOs.Content;
using SocialSense.Models;
using SocialSense.Services;
using Xunit;

namespace SocialSense.Tests
{
    public class ContentHistoryServiceTests
    {
        private readonly Mock<ILogger<ContentHistoryService>> _mockLogger;

        public ContentHistoryServiceTests()
        {
            _mockLogger = new Mock<ILogger<ContentHistoryService>>();
        }

        private AppDbContext CreateDbContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            return new AppDbContext(options);
        }

        [Fact]
        public async Task SaveHistoryAsync_SavesSuccessfully_WhenDataIsValid()
        {
            // Arrange
            using var db = CreateDbContext();
            var service = new ContentHistoryService(db, _mockLogger.Object);
            var userId = "user-123";
            var trendId = Guid.NewGuid();
            var contentJson = "[{\"platform\":\"Facebook\",\"body\":\"Hello\"}]";

            // Act
            await service.SaveHistoryAsync(userId, trendId, contentJson, CancellationToken.None);

            // Assert
            var history = await db.ContentHistories.FirstOrDefaultAsync();
            Assert.NotNull(history);
            Assert.Equal(userId, history.UserId);
            Assert.Equal(trendId, history.OriginalTrendId);
            Assert.Equal(contentJson, history.GeneratedContent);
            Assert.False(history.IsEdited);
            Assert.Null(history.UserEditedContent);
        }

        [Fact]
        public async Task GetHistoryAsync_ReturnsPaginatedHistory_Correctly()
        {
            // Arrange
            using var db = CreateDbContext();
            var userId = "user-123";
            var trendId = Guid.NewGuid();

            var historyItems = new List<ContentHistory>
            {
                new ContentHistory
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    OriginalTrendId = trendId,
                    GeneratedContent = "[{\"platform\":\"Facebook\",\"hook\":\"H1\",\"body\":\"B1\",\"cta\":\"C1\",\"hashtags\":[\"#tag\"]}]",
                    CreatedAt = DateTime.UtcNow.AddMinutes(-5)
                },
                new ContentHistory
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    OriginalTrendId = trendId,
                    GeneratedContent = "[{\"platform\":\"LinkedIn\",\"hook\":\"H2\",\"body\":\"B2\",\"cta\":\"C2\",\"hashtags\":[]}]",
                    UserEditedContent = "{\"title\":\"EditedTitle\",\"body\":\"EditedBody\",\"hashtags\":[\"#new\"]}",
                    IsEdited = true,
                    CreatedAt = DateTime.UtcNow
                },
                new ContentHistory
                {
                    Id = Guid.NewGuid(),
                    UserId = "other-user",
                    OriginalTrendId = trendId,
                    GeneratedContent = "[]",
                    CreatedAt = DateTime.UtcNow
                }
            };

            db.ContentHistories.AddRange(historyItems);
            await db.SaveChangesAsync();

            var service = new ContentHistoryService(db, _mockLogger.Object);

            // Act - Page 1, Size 1 (should return the latest item, i.e. the LinkedIn one)
            var response = await service.GetHistoryAsync(userId, 1, 1, CancellationToken.None);

            // Assert
            Assert.NotNull(response);
            Assert.Equal(2, response.TotalCount); // userId has 2 items in total
            Assert.Equal(1, response.Page);
            Assert.Equal(1, response.PageSize);
            Assert.Single(response.Items);

            var item = response.Items[0];
            Assert.Equal(userId, item.UserId);
            Assert.True(item.IsEdited);
            Assert.NotNull(item.UserEditedContent);
            Assert.Equal("EditedBody", item.UserEditedContent.Body);
            Assert.Single(item.GeneratedContent);
            Assert.Equal("LinkedIn", item.GeneratedContent[0].Platform);
        }

        [Fact]
        public async Task EditHistoryAsync_UpdatesHistoryAndSetsIsEditedToTrue_WhenHistoryExists()
        {
            // Arrange
            using var db = CreateDbContext();
            var service = new ContentHistoryService(db, _mockLogger.Object);
            var historyId = Guid.NewGuid();
            var history = new ContentHistory
            {
                Id = historyId,
                UserId = "user-123",
                GeneratedContent = "[]",
                IsEdited = false,
                CreatedAt = DateTime.UtcNow
            };
            db.ContentHistories.Add(history);
            await db.SaveChangesAsync();

            var request = new EditHistoryContentRequest
            {
                Title = "Updated Title",
                Body = "Updated Body Content",
                Hashtags = new List<string> { "#test" }
            };

            // Act
            var result = await service.EditHistoryAsync(historyId, request, CancellationToken.None);

            // Assert
            Assert.True(result);
            var updatedHistory = await db.ContentHistories.FirstOrDefaultAsync(h => h.Id == historyId);
            Assert.NotNull(updatedHistory);
            Assert.True(updatedHistory.IsEdited);
            Assert.NotNull(updatedHistory.UserEditedContent);
            Assert.Contains("Updated Body Content", updatedHistory.UserEditedContent);
        }

        [Fact]
        public async Task EditHistoryAsync_ReturnsFalse_WhenHistoryDoesNotExist()
        {
            // Arrange
            using var db = CreateDbContext();
            var service = new ContentHistoryService(db, _mockLogger.Object);
            var request = new EditHistoryContentRequest { Body = "New Content" };

            // Act
            var result = await service.EditHistoryAsync(Guid.NewGuid(), request, CancellationToken.None);

            // Assert
            Assert.False(result);
        }

        [Fact]
        public async Task ContentGeneratorService_SaveHistoryException_DoesNotBlockResult()
        {
            // Arrange
            using var db = CreateDbContext();
            var trendId = Guid.NewGuid();
            var trend = new Trend
            {
                Id = trendId,
                Title = "AI Future",
                Summary = "Summary of AI Future",
                SourceUrl = "https://example.com"
            };
            db.Trends.Add(trend);
            await db.SaveChangesAsync();

            db.UserContexts.Add(new UserContext
            {
                Id = Guid.NewGuid(),
                UserId = "user-123",
                Version = 1,
                JobTitle = "Tech Blogger",
                ToneOfVoice = "Friendly",
                Language = "vi",
                PlatformPreferencesJson = "[\"Facebook\"]",
                IsActive = true
            });
            await db.SaveChangesAsync();

            var geminiResponseJson = """
            {
                "candidates": [{
                    "content": {
                        "parts": [{
                            "text": "[{\"platform\":\"Facebook\",\"hook\":\"Awesome hook\",\"body\":\"Great content about AI Future\",\"cta\":\"Read more\",\"hashtags\":[\"#ai\"]}]"
                        }]
                    }
                }]
            }
            """;

            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>()
                )
                .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(geminiResponseJson)
                });
            var httpClient = new HttpClient(mockHandler.Object);

            var options = Options.Create(new ContentGeneratorOptions
            {
                Enabled = true,
                ApiKey = "fake-key",
                Model = "gemini-1.5-flash",
                Endpoint = "https://generativelanguage.googleapis.com/v1beta",
                Temperature = 0.7f,
                MaxOutputTokens = 1000,
                MaxBodyLength = 500,
                MaxHashtags = 5,
                MultiPlatformEnabled = true
            });

            var mockHistoryService = new Mock<IContentHistoryService>();
            mockHistoryService.Setup(h => h.SaveHistoryAsync(It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new Exception("Database connection failure"));

            var mockGenLogger = new Mock<ILogger<ContentGeneratorService>>();
            var mockImageClient = new Mock<IImageGenerationClient>();

            var generatorService = new ContentGeneratorService(
                db,
                httpClient,
                options,
                mockHistoryService.Object,
                mockImageClient.Object,
                mockGenLogger.Object
            );

            var request = new GenerateContentRequest
            {
                UserId = "user-123",
                TrendId = trendId,
                OutputCount = 1,
                Language = "vi"
            };

            // Act
            var result = await generatorService.GenerateAsync(request, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Single(result.Items);
            Assert.Equal("Facebook", result.Items[0].Platform);
            Assert.Equal("Great content about AI Future", result.Items[0].Body);

            // Verify SaveHistoryAsync was called and exception was logged (non-blocking)
            mockHistoryService.Verify(h => h.SaveHistoryAsync("user-123", trendId, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task ContentGeneratorService_GenerateImage_CallsImageGenerator_AndSavesWithMediaUrl()
        {
            // Arrange
            using var db = CreateDbContext();
            var trendId = Guid.NewGuid();
            db.Trends.Add(new Trend
            {
                Id = trendId,
                Title = "AI Future",
                Summary = "Summary",
                SourceUrl = "https://example.com"
            });
            db.UserContexts.Add(new UserContext
            {
                UserId = "user-123",
                JobTitle = "Marketer",
                ToneOfVoice = "Professional",
                Language = "vi"
            });
            await db.SaveChangesAsync();

            // IVectorPersonaClient mock removed as persona is resolved from db directly

            var responseJson = "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"[{\\\"Platform\\\":\\\"Facebook\\\",\\\"Hook\\\":\\\"Awesome hook\\\",\\\"Body\\\":\\\"Great content about AI Future\\\",\\\"Cta\\\":\\\"Read more\\\",\\\"Hashtags\\\":[\\\"#ai\\\"]}]\"}]}}]}";
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>()
                )
                .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(responseJson)
                });

            var httpClient = new HttpClient(mockHandler.Object);

            var options = Options.Create(new ContentGeneratorOptions
            {
                Enabled = true,
                ApiKey = "fake-key",
                Model = "gemini-1.5-flash",
                Endpoint = "https://generativelanguage.googleapis.com/v1beta",
                Temperature = 0.7f,
                MaxOutputTokens = 1000,
                MaxBodyLength = 500,
                MaxHashtags = 5,
                MultiPlatformEnabled = true
            });

            var mockHistoryService = new Mock<IContentHistoryService>();
            mockHistoryService.Setup(h => h.SaveHistoryAsync(It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            var mockGenLogger = new Mock<ILogger<ContentGeneratorService>>();
            var mockImageClient = new Mock<IImageGenerationClient>();
            mockImageClient.Setup(x => x.GenerateImageAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("http://example.com/image.png");

            var generatorService = new ContentGeneratorService(
                db,
                httpClient,
                options,
                mockHistoryService.Object,
                mockImageClient.Object,
                mockGenLogger.Object
            );

            var request = new GenerateContentRequest
            {
                UserId = "user-123",
                TrendId = trendId,
                OutputCount = 1,
                Language = "vi",
                GenerateImage = true
            };

            // Act
            var result = await generatorService.GenerateAsync(request, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Single(result.Items);
            Assert.Equal("http://example.com/image.png", result.Items[0].MediaUrl);

            // Verify
            mockImageClient.Verify(x => x.GenerateImageAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
            mockHistoryService.Verify(h => h.SaveHistoryAsync("user-123", trendId, It.IsAny<string>(), "http://example.com/image.png", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task ContentGeneratorService_GenerateImageException_DoesNotBlock_AndSavesWithNullMediaUrl()
        {
            // Arrange
            using var db = CreateDbContext();
            var trendId = Guid.NewGuid();
            db.Trends.Add(new Trend
            {
                Id = trendId,
                Title = "AI Future",
                Summary = "Summary",
                SourceUrl = "https://example.com"
            });
            db.UserContexts.Add(new UserContext
            {
                UserId = "user-123",
                JobTitle = "Marketer",
                ToneOfVoice = "Professional",
                Language = "vi"
            });
            await db.SaveChangesAsync();

            // IVectorPersonaClient mock removed as persona is resolved from db directly

            var responseJson = "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"[{\\\"Platform\\\":\\\"Facebook\\\",\\\"Hook\\\":\\\"Awesome hook\\\",\\\"Body\\\":\\\"Great content about AI Future\\\",\\\"Cta\\\":\\\"Read more\\\",\\\"Hashtags\\\":[\\\"#ai\\\"]}]\"}]}}]}";
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>()
                )
                .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(responseJson)
                });

            var httpClient = new HttpClient(mockHandler.Object);

            var options = Options.Create(new ContentGeneratorOptions
            {
                Enabled = true,
                ApiKey = "fake-key",
                Model = "gemini-1.5-flash",
                Endpoint = "https://generativelanguage.googleapis.com/v1beta",
                Temperature = 0.7f,
                MaxOutputTokens = 1000,
                MaxBodyLength = 500,
                MaxHashtags = 5,
                MultiPlatformEnabled = true
            });

            var mockHistoryService = new Mock<IContentHistoryService>();
            mockHistoryService.Setup(h => h.SaveHistoryAsync(It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            var mockGenLogger = new Mock<ILogger<ContentGeneratorService>>();
            var mockImageClient = new Mock<IImageGenerationClient>();
            mockImageClient.Setup(x => x.GenerateImageAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new Exception("OpenAI API Down"));

            var generatorService = new ContentGeneratorService(
                db,
                httpClient,
                options,
                mockHistoryService.Object,
                mockImageClient.Object,
                mockGenLogger.Object
            );

            var request = new GenerateContentRequest
            {
                UserId = "user-123",
                TrendId = trendId,
                OutputCount = 1,
                Language = "vi",
                GenerateImage = true
            };

            // Act
            var result = await generatorService.GenerateAsync(request, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Single(result.Items);
            Assert.Null(result.Items[0].MediaUrl);

            // Verify SaveHistoryAsync (4 params overload is called because mediaUrl is null)
            mockHistoryService.Verify(h => h.SaveHistoryAsync("user-123", trendId, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task SaveHistoryAsync_WithMediaUrl_SavesToDatabaseSuccessfully()
        {
            // Arrange
            using var db = CreateDbContext();
            var service = new ContentHistoryService(db, _mockLogger.Object);
            var userId = "user-123";
            var trendId = Guid.NewGuid();
            var contentJson = "[{\"platform\":\"Facebook\",\"body\":\"Hello\"}]";
            var mediaUrl = "http://example.com/test.png";

            // Act
            await service.SaveHistoryAsync(userId, trendId, contentJson, mediaUrl, CancellationToken.None);

            // Assert
            var saved = await db.ContentHistories.FirstOrDefaultAsync(h => h.UserId == userId);
            Assert.NotNull(saved);
            Assert.Equal(trendId, saved.OriginalTrendId);
            Assert.Equal(contentJson, saved.GeneratedContent);
            Assert.Equal(mediaUrl, saved.MediaUrl);
        }
    }
}
