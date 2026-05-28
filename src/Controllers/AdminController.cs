using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SocialSense.Data;
using SocialSense.DTOs.Admin;
using SocialSense.Models;
using SocialSense.Services;

namespace SocialSense.Controllers;

/// <summary>
/// Admin panel API — tất cả endpoints yêu cầu role "Admin".
/// </summary>
[ApiController]
[Route("admin")]
[Authorize(Policy = "AdminOnly")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly GeminiApiKeyPool _keyPool;
    private readonly ILogger<AdminController> _logger;

    public AdminController(AppDbContext db, GeminiApiKeyPool keyPool, ILogger<AdminController> logger)
    {
        _db = db;
        _keyPool = keyPool;
        _logger = logger;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DASHBOARD
    // ═══════════════════════════════════════════════════════════════════════════

    /// <summary>GET /admin/dashboard — Tổng quan hệ thống</summary>
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var sevenDaysAgo = now.AddDays(-7);

        var totalUsers = await _db.Users.CountAsync(ct);
        var activeUsers = await _db.Users.CountAsync(u => u.IsActive, ct);
        var totalContent = await _db.ContentHistories.CountAsync(ct);
        var totalKnowledge = await _db.KnowledgeItems.CountAsync(ct);
        var totalTrends = await _db.Trends.CountAsync(ct);

        var keyStatuses = _keyPool.GetKeyStatuses();
        var activeKeys = keyStatuses.Count(k => !k.IsInCooldown);
        var coolingKeys = keyStatuses.Count(k => k.IsInCooldown);

        // Thống kê 7 ngày gần nhất
        var contentByDay = await _db.ContentHistories
            .Where(c => c.CreatedAt >= sevenDaysAgo)
            .GroupBy(c => c.CreatedAt.Date)
            .Select(g => new { Date = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var usersByDay = await _db.Users
            .Where(u => u.CreatedAt >= sevenDaysAgo)
            .GroupBy(u => u.CreatedAt.Date)
            .Select(g => new { Date = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var last7Days = Enumerable.Range(0, 7)
            .Select(i => now.AddDays(-6 + i).Date)
            .Select(date => new DailyStatPoint
            {
                Date = date.ToString("yyyy-MM-dd"),
                ContentGenerated = contentByDay.FirstOrDefault(x => x.Date == date)?.Count ?? 0,
                NewUsers = usersByDay.FirstOrDefault(x => x.Date == date)?.Count ?? 0
            })
            .ToList();

        return Ok(new DashboardSummaryResponse
        {
            TotalUsers = totalUsers,
            ActiveUsers = activeUsers,
            TotalContentGenerated = totalContent,
            TotalKnowledgeItems = totalKnowledge,
            TotalTrends = totalTrends,
            ActiveApiKeys = activeKeys,
            CoolingDownApiKeys = coolingKeys,
            Last7DaysContent = last7Days
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // USER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /// <summary>GET /admin/users — Danh sách tất cả users (có phân trang)</summary>
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] bool? isActive = null,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.Users.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLowerInvariant();
            query = query.Where(u => u.Email.Contains(s) || (u.DisplayName != null && u.DisplayName.Contains(s)));
        }

        if (isActive.HasValue)
            query = query.Where(u => u.IsActive == isActive.Value);

        var total = await query.CountAsync(ct);

        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var userIds = users.Select(u => u.Id).ToList();

        // Lấy roles
        var userRoles = await _db.UserRoles.AsNoTracking()
            .Where(ur => userIds.Contains(ur.UserId))
            .Join(_db.Roles.AsNoTracking(), ur => ur.RoleId, r => r.Id, (ur, r) => new { ur.UserId, r.Name })
            .ToListAsync(ct);

        // Đếm content đã tạo
        var contentCounts = await _db.ContentHistories.AsNoTracking()
            .Where(c => userIds.Contains(c.UserId))
            .GroupBy(c => c.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var result = users.Select(u => new AdminUserListResponse
        {
            Id = u.Id,
            Email = u.Email,
            DisplayName = u.DisplayName,
            IsActive = u.IsActive,
            HasContext = u.HasContext,
            Tier = u.Tier.ToString(),
            DailyQuotaLimit = u.DailyQuotaLimit,
            RemainingQuota = u.RemainingQuota,
            LastQuotaReset = u.LastQuotaReset,
            CreatedAt = u.CreatedAt,
            Roles = userRoles.Where(r => r.UserId == u.Id).Select(r => r.Name).ToList(),
            TotalContentGenerated = contentCounts.FirstOrDefault(c => c.UserId == u.Id)?.Count ?? 0
        }).ToList();

        return Ok(new
        {
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling((double)total / pageSize),
            data = result
        });
    }

    /// <summary>GET /admin/users/{id} — Chi tiết 1 user</summary>
    [HttpGet("users/{id:int}")]
    public async Task<IActionResult> GetUser(int id, CancellationToken ct)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user == null) return NotFound(new { code = "USER_NOT_FOUND" });

        var roles = await _db.UserRoles.AsNoTracking()
            .Where(ur => ur.UserId == id)
            .Join(_db.Roles.AsNoTracking(), ur => ur.RoleId, r => r.Id, (ur, r) => r.Name)
            .ToListAsync(ct);

        var contentCount = await _db.ContentHistories.CountAsync(c => c.UserId == id, ct);

        return Ok(new AdminUserListResponse
        {
            Id = user.Id,
            Email = user.Email,
            DisplayName = user.DisplayName,
            IsActive = user.IsActive,
            HasContext = user.HasContext,
            Tier = user.Tier.ToString(),
            DailyQuotaLimit = user.DailyQuotaLimit,
            RemainingQuota = user.RemainingQuota,
            LastQuotaReset = user.LastQuotaReset,
            CreatedAt = user.CreatedAt,
            Roles = roles,
            TotalContentGenerated = contentCount
        });
    }

    /// <summary>POST /admin/users — Tạo user mới (admin tạo thay)</summary>
    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] AdminCreateUserRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Email == email, ct))
            return BadRequest(new { code = "EMAIL_EXISTS", message = "Email đã tồn tại." });

        var user = new User
        {
            Email = email,
            DisplayName = request.DisplayName?.Trim() ?? email.Split('@')[0],
            PasswordHash = Services.PasswordHelper.HashPassword(request.Password),
            HasContext = false,
            IsActive = true,
            Tier = SocialSense.Models.UserTier.Free,
            DailyQuotaLimit = request.DailyQuotaLimit,
            RemainingQuota = request.DailyQuotaLimit,
            LastQuotaReset = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        // Gán role User mặc định
        var userRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "User", ct);
        if (userRole != null)
            _db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = userRole.Id });

        if (request.IsAdmin)
        {
            var adminRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Admin", ct);
            if (adminRole != null)
                _db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = adminRole.Id });
        }

        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("Admin created user {Email}", email);
        return Ok(new { message = "Tạo user thành công.", userId = user.Id });
    }

    /// <summary>PUT /admin/users/{id} — Cập nhật thông tin user</summary>
    [HttpPut("users/{id:int}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] AdminUpdateUserRequest request, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user == null) return NotFound(new { code = "USER_NOT_FOUND" });

        if (request.DisplayName != null) user.DisplayName = request.DisplayName.Trim();
        if (request.IsActive.HasValue) user.IsActive = request.IsActive.Value;
        if (request.DailyQuotaLimit.HasValue)
        {
            user.DailyQuotaLimit = request.DailyQuotaLimit.Value;
            if (user.RemainingQuota > user.DailyQuotaLimit)
                user.RemainingQuota = user.DailyQuotaLimit;
        }
        if (request.ResetQuotaNow)
        {
            user.RemainingQuota = user.DailyQuotaLimit;
            user.LastQuotaReset = DateTime.UtcNow;
        }

        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Admin updated user {UserId}", id);
        return Ok(new { message = "Cập nhật thành công." });
    }

    /// <summary>DELETE /admin/users/{id} — Vô hiệu hóa user (soft delete)</summary>
    [HttpDelete("users/{id:int}")]
    public async Task<IActionResult> DeactivateUser(int id, CancellationToken ct)
    {
        var currentUserIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(currentUserIdStr, out var currentUserId) && id == currentUserId)
            return BadRequest(new { code = "CANNOT_DELETE_SELF", message = "Không thể vô hiệu hóa tài khoản của chính mình." });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user == null) return NotFound(new { code = "USER_NOT_FOUND" });

        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Admin deactivated user {UserId}", id);
        return Ok(new { message = "Đã vô hiệu hóa user." });
    }

    /// <summary>POST /admin/users/{id}/restore — Kích hoạt lại user</summary>
    [HttpPost("users/{id:int}/restore")]
    public async Task<IActionResult> RestoreUser(int id, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user == null) return NotFound(new { code = "USER_NOT_FOUND" });

        user.IsActive = true;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Đã kích hoạt lại user." });
    }

    /// <summary>POST /admin/users/{id}/reset-quota — Reset quota ngay lập tức</summary>
    [HttpPost("users/{id:int}/reset-quota")]
    public async Task<IActionResult> ResetUserQuota(int id, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user == null) return NotFound(new { code = "USER_NOT_FOUND" });

        user.RemainingQuota = user.DailyQuotaLimit;
        user.LastQuotaReset = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = $"Đã reset quota về {user.DailyQuotaLimit}." });
    }

    /// <summary>
    /// PUT /admin/users/{id}/tier — Đổi tier của user.
    /// Tự động cập nhật DailyQuotaLimit theo tier mặc định (Free=5, Pro=50, Enterprise=500/-1).
    /// Admin có thể override bằng customDailyQuota.
    /// </summary>
    [HttpPut("users/{id:int}/tier")]
    public async Task<IActionResult> UpdateUserTier(int id, [FromBody] UpdateUserTierRequest request, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user == null) return NotFound(new { code = "USER_NOT_FOUND" });

        if (!Enum.TryParse<SocialSense.Models.UserTier>(request.Tier, ignoreCase: true, out var tier))
            return BadRequest(new { code = "INVALID_TIER", message = "Tier phải là Free, Pro hoặc Enterprise." });

        user.Tier = tier;

        // Xác định quota mới
        int newQuota;
        if (request.CustomDailyQuota.HasValue)
        {
            // Validate: chỉ Enterprise mới được dùng -1 (unlimited)
            if (request.CustomDailyQuota.Value == -1 && tier != SocialSense.Models.UserTier.Enterprise)
                return BadRequest(new { code = "UNLIMITED_ENTERPRISE_ONLY", message = "Unlimited (-1) chỉ dành cho tier Enterprise." });
            if (request.CustomDailyQuota.Value < -1)
                return BadRequest(new { code = "INVALID_QUOTA", message = "customDailyQuota phải >= -1." });
            newQuota = request.CustomDailyQuota.Value;
        }
        else
        {
            newQuota = SocialSense.Models.User.GetDefaultQuota(tier);
        }

        user.DailyQuotaLimit = newQuota;
        // Reset remaining về limit mới (nếu unlimited thì set về int.MaxValue để tránh lỗi)
        user.RemainingQuota = newQuota == -1 ? int.MaxValue : newQuota;
        user.LastQuotaReset = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("Admin changed user {UserId} tier to {Tier}, quota={Quota}", id, tier, newQuota);

        return Ok(new
        {
            message = $"Đã đổi tier thành {tier}.",
            userId = id,
            tier = tier.ToString(),
            dailyQuotaLimit = newQuota,
            isUnlimited = newQuota == -1
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // API KEY MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /// <summary>GET /admin/api-keys — Danh sách tất cả API keys (ẩn giá trị thực)</summary>
    [HttpGet("api-keys")]
    public async Task<IActionResult> GetApiKeys(CancellationToken ct)
    {
        var keys = await _db.ApiKeyConfigs.AsNoTracking()
            .OrderBy(k => k.CreatedAt)
            .ToListAsync(ct);

        var poolStatuses = _keyPool.GetKeyStatuses()
            .ToDictionary(s => s.KeySuffix, s => s);

        var result = keys.Select(k =>
        {
            var suffix = k.KeyValue.Length >= 4 ? k.KeyValue[^4..] : k.KeyValue;
            poolStatuses.TryGetValue(suffix, out var status);
            return new ApiKeyResponse
            {
                Id = k.Id,
                Label = k.Label,
                KeySuffix = suffix,
                Provider = status?.Provider ?? DetectProviderFromNotes(k.Notes, k.KeyValue),
                IsActive = k.IsActive,
                Notes = k.Notes,
                CreatedAt = k.CreatedAt,
                UpdatedAt = k.UpdatedAt,
                IsInCooldown = status?.IsInCooldown ?? false,
                CooldownExpiresAt = status?.CooldownExpiresAt
            };
        }).ToList();

        return Ok(result);
    }

    /// <summary>POST /admin/api-keys — Thêm API key mới</summary>
    [HttpPost("api-keys")]
    public async Task<IActionResult> AddApiKey([FromBody] CreateApiKeyRequest request, CancellationToken ct)
    {
        var exists = await _db.ApiKeyConfigs.AnyAsync(k => k.KeyValue == request.KeyValue, ct);
        if (exists)
            return BadRequest(new { code = "KEY_ALREADY_EXISTS", message = "Key này đã tồn tại trong hệ thống." });

        var key = new ApiKeyConfig
        {
            Label = request.Label.Trim(),
            KeyValue = request.KeyValue.Trim(),
            IsActive = true,
            Notes = request.Notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.ApiKeyConfigs.Add(key);
        await _db.SaveChangesAsync(ct);

        await _keyPool.ReloadFromDatabaseAsync();

        _logger.LogInformation("Admin added new API key: {Label}", key.Label);
        return Ok(new { message = "Đã thêm API key thành công.", id = key.Id });
    }

    /// <summary>POST /admin/api-keys/bulk — Thêm nhiều keys cùng lúc</summary>
    [HttpPost("api-keys/bulk")]
    public async Task<IActionResult> AddApiKeysBulk([FromBody] List<CreateApiKeyRequest> requests, CancellationToken ct)
    {
        if (requests == null || requests.Count == 0)
            return BadRequest(new { code = "EMPTY_REQUEST" });

        var added = 0;
        var skipped = new List<string>();

        foreach (var req in requests)
        {
            if (string.IsNullOrWhiteSpace(req.KeyValue) || string.IsNullOrWhiteSpace(req.Label))
            {
                skipped.Add(req.Label ?? "(no label)");
                continue;
            }

            var exists = await _db.ApiKeyConfigs.AnyAsync(k => k.KeyValue == req.KeyValue, ct);
            if (exists)
            {
                skipped.Add(req.Label);
                continue;
            }

            _db.ApiKeyConfigs.Add(new ApiKeyConfig
            {
                Label = req.Label.Trim(),
                KeyValue = req.KeyValue.Trim(),
                IsActive = true,
                Notes = req.Notes?.Trim(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            added++;
        }

        await _db.SaveChangesAsync(ct);
        await _keyPool.ReloadFromDatabaseAsync();

        _logger.LogInformation("Admin bulk-added {Count} API keys, skipped {Skipped}", added, skipped.Count);
        return Ok(new { message = $"Đã thêm {added} key(s).", added, skipped });
    }

    /// <summary>PUT /admin/api-keys/{id} — Cập nhật API key</summary>
    [HttpPut("api-keys/{id:int}")]
    public async Task<IActionResult> UpdateApiKey(int id, [FromBody] UpdateApiKeyRequest request, CancellationToken ct)
    {
        var key = await _db.ApiKeyConfigs.FirstOrDefaultAsync(k => k.Id == id, ct);
        if (key == null) return NotFound(new { code = "KEY_NOT_FOUND" });

        if (request.Label != null) key.Label = request.Label.Trim();
        if (request.IsActive.HasValue) key.IsActive = request.IsActive.Value;
        if (request.Notes != null) key.Notes = request.Notes.Trim();
        if (!string.IsNullOrWhiteSpace(request.KeyValue))
        {
            var duplicate = await _db.ApiKeyConfigs.AnyAsync(k => k.KeyValue == request.KeyValue && k.Id != id, ct);
            if (duplicate)
                return BadRequest(new { code = "KEY_ALREADY_EXISTS", message = "Giá trị key này đã được dùng bởi key khác." });
            key.KeyValue = request.KeyValue.Trim();
        }

        key.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await _keyPool.ReloadFromDatabaseAsync();

        return Ok(new { message = "Đã cập nhật API key." });
    }

    /// <summary>DELETE /admin/api-keys/{id} — Xóa API key</summary>
    [HttpDelete("api-keys/{id:int}")]
    public async Task<IActionResult> DeleteApiKey(int id, CancellationToken ct)
    {
        var key = await _db.ApiKeyConfigs.FirstOrDefaultAsync(k => k.Id == id, ct);
        if (key == null) return NotFound(new { code = "KEY_NOT_FOUND" });

        _db.ApiKeyConfigs.Remove(key);
        await _db.SaveChangesAsync(ct);
        await _keyPool.ReloadFromDatabaseAsync();

        _logger.LogInformation("Admin deleted API key: {Label}", key.Label);
        return Ok(new { message = "Đã xóa API key." });
    }

    /// <summary>POST /admin/api-keys/reload — Reload pool từ DB (không cần restart)</summary>
    [HttpPost("api-keys/reload")]
    public async Task<IActionResult> ReloadKeyPool()
    {
        await _keyPool.ReloadFromDatabaseAsync();
        return Ok(new
        {
            message = "Pool đã được reload.",
            activeKeys = _keyPool.KeyCount,
            statuses = _keyPool.GetKeyStatuses()
        });
    }

    /// <summary>GET /admin/api-keys/status — Trạng thái runtime của pool</summary>
    [HttpGet("api-keys/status")]
    public IActionResult GetKeyPoolStatus()
    {
        return Ok(new
        {
            totalKeys = _keyPool.KeyCount,
            hasKeys = _keyPool.HasKeys,
            allInCooldown = _keyPool.AllKeysInCooldown,
            keys = _keyPool.GetKeyStatuses()
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATISTICS & COMPARISON
    // ═══════════════════════════════════════════════════════════════════════════

    [HttpPost("stats/compare")]
    public async Task<IActionResult> CompareStats([FromBody] StatsCompareRequest request, CancellationToken ct)
    {
        if (!DateTime.TryParse(request.PeriodA, out var dateA) ||
            !DateTime.TryParse(request.PeriodB, out var dateB))
            return BadRequest(new { code = "INVALID_DATE", message = "Định dạng ngày không hợp lệ (yyyy-MM-dd)." });

        var (fromA, toA) = GetPeriodRange(request.Period, dateA);
        var (fromB, toB) = GetPeriodRange(request.Period, dateB);

        var statsA = await ComputePeriodStatsAsync(fromA, toA, ct);
        var statsB = await ComputePeriodStatsAsync(fromB, toB, ct);

        statsA.Label = FormatPeriodLabel(request.Period, fromA, toA);
        statsB.Label = FormatPeriodLabel(request.Period, fromB, toB);

        return Ok(new StatsCompareResponse
        {
            PeriodA = statsA,
            PeriodB = statsB,
            Diff = new PeriodDiff
            {
                NewUsersDiff = statsB.NewUsers - statsA.NewUsers,
                NewUsersChangePercent = CalcPercent(statsA.NewUsers, statsB.NewUsers),
                ContentGeneratedDiff = statsB.TotalContentGenerated - statsA.TotalContentGenerated,
                ContentGeneratedChangePercent = CalcPercent(statsA.TotalContentGenerated, statsB.TotalContentGenerated),
                NewKnowledgeDiff = statsB.NewKnowledgeItems - statsA.NewKnowledgeItems,
                NewKnowledgeChangePercent = CalcPercent(statsA.NewKnowledgeItems, statsB.NewKnowledgeItems),
                NewTrendsDiff = statsB.NewTrends - statsA.NewTrends,
                NewTrendsChangePercent = CalcPercent(statsA.NewTrends, statsB.NewTrends)
            }
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<PeriodStats> ComputePeriodStatsAsync(DateTime from, DateTime to, CancellationToken ct)
    {
        var newUsers = await _db.Users.CountAsync(u => u.CreatedAt >= from && u.CreatedAt < to, ct);
        var activeUsers = await _db.ContentHistories
            .Where(c => c.CreatedAt >= from && c.CreatedAt < to)
            .Select(c => c.UserId)
            .Distinct()
            .CountAsync(ct);
        var totalContent = await _db.ContentHistories.CountAsync(c => c.CreatedAt >= from && c.CreatedAt < to, ct);
        var newKnowledge = await _db.KnowledgeItems.CountAsync(k => k.CreatedAt >= from && k.CreatedAt < to, ct);
        var newTrends = await _db.Trends.CountAsync(t => t.CreatedAt >= from && t.CreatedAt < to, ct);

        return new PeriodStats
        {
            From = from,
            To = to,
            NewUsers = newUsers,
            ActiveUsers = activeUsers,
            TotalContentGenerated = totalContent,
            TotalApiCalls = totalContent,
            NewKnowledgeItems = newKnowledge,
            NewTrends = newTrends
        };
    }

    private static (DateTime from, DateTime to) GetPeriodRange(string period, DateTime date)
    {
        return period.ToLowerInvariant() switch
        {
            "day" => (date.Date, date.Date.AddDays(1)),
            "month" => (new DateTime(date.Year, date.Month, 1),
                        new DateTime(date.Year, date.Month, 1).AddMonths(1)),
            "quarter" => GetQuarterRange(date),
            "year" => (new DateTime(date.Year, 1, 1),
                       new DateTime(date.Year + 1, 1, 1)),
            _ => (date.Date, date.Date.AddDays(1))
        };
    }

    private static (DateTime from, DateTime to) GetQuarterRange(DateTime date)
    {
        var quarter = (date.Month - 1) / 3;
        var from = new DateTime(date.Year, quarter * 3 + 1, 1);
        return (from, from.AddMonths(3));
    }

    private static string FormatPeriodLabel(string period, DateTime from, DateTime to)
    {
        return period.ToLowerInvariant() switch
        {
            "day" => from.ToString("dd/MM/yyyy"),
            "month" => from.ToString("MM/yyyy"),
            "quarter" => $"Q{(from.Month - 1) / 3 + 1}/{from.Year}",
            "year" => from.Year.ToString(),
            _ => $"{from:dd/MM/yyyy} - {to.AddDays(-1):dd/MM/yyyy}"
        };
    }

    private static double CalcPercent(int oldVal, int newVal)
    {
        if (oldVal == 0) return newVal > 0 ? 100.0 : 0.0;
        return Math.Round((double)(newVal - oldVal) / oldVal * 100, 2);
    }

    private static string DetectProviderFromNotes(string? notes, string keyValue)
    {
        if (!string.IsNullOrWhiteSpace(notes))
        {
            var n = notes.ToLowerInvariant();
            if (n.Contains("groq")) return "groq";
            if (n.Contains("openrouter")) return "openrouter";
            if (n.Contains("openai")) return "openai";
            if (n.Contains("gemini")) return "gemini";
        }
        if (keyValue.StartsWith("sk-or-")) return "openrouter";
        if (keyValue.StartsWith("gsk_")) return "groq";
        if (keyValue.StartsWith("sk-")) return "openai";
        if (keyValue.StartsWith("AIza")) return "gemini";
        return "openrouter";
    }
}
