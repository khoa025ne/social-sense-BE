using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
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
    private readonly IEmailService _emailService;
    private readonly SmtpOptions _smtpOptions;
    private readonly ILogger<AuthController> _logger;
    private readonly IActivityLogger _activityLogger;

    public AuthController(AppDbContext db, IOptions<JwtOptions> jwtOptions, IEmailService emailService, IOptions<SmtpOptions> smtpOptions, ILogger<AuthController> logger, IActivityLogger activityLogger)
    {
        _db = db;
        _jwtOptions = jwtOptions.Value;
        _emailService = emailService;
        _smtpOptions = smtpOptions.Value;
        _logger = logger;
        _activityLogger = activityLogger;
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
            Email = email,
            DisplayName = request.DisplayName?.Trim() ?? email.Split('@')[0],
            PasswordHash = PasswordHelper.HashPassword(request.Password),
            HasContext = false,
            IsActive = true,
            Tier = UserTier.Free,
            DailyQuotaLimit = Models.User.GetDefaultQuota(UserTier.Free),
            RemainingQuota = Models.User.GetDefaultQuota(UserTier.Free),
            LastQuotaReset = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        // Tự động gán role "User" khi tạo tài khoản mới
        var userRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "User", ct);
        if (userRole == null)
        {
            userRole = new Role
            {
                Name = "User",
                Description = "Người dùng thông thường",
                CreatedAt = DateTime.UtcNow
            };
            _db.Roles.Add(userRole);
            await _db.SaveChangesAsync(ct);
        }

        _db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = userRole.Id });
        await _db.SaveChangesAsync(ct);

        // Ghi nhật ký hành động Đăng ký
        await _activityLogger.LogAsync(user.Id, "LOGIN", "Đăng ký tài khoản mới", $"Đã tạo tài khoản với email {user.Email}", ct);

        // Gửi email chào mừng — await trực tiếp để dễ debug, lỗi SMTP không fail request
        try
        {
            await _emailService.SendWelcomeAsync(user.Email, user.DisplayName ?? user.Email.Split('@')[0], ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "⚠️ Failed to send welcome email to {Email}", user.Email);
        }

        return Ok(new { message = "User registered successfully.", userId = user.Id });
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
            UserId = user.Id,
            RefreshToken = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow,
            IsRevoked = false
        };

        _db.UserTokens.Add(userToken);
        await _db.SaveChangesAsync(ct);

        // Ghi nhật ký hành động Đăng nhập
        await _activityLogger.LogAsync(user.Id, "LOGIN", "Đăng nhập hệ thống", $"Đã đăng nhập tài khoản ({user.Email})", ct);

        return Ok(new AuthResponse
        {
            UserId = user.Id,
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
            UserId = user.Id,
            AccessToken = newAccessToken,
            RefreshToken = newRefreshToken,
            Email = user.Email,
            DisplayName = user.DisplayName ?? string.Empty,
            HasContext = user.HasContext
        });
    }

    /// <summary>GET /auth/me — Trả về thông tin user hiện tại từ JWT</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
            return Unauthorized(new { code = "AUTH_INVALID_TOKEN" });

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null)
            return NotFound(new { code = "USER_NOT_FOUND" });

        var roles = await _db.UserRoles.AsNoTracking()
            .Where(ur => ur.UserId == userId)
            .Join(_db.Roles.AsNoTracking(), ur => ur.RoleId, r => r.Id, (ur, r) => r.Name)
            .ToListAsync(ct);

        return Ok(new MeResponse
        {
            Id = user.Id,
            Email = user.Email,
            DisplayName = user.DisplayName ?? string.Empty,
            HasContext = user.HasContext,
            Tier = user.Tier.ToString(),
            DailyQuotaLimit = user.DailyQuotaLimit,
            RemainingQuota = user.RemainingQuota,
            IsUnlimited = user.DailyQuotaLimit == -1,
            Roles = roles
        });
    }

    /// <summary>
    /// GET /auth/quota — Trả về thông tin quota của user hiện tại từ JWT.
    /// Dùng để FE hiển thị số lượt còn lại, tier, % đã dùng.
    /// </summary>
    [HttpGet("quota")]
    [Authorize]
    public async Task<IActionResult> GetMyQuota(CancellationToken ct)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
            return Unauthorized(new { code = "AUTH_INVALID_TOKEN" });

        return await GetQuotaByIdInternal(userId, ct);
    }

    /// <summary>
    /// GET /auth/users/{id}/quota — Trả về quota của user theo ID.
    /// User chỉ xem được quota của chính mình; Admin xem được tất cả.
    /// </summary>
    [HttpGet("users/{id:int}/quota")]
    [Authorize]
    public async Task<IActionResult> GetUserQuota(int id, CancellationToken ct)
    {
        var callerIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(callerIdStr) || !int.TryParse(callerIdStr, out var callerId))
            return Unauthorized(new { code = "AUTH_INVALID_TOKEN" });

        // Chỉ cho phép xem quota của chính mình, trừ Admin
        var isAdmin = User.IsInRole("Admin");
        if (!isAdmin && callerId != id)
            return Forbid();

        return await GetQuotaByIdInternal(id, ct);
    }

    private async Task<IActionResult> GetQuotaByIdInternal(int userId, CancellationToken ct)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null)
            return NotFound(new { code = "USER_NOT_FOUND" });

        var now = DateTime.UtcNow;
        var nextReset = user.LastQuotaReset.Date.AddDays(1); // 0h ngày hôm sau (UTC)
        var isUnlimited = user.DailyQuotaLimit == -1;

        double usagePercent = 0;
        if (!isUnlimited && user.DailyQuotaLimit > 0)
        {
            var used = user.DailyQuotaLimit - user.RemainingQuota;
            usagePercent = Math.Round((double)used / user.DailyQuotaLimit * 100, 1);
        }

        return Ok(new
        {
            userId = user.Id,
            tier = user.Tier.ToString(),
            dailyQuotaLimit = isUnlimited ? -1 : user.DailyQuotaLimit,
            remainingQuota = isUnlimited ? -1 : user.RemainingQuota,
            usedToday = isUnlimited ? 0 : Math.Max(0, user.DailyQuotaLimit - user.RemainingQuota),
            isUnlimited,
            usagePercent = isUnlimited ? 0 : usagePercent,
            lastQuotaReset = user.LastQuotaReset,
            nextResetAt = nextReset,
            tierBenefits = new
            {
                free       = "5 lượt/ngày",
                pro        = "50 lượt/ngày",
                enterprise = "500 lượt/ngày hoặc Unlimited"
            }
        });
    }

    /// <summary>
    /// POST /auth/forgot-password — Gửi OTP về email để đặt lại mật khẩu.
    /// Luôn trả 200 để tránh email enumeration attack.
    /// </summary>
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email, ct);

        // Luôn trả 200 dù email có tồn tại hay không (tránh email enumeration)
        if (user == null || !user.IsActive)
            return Ok(new { message = "Nếu email tồn tại, mã OTP đã được gửi." });

        // Vô hiệu hoá tất cả OTP cũ chưa dùng của email này
        var oldOtps = await _db.PasswordResetOtps
            .Where(o => o.Email == email && !o.IsUsed && o.ExpiresAt > DateTime.UtcNow)
            .ToListAsync(ct);
        foreach (var old in oldOtps)
            old.IsUsed = true;

        // Tạo OTP 6 chữ số
        var otpCode = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
        var otp = new PasswordResetOtp
        {
            Email = email,
            OtpCode = otpCode,
            ExpiresAt = DateTime.UtcNow.AddMinutes(_smtpOptions.OtpExpiryMinutes),
            IsUsed = false,
            CreatedAt = DateTime.UtcNow
        };
        _db.PasswordResetOtps.Add(otp);
        await _db.SaveChangesAsync(ct);

        // Gửi mail (không await để không block response nếu muốn, nhưng ở đây await để bắt lỗi)
        await _emailService.SendPasswordResetOtpAsync(email, otpCode, _smtpOptions.OtpExpiryMinutes, ct);

        return Ok(new { message = "Nếu email tồn tại, mã OTP đã được gửi." });
    }

    /// <summary>
    /// POST /auth/reset-password — Xác nhận OTP và đặt lại mật khẩu mới.
    /// </summary>
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var otp = await _db.PasswordResetOtps
            .Where(o => o.Email == email && o.OtpCode == request.OtpCode && !o.IsUsed)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (otp == null || otp.ExpiresAt <= DateTime.UtcNow)
            return BadRequest(new { code = "OTP_INVALID_OR_EXPIRED", message = "Mã OTP không hợp lệ hoặc đã hết hạn." });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email && u.IsActive, ct);
        if (user == null)
            return BadRequest(new { code = "USER_NOT_FOUND", message = "Tài khoản không tồn tại." });

        // Đổi mật khẩu
        user.PasswordHash = PasswordHelper.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;

        // Đánh dấu OTP đã dùng
        otp.IsUsed = true;

        // Thu hồi tất cả refresh token hiện tại (bắt đăng nhập lại)
        var activeTokens = await _db.UserTokens
            .Where(t => t.UserId == user.Id && !t.IsRevoked)
            .ToListAsync(ct);
        foreach (var token in activeTokens)
        {
            token.IsRevoked = true;
            token.RevokedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại." });
    }

    // ── PUT /auth/change-password ─────────────────────────────────────────────
    /// <summary>Đổi mật khẩu — yêu cầu mật khẩu hiện tại. Sau khi thành công revoke tất cả refresh token.</summary>
    [HttpPut("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken ct)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _db.Users.FindAsync(new object[] { userId }, ct);
        if (user == null)
            return BadRequest(new { code = "USER_NOT_FOUND", message = "Tài khoản không tồn tại." });

        // Verify mật khẩu hiện tại
        if (!PasswordHelper.VerifyPassword(request.CurrentPassword, user.PasswordHash))
            return BadRequest(new { code = "AUTH_WRONG_PASSWORD", message = "Mật khẩu hiện tại không đúng." });

        // Không cho đặt lại mật khẩu giống cũ
        if (PasswordHelper.VerifyPassword(request.NewPassword, user.PasswordHash))
            return BadRequest(new { code = "AUTH_SAME_PASSWORD", message = "Mật khẩu mới không được trùng với mật khẩu hiện tại." });

        // Hash mật khẩu mới
        user.PasswordHash = PasswordHelper.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;

        // Revoke tất cả refresh token → bắt đăng nhập lại
        var activeTokens = await _db.UserTokens
            .Where(t => t.UserId == userId && !t.IsRevoked)
            .ToListAsync(ct);
        foreach (var token in activeTokens)
        {
            token.IsRevoked = true;
            token.RevokedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("User {UserId} changed password successfully", userId);

        return Ok(new { message = "Đổi mật khẩu thành công. Vui lòng đăng nhập lại." });
    }

    // ── PUT /auth/profile ─────────────────────────────────────────────────────
    /// <summary>Cập nhật thông tin profile (displayName). Trả về thông tin mới sau khi cập nhật.</summary>
    [HttpPut("profile")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request, CancellationToken ct)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _db.Users.FindAsync(new object[] { userId }, ct);
        if (user == null)
            return BadRequest(new { code = "USER_NOT_FOUND", message = "Tài khoản không tồn tại." });

        var displayName = request.DisplayName?.Trim();
        if (string.IsNullOrWhiteSpace(displayName) || displayName.Length < 2 || displayName.Length > 160)
            return BadRequest(new { code = "INVALID_DISPLAY_NAME", message = "Tên hiển thị phải từ 2 đến 160 ký tự." });

        user.DisplayName = displayName;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            message = "Cập nhật thông tin thành công.",
            displayName = user.DisplayName,
            email = user.Email
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
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
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
