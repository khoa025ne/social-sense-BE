using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Moq;
using SocialSense.Controllers;
using SocialSense.DTOs.Context;
using SocialSense.Services;
using Xunit;

namespace SocialSense.Tests
{
    public class ContextControllerTests
    {
        private readonly Mock<IContextService> _mockContextService;
        private readonly ContextController _controller;

        public ContextControllerTests()
        {
            _mockContextService = new Mock<IContextService>();
            _controller = new ContextController(_mockContextService.Object);
        }

        [Fact]
        public async Task UpdatePersona_WithValidRequest_ReturnsOk()
        {
            // Arrange
            var userId = "user-123";
            var request = new UpdatePersonaRequest
            {
                JobTitle = "Software Developer",
                ToneOfVoice = "Professional",
                PlatformPreferences = new List<string> { "LinkedIn", "Twitter" },
                TargetAudience = new List<string> { "Developers", "Tech leads" },
                ContentFormats = new List<string> { "Articles", "Tips" },
                NegativeConstraints = new List<string> { "No politics", "No spam" },
                Language = "vi"
            };

            var expectedResponse = new PersonaResponse
            {
                JobTitle = request.JobTitle,
                ToneOfVoice = request.ToneOfVoice,
                PlatformPreferences = request.PlatformPreferences,
                TargetAudience = request.TargetAudience,
                ContentFormats = request.ContentFormats,
                NegativeConstraints = request.NegativeConstraints,
                Language = request.Language
            };

            _mockContextService
                .Setup(s => s.UpdatePersonaAsync(userId, request, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.UpdatePersona(userId, request, CancellationToken.None);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<PersonaResponse>(okResult.Value);
            Assert.Equal("Software Developer", response.JobTitle);
        }

        [Fact]
        public async Task UpdatePersona_WithMissingUserId_ReturnsBadRequest()
        {
            // Act
            var result = await _controller.UpdatePersona("", new UpdatePersonaRequest(), CancellationToken.None);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task UpdatePersona_WithInvalidLanguage_ReturnsBadRequest()
        {
            // Arrange
            var request = new UpdatePersonaRequest
            {
                Language = "fr" // Invalid, only "vi" or "en" allowed
            };

            // Act
            var result = await _controller.UpdatePersona("user-123", request, CancellationToken.None);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task UpdatePersona_WithPlatformTooLong_ReturnsBadRequest()
        {
            // Arrange
            var request = new UpdatePersonaRequest
            {
                PlatformPreferences = new List<string> { new string('a', 61) } // Max is 60
            };

            // Act
            var result = await _controller.UpdatePersona("user-123", request, CancellationToken.None);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task UpdatePersona_WithTargetAudienceTooLong_ReturnsBadRequest()
        {
            // Arrange
            var request = new UpdatePersonaRequest
            {
                TargetAudience = new List<string> { new string('a', 101) } // Max is 100
            };

            // Act
            var result = await _controller.UpdatePersona("user-123", request, CancellationToken.None);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task UpdatePersona_WithEmptyTargetAudienceItem_ReturnsBadRequest()
        {
            // Arrange
            var request = new UpdatePersonaRequest
            {
                TargetAudience = new List<string> { "Developers", " " }
            };

            // Act
            var result = await _controller.UpdatePersona("user-123", request, CancellationToken.None);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task UpdatePersona_WithContentFormatsTooLong_ReturnsBadRequest()
        {
            // Arrange
            var request = new UpdatePersonaRequest
            {
                ContentFormats = new List<string> { new string('a', 101) } // Max is 100
            };

            // Act
            var result = await _controller.UpdatePersona("user-123", request, CancellationToken.None);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task UpdatePersona_WithNegativeConstraintsTooLong_ReturnsBadRequest()
        {
            // Arrange
            var request = new UpdatePersonaRequest
            {
                NegativeConstraints = new List<string> { new string('a', 101) } // Max is 100
            };

            // Act
            var result = await _controller.UpdatePersona("user-123", request, CancellationToken.None);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        }
    }
}
