using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Moq;
using SocialSense.Configuration;
using SocialSense.Controllers;
using SocialSense.Data;
using SocialSense.DTOs;
using SocialSense.Models;
using SocialSense.Services;
using Xunit;

namespace SocialSense.Tests;

public class AuthControllerTests
{
    private readonly IOptions<JwtOptions> _jwtOptions;

    public AuthControllerTests()
    {
        _jwtOptions = Options.Create(new JwtOptions
        {
            Secret = "SocialSenseSuperSecretSecurityKey2026!!!",
            Issuer = "SocialSense-BE",
            Audience = "SocialSense-FE",
            ExpiryMinutes = 60
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
    public async Task Register_WithNewUser_SavesToDbAndReturnsOk()
    {
        // Arrange
        using var db = CreateDbContext();
        var controller = new AuthController(db, _jwtOptions);

        var request = new RegisterRequest
        {
            Email = "test@example.com",
            Password = "password123",
            DisplayName = "Test User"
        };

        // Act
        var result = await controller.Register(request, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var userInDb = await db.Users.FirstOrDefaultAsync(u => u.Email == "test@example.com");
        Assert.NotNull(userInDb);
        Assert.Equal("Test User", userInDb.DisplayName);
        Assert.True(PasswordHelper.VerifyPassword("password123", userInDb.PasswordHash));
    }

    [Fact]
    public async Task Register_WithExistingUser_ReturnsBadRequest()
    {
        // Arrange
        using var db = CreateDbContext();
        var controller = new AuthController(db, _jwtOptions);

        var existingUser = new User
        {
            Id = Guid.NewGuid().ToString(),
            Email = "test@example.com",
            PasswordHash = PasswordHelper.HashPassword("oldpassword"),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(existingUser);
        await db.SaveChangesAsync();

        var request = new RegisterRequest
        {
            Email = "test@example.com",
            Password = "newpassword",
            DisplayName = "New User"
        };

        // Act
        var result = await controller.Register(request, CancellationToken.None);

        // Assert
        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Login_WithValidCredentials_ReturnsTokensAndUserData()
    {
        // Arrange
        using var db = CreateDbContext();
        var controller = new AuthController(db, _jwtOptions);

        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            DisplayName = "Test User",
            PasswordHash = PasswordHelper.HashPassword("password123"),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var request = new LoginRequest
        {
            Email = "test@example.com",
            Password = "password123"
        };

        // Act
        var result = await controller.Login(request, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AuthResponse>(okResult.Value);
        Assert.NotEmpty(response.AccessToken);
        Assert.NotEmpty(response.RefreshToken);
        Assert.Equal("test@example.com", response.Email);
        Assert.Equal("Test User", response.DisplayName);
    }

    [Fact]
    public async Task Login_WithInvalidPassword_ReturnsUnauthorized()
    {
        // Arrange
        using var db = CreateDbContext();
        var controller = new AuthController(db, _jwtOptions);

        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            PasswordHash = PasswordHelper.HashPassword("password123"),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var request = new LoginRequest
        {
            Email = "test@example.com",
            Password = "wrongpassword"
        };

        // Act
        var result = await controller.Login(request, CancellationToken.None);

        // Assert
        var unauthorizedResult = Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task Refresh_WithValidToken_ReturnsNewTokens()
    {
        // Arrange
        using var db = CreateDbContext();
        var controller = new AuthController(db, _jwtOptions);

        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            PasswordHash = PasswordHelper.HashPassword("password123"),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);

        var oldToken = new UserToken
        {
            Id = Guid.NewGuid(),
            UserId = "user-123",
            RefreshToken = "old-refresh-token",
            ExpiresAt = DateTime.UtcNow.AddDays(1),
            CreatedAt = DateTime.UtcNow,
            IsRevoked = false
        };
        db.UserTokens.Add(oldToken);
        await db.SaveChangesAsync();

        var request = new RefreshTokenRequest
        {
            RefreshToken = "old-refresh-token"
        };

        // Act
        var result = await controller.Refresh(request, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AuthResponse>(okResult.Value);
        Assert.NotEmpty(response.AccessToken);
        Assert.NotEmpty(response.RefreshToken);
        Assert.NotEqual("old-refresh-token", response.RefreshToken);

        // Verify old token is revoked
        var tokenInDb = await db.UserTokens.FirstOrDefaultAsync(t => t.RefreshToken == "old-refresh-token");
        Assert.NotNull(tokenInDb);
        Assert.True(tokenInDb.IsRevoked);
    }
}
