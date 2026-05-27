using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;
using SocialSense.Configuration;
using SocialSense.Data;
using SocialSense.DTOs.Content;
using SocialSense.Filters;
using SocialSense.Models;
using SocialSense.Services;
using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace SocialSense.Tests
{
    public class QuotaCheckFilterTests : IDisposable
    {
        private readonly SqliteConnection _connection;
        private readonly DbContextOptions<AppDbContext> _dbContextOptions;

        public QuotaCheckFilterTests()
        {
            _connection = new SqliteConnection("Filename=:memory:");
            _connection.Open();

            _dbContextOptions = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(_connection)
                .Options;

            using var db = new AppDbContext(_dbContextOptions);
            db.Database.EnsureCreated();
        }

        public void Dispose()
        {
            _connection.Dispose();
        }

        private AppDbContext CreateDbContext()
        {
            return new AppDbContext(_dbContextOptions);
        }

        private (ActionExecutingContext, ActionExecutionDelegate) CreateFilterContext(GenerateContentRequest? request)
        {
            var actionContext = new ActionContext(
                new DefaultHttpContext(),
                new RouteData(),
                new ActionDescriptor()
            );

            var actionExecutingContext = new ActionExecutingContext(
                actionContext,
                new List<IFilterMetadata>(),
                new Dictionary<string, object?>(),
                controller: new object()
            );

            if (request != null)
            {
                actionExecutingContext.ActionArguments["request"] = request;
            }

            ActionExecutionDelegate next = () =>
            {
                var actionExecutedContext = new ActionExecutedContext(actionContext, new List<IFilterMetadata>(), new object());
                return Task.FromResult(actionExecutedContext);
            };

            return (actionExecutingContext, next);
        }

        [Fact]
        public async Task Filter_WithValidQuota_CallsNextAndDoesNotSetResult()
        {
            // Arrange
            using var db = CreateDbContext();
            var userId = "user-valid";
            db.Users.Add(new User
            {
                Id = userId,
                Email = "valid@example.com",
                PasswordHash = "hash",
                DailyQuotaLimit = 10,
                RemainingQuota = 5,
                LastQuotaReset = DateTime.UtcNow
            });
            await db.SaveChangesAsync();

            var filter = new QuotaCheckFilter(db);
            var request = new GenerateContentRequest { UserId = userId, TrendId = Guid.NewGuid() };
            var (context, next) = CreateFilterContext(request);

            // Act
            await filter.OnActionExecutionAsync(context, next);

            // Assert
            Assert.Null(context.Result);
        }

        [Fact]
        public async Task Filter_WithEmptyUserId_CallsNext()
        {
            // Arrange
            using var db = CreateDbContext();
            var filter = new QuotaCheckFilter(db);
            var request = new GenerateContentRequest { UserId = "", TrendId = Guid.NewGuid() };
            var (context, next) = CreateFilterContext(request);

            // Act
            await filter.OnActionExecutionAsync(context, next);

            // Assert
            Assert.Null(context.Result);
        }

        [Fact]
        public async Task Filter_WithUserNotFound_ReturnsBadRequest()
        {
            // Arrange
            using var db = CreateDbContext();
            var filter = new QuotaCheckFilter(db);
            var request = new GenerateContentRequest { UserId = "non-existent", TrendId = Guid.NewGuid() };
            var (context, next) = CreateFilterContext(request);

            // Act
            await filter.OnActionExecutionAsync(context, next);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(context.Result);
            dynamic error = badRequest.Value!;
            Assert.Equal("USER_NOT_FOUND", error.GetType().GetProperty("code").GetValue(error, null));
        }

        [Fact]
        public async Task Filter_WithQuotaExceeded_ReturnsStatus429()
        {
            // Arrange
            using var db = CreateDbContext();
            var userId = "user-no-quota";
            var user = new User
            {
                Id = userId,
                Email = "noquota@example.com",
                PasswordHash = "hash",
                DailyQuotaLimit = 10,
                RemainingQuota = 10,
                LastQuotaReset = DateTime.UtcNow
            };
            db.Users.Add(user);
            await db.SaveChangesAsync();

            user.RemainingQuota = 0;
            await db.SaveChangesAsync();

            var filter = new QuotaCheckFilter(db);
            var request = new GenerateContentRequest { UserId = userId, TrendId = Guid.NewGuid() };
            var (context, next) = CreateFilterContext(request);

            // Act
            await filter.OnActionExecutionAsync(context, next);

            // Assert
            var objectResult = Assert.IsType<ObjectResult>(context.Result);
            Assert.Equal(429, objectResult.StatusCode);
            dynamic error = objectResult.Value!;
            Assert.Equal("QUOTA_EXCEEDED", error.GetType().GetProperty("code").GetValue(error, null));
        }

        [Fact]
        public async Task Filter_WithYesterdayResetDate_ResetsQuotaToDailyLimit()
        {
            // Arrange
            using var db = CreateDbContext();
            var userId = "user-old-reset";
            var yesterday = DateTime.UtcNow.AddDays(-1);
            db.Users.Add(new User
            {
                Id = userId,
                Email = "old@example.com",
                PasswordHash = "hash",
                DailyQuotaLimit = 10,
                RemainingQuota = 2,
                LastQuotaReset = yesterday
            });
            await db.SaveChangesAsync();

            var filter = new QuotaCheckFilter(db);
            var request = new GenerateContentRequest { UserId = userId, TrendId = Guid.NewGuid() };
            var (context, next) = CreateFilterContext(request);

            // Act
            await filter.OnActionExecutionAsync(context, next);

            // Assert
            Assert.Null(context.Result); // Should proceed

            // Check if db was updated
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            Assert.NotNull(user);
            Assert.Equal(10, user.RemainingQuota);
            Assert.True(user.LastQuotaReset.Date == DateTime.UtcNow.Date);
        }

        [Fact]
        public async Task ContentGeneratorService_SuccessfulGeneration_DecrementsQuota()
        {
            // Arrange
            using var db = CreateDbContext();
            var userId = "user-decrement";
            db.Users.Add(new User
            {
                Id = userId,
                Email = "decrement@example.com",
                PasswordHash = "hash",
                DailyQuotaLimit = 10,
                RemainingQuota = 5,
                LastQuotaReset = DateTime.UtcNow
            });

            var trendId = Guid.NewGuid();
            var trend = new Trend
            {
                Id = trendId,
                Title = "Trend 1",
                Summary = "Summary 1",
                SourceUrl = "https://example.com"
            };
            db.Trends.Add(trend);
            await db.SaveChangesAsync();

            db.UserContexts.Add(new UserContext
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Version = 1,
                JobTitle = "Job",
                ToneOfVoice = "Tone",
                Language = "vi",
                IsActive = true
            });
            await db.SaveChangesAsync();

            var geminiResponseJson = """
            {
                "candidates": [{
                    "content": {
                        "parts": [{
                            "text": "[{\"platform\":\"Facebook\",\"hook\":\"Hook\",\"body\":\"Body\",\"cta\":\"CTA\",\"hashtags\":[]}]"
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
                MaxHashtags = 5
            });

            var mockHistoryService = new Mock<IContentHistoryService>();
            mockHistoryService.Setup(h => h.SaveHistoryAsync(It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            var mockLogger = new Mock<ILogger<ContentGeneratorService>>();
            var mockImageClient = new Mock<IImageGenerationClient>();

            var service = new ContentGeneratorService(
                db,
                httpClient,
                options,
                mockHistoryService.Object,
                mockImageClient.Object,
                mockLogger.Object
            );

            var request = new GenerateContentRequest
            {
                UserId = userId,
                TrendId = trendId,
                OutputCount = 1,
                Language = "vi"
            };

            // Act
            var result = await service.GenerateAsync(request, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            mockHistoryService.Verify(h => h.SaveHistoryAsync(userId, trendId, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);

            // Refresh user and check quota
            // Clear local tracking so EF Core has to fetch directly from SQLite database file
            db.ChangeTracker.Clear();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            Assert.NotNull(user);
            Assert.Equal(4, user.RemainingQuota); // decremented from 5 to 4
        }

        [Fact]
        public async Task ContentGeneratorService_Fallback_DoesNotDecrementQuota()
        {
            // Arrange
            using var db = CreateDbContext();
            var userId = "user-no-decrement";
            db.Users.Add(new User
            {
                Id = userId,
                Email = "nodecrement@example.com",
                PasswordHash = "hash",
                DailyQuotaLimit = 10,
                RemainingQuota = 5,
                LastQuotaReset = DateTime.UtcNow
            });

            var trendId = Guid.NewGuid();
            var trend = new Trend
            {
                Id = trendId,
                Title = "Trend 1",
                Summary = "Summary 1",
                SourceUrl = "https://example.com"
            };
            db.Trends.Add(trend);
            await db.SaveChangesAsync();

            db.UserContexts.Add(new UserContext
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Version = 1,
                JobTitle = "Job",
                ToneOfVoice = "Tone",
                Language = "vi",
                IsActive = true
            });
            await db.SaveChangesAsync();

            // Simulate API error (fails)
            var mockHandler = new Mock<HttpMessageHandler>();
            mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>()
                )
                .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.InternalServerError));
            var httpClient = new HttpClient(mockHandler.Object);

            var options = Options.Create(new ContentGeneratorOptions
            {
                Enabled = true,
                ApiKey = "fake-key",
                Model = "gemini-1.5-flash",
                Endpoint = "https://generativelanguage.googleapis.com/v1beta"
            });

            var mockHistoryService = new Mock<IContentHistoryService>();
            var mockLogger = new Mock<ILogger<ContentGeneratorService>>();
            var mockImageClient = new Mock<IImageGenerationClient>();

            var service = new ContentGeneratorService(
                db,
                httpClient,
                options,
                mockHistoryService.Object,
                mockImageClient.Object,
                mockLogger.Object
            );

            var request = new GenerateContentRequest
            {
                UserId = userId,
                TrendId = trendId,
                OutputCount = 1,
                Language = "vi"
            };

            // Act
            var result = await service.GenerateAsync(request, CancellationToken.None);

            // Assert
            Assert.NotNull(result); // Fallback is returned
            // SaveHistoryAsync must not be called
            mockHistoryService.Verify(h => h.SaveHistoryAsync(It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);

            // Quota remains unchanged
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            Assert.NotNull(user);
            Assert.Equal(5, user.RemainingQuota); // remains 5
        }
    }
}
