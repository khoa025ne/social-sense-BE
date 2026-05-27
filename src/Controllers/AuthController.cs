using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SocialSense.Configuration;
using SocialSense.Data;
using SocialSense.DTOs;
using SocialSense.Models;
using SocialSense.Services;

namespace SocialSense.Controllers;

[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtOptions _jwtOptions;

    public AuthController(AppDbContext db, IOptions<JwtOptions> jwtOptions)
    {
        _db = db;
        _jwtOptions = jwtOptions.Value;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var exists = await _db.Users.AnyAsync(u => u.Email == email, ct);
        if (exists)
        {
            return BadRequest(new { code = "AUTH_EMAIL_EXISTS", message = "Email already registered." });
        }

        var user = new User
        {
            Id = Guid.NewGuid().ToString(),
            Email = email,
            DisplayName = request.DisplayName?.Trim() ?? email.Split('@')[0],
            PasswordHash = PasswordHelper.HashPassword(request.Password),
            HasContext = false,
            IsActive = true,
            DailyQuotaLimit = 10,
            RemainingQuota = 10,
            LastQuotaReset = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "User registered successfully." });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user == null || !user.IsActive || !PasswordHelper.VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { code = "AUTH_INVALID_CREDENTIALS", message = "Invalid email or password." });
        }

        var accessToken = GenerateAccessToken(user);
        var refreshToken = GenerateRefreshToken();

        // Save refresh token to DB
        var userToken = new UserToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            RefreshToken = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow,
            IsRevoked = false
        };

        _db.UserTokens.Add(userToken);
        await _db.SaveChangesAsync(ct);

        return Ok(new AuthResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            Email = user.Email,
            DisplayName = user.DisplayName ?? string.Empty,
            HasContext = user.HasContext
        });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request, CancellationToken ct)
    {
        var tokenRecord = await _db.UserTokens.FirstOrDefaultAsync(t => t.RefreshToken == request.RefreshToken && !t.IsRevoked, ct);
        if (tokenRecord == null || tokenRecord.ExpiresAt <= DateTime.UtcNow)
        {
            return Unauthorized(new { code = "AUTH_INVALID_REFRESH_TOKEN", message = "Invalid or expired refresh token." });
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == tokenRecord.UserId && u.IsActive, ct);
        if (user == null)
        {
            return Unauthorized(new { code = "AUTH_USER_NOT_FOUND", message = "User not found or disabled." });
        }

        // Revoke current token
        tokenRecord.IsRevoked = true;
        tokenRecord.RevokedAt = DateTime.UtcNow;

        // Generate new tokens
        var newAccessToken = GenerateAccessToken(user);
        var newRefreshToken = GenerateRefreshToken();

        var newUserToken = new UserToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            RefreshToken = newRefreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow,
            IsRevoked = false
        };

        _db.UserTokens.Add(newUserToken);
        await _db.SaveChangesAsync(ct);

        return Ok(new AuthResponse
        {
            AccessToken = newAccessToken,
            RefreshToken = newRefreshToken,
            Email = user.Email,
            DisplayName = user.DisplayName ?? string.Empty,
            HasContext = user.HasContext
        });
    }

    private string GenerateAccessToken(User user)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_jwtOptions.Secret);

        // Lấy roles của user
        var roles = _db.UserRoles
            .Where(ur => ur.UserId == user.Id)
            .Join(_db.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => r.Name)
            .ToList();

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.DisplayName ?? string.Empty)
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddMinutes(_jwtOptions.ExpiryMinutes),
            Issuer = _jwtOptions.Issuer,
            Audience = _jwtOptions.Audience,
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    private static string GenerateRefreshToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
    }
}
