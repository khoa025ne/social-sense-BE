using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Moq;
using SocialSense.Controllers;
using SocialSense.DTOs.Content;
using SocialSense.Services;
using Xunit;

namespace SocialSense.Tests
{
    public class ContentControllerTests
    {
        private readonly Mock<IContentGeneratorService> _mockContentService;
        private readonly Mock<IContentHistoryService> _mockHistoryService;
        private readonly ContentController _controller;

        public ContentControllerTests()
        {
            _mockContentService = new Mock<IContentGeneratorService>();
            _mockHistoryService = new Mock<IContentHistoryService>();
            _controller = new ContentController(_mockContentService.Object, _mockHistoryService.Object);
        }

        [Fact]
        public async Task Generate_WithValidRequest_ReturnsOk()
        {
            // Arrange
            var request = new GenerateContentRequest
            {
                UserId = "user-123",
                TrendId = Guid.NewGuid(),
                OutputCount = 2,
                Language = "vi",
                TargetPlatforms = new List<string> { "Facebook", "LinkedIn" }
            };

            var expectedResponse = new GenerateContentResponse
            {
                Items = new List<GeneratedContentItem>
                {
                    new GeneratedContentItem
                    {
                        Platform = "Facebook",
                        Hook = "Hook text",
                        Body = "Body text",
                        Cta = "CTA text",
                        Hashtags = new List<string> { "#test" },
                        Language = "vi"
                    }
                }
            };

            _mockContentService
                .Setup(s => s.GenerateAsync(request, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Generate(request, CancellationToken.None);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<GenerateContentResponse>(okResult.Value);
            Assert.Single(response.Items);
            Assert.Equal("Facebook", response.Items[0].Platform);
        }

        [Fact]
        public async Task Generate_WithMissingUserId_ReturnsBadRequest()
        {
            // Arrange
            var request = new GenerateContentRequest
            {
                UserId = "",
                TrendId = Guid.NewGuid()
            };

            // Act
            var result = await _controller.Generate(request, CancellationToken.None);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task Generate_WithEmptyTrendId_ReturnsBadRequest()
        {
            // Arrange
            var request = new GenerateContentRequest
            {
                UserId = "user-123",
                TrendId = Guid.Empty
            };

            // Act
            var result = await _controller.Generate(request, CancellationToken.None);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task Generate_WithInvalidOutputCount_ReturnsBadRequest()
        {
            // Arrange
            var request = new GenerateContentRequest
            {
                UserId = "user-123",
                TrendId = Guid.NewGuid(),
                OutputCount = 4 // Max is 3
            };

            // Act
            var result = await _controller.Generate(request, CancellationToken.None);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task Generate_WithInvalidLanguage_ReturnsBadRequest()
        {
            // Arrange
            var request = new GenerateContentRequest
            {
                UserId = "user-123",
                TrendId = Guid.NewGuid(),
                Language = "es"
            };

            // Act
            var result = await _controller.Generate(request, CancellationToken.None);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task Generate_WithTargetPlatformTooLong_ReturnsBadRequest()
        {
            // Arrange
            var request = new GenerateContentRequest
            {
                UserId = "user-123",
                TrendId = Guid.NewGuid(),
                TargetPlatforms = new List<string> { new string('p', 61) } // Max is 60
            };

            // Act
            var result = await _controller.Generate(request, CancellationToken.None);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task Generate_WithEmptyTargetPlatformItem_ReturnsBadRequest()
        {
            // Arrange
            var request = new GenerateContentRequest
            {
                UserId = "user-123",
                TrendId = Guid.NewGuid(),
                TargetPlatforms = new List<string> { "LinkedIn", " " }
            };

            // Act
            var result = await _controller.Generate(request, CancellationToken.None);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task GetHistory_WithValidRequest_ReturnsOk()
        {
            // Arrange
            var userId = "user-123";
            var page = 1;
            var pageSize = 10;
            var expectedResponse = new PaginatedHistoryResponse
            {
                TotalCount = 1,
                Page = page,
                PageSize = pageSize,
                Items = new List<HistoryItemResponse>
                {
                    new HistoryItemResponse
                    {
                        Id = Guid.NewGuid(),
                        UserId = userId,
                        CreatedAt = DateTime.UtcNow,
                        GeneratedContent = new List<GeneratedContentItem>()
                    }
                }
            };

            _mockHistoryService
                .Setup(s => s.GetHistoryAsync(userId, page, pageSize, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.GetHistory(userId, page, pageSize, CancellationToken.None);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<PaginatedHistoryResponse>(okResult.Value);
            Assert.Equal(1, response.TotalCount);
            Assert.Equal(userId, response.Items[0].UserId);
        }

        [Fact]
        public async Task GetHistory_WithEmptyUserId_ReturnsBadRequest()
        {
            // Act
            var result = await _controller.GetHistory("", 1, 10, CancellationToken.None);

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task GetHistory_WithInvalidPage_ReturnsBadRequest()
        {
            // Act
            var result = await _controller.GetHistory("user-123", 0, 10, CancellationToken.None);

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task GetHistory_WithInvalidPageSize_ReturnsBadRequest()
        {
            // Act
            var result = await _controller.GetHistory("user-123", 1, 101, CancellationToken.None);

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task EditHistory_WithValidRequest_ReturnsOk()
        {
            // Arrange
            var id = Guid.NewGuid();
            var request = new EditHistoryContentRequest
            {
                Title = "New Title",
                Body = "New Body Content",
                Hashtags = new List<string> { "#edited" }
            };

            _mockHistoryService
                .Setup(s => s.EditHistoryAsync(id, request, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Act
            var result = await _controller.EditHistory(id, request, CancellationToken.None);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
        }

        [Fact]
        public async Task EditHistory_WithMissingBody_ReturnsBadRequest()
        {
            // Arrange
            var id = Guid.NewGuid();
            var request = new EditHistoryContentRequest
            {
                Body = ""
            };

            // Act
            var result = await _controller.EditHistory(id, request, CancellationToken.None);

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task EditHistory_WithNullRequest_ReturnsBadRequest()
        {
            // Act
            var result = await _controller.EditHistory(Guid.NewGuid(), null!, CancellationToken.None);

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task EditHistory_WithNonExistentId_ReturnsNotFound()
        {
            // Arrange
            var id = Guid.NewGuid();
            var request = new EditHistoryContentRequest
            {
                Body = "New Body Content"
            };

            _mockHistoryService
                .Setup(s => s.EditHistoryAsync(id, request, It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            // Act
            var result = await _controller.EditHistory(id, request, CancellationToken.None);

            // Assert
            Assert.IsType<NotFoundObjectResult>(result);
        }
    }
}
