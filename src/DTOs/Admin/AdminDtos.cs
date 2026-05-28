using System.ComponentModel.DataAnnotations;

namespace SocialSense.DTOs.Admin;

// ── User Management ───────────────────────────────────────────────────────────

public class AdminUserListResponse
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public bool IsActive { get; set; }
    public bool HasContext { get; set; }
    public string Tier { get; set; } = "Free";
    public int DailyQuotaLimit { get; set; }
    public int RemainingQuota { get; set; }
    public DateTime LastQuotaReset { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<string> Roles { get; set; } = new();
    public int TotalContentGenerated { get; set; }
}

public class AdminUpdateUserRequest
{
    [MaxLength(160)]
    public string? DisplayName { get; set; }

    public bool? IsActive { get; set; }

    [Range(-1, 10000)]
    public int? DailyQuotaLimit { get; set; }

    /// <summary>Nếu true, reset RemainingQuota về DailyQuotaLimit ngay lập tức.</summary>
    public bool ResetQuotaNow { get; set; } = false;
}

public class AdminCreateUserRequest
{
    [Required, EmailAddress, MaxLength(160)]
    public string Email { get; set; } = string.Empty;

    [Required, MinLength(6)]
    public string Password { get; set; } = string.Empty;

    [MaxLength(160)]
    public string? DisplayName { get; set; }

    [Range(1, 1000)]
    public int DailyQuotaLimit { get; set; } = 10;

    public bool IsAdmin { get; set; } = false;
}

// ── API Key Management ────────────────────────────────────────────────────────

public class ApiKeyResponse
{
    public int Id { get; set; }
    public string Label { get; set; } = string.Empty;
    /// <summary>Chỉ trả về 4 ký tự cuối để bảo mật.</summary>
    public string KeySuffix { get; set; } = string.Empty;
    /// <summary>openrouter | groq | openai | gemini</summary>
    public string Provider { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    // Runtime status từ pool
    public bool IsInCooldown { get; set; }
    public DateTime? CooldownExpiresAt { get; set; }
}

public class CreateApiKeyRequest
{
    [Required, MaxLength(100)]
    public string Label { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string KeyValue { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Notes { get; set; }
}

public class UpdateApiKeyRequest
{
    [MaxLength(100)]
    public string? Label { get; set; }

    public bool? IsActive { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    /// <summary>Nếu cung cấp, thay thế giá trị key.</summary>
    [MaxLength(200)]
    public string? KeyValue { get; set; }
}

// ── Statistics & Comparison ───────────────────────────────────────────────────

public class StatsCompareRequest
{
    /// <summary>Loại so sánh: day | month | quarter | year</summary>
    [Required]
    public string Period { get; set; } = "month";

    /// <summary>Kỳ 1: ISO date string (yyyy-MM-dd)</summary>
    [Required]
    public string PeriodA { get; set; } = string.Empty;

    /// <summary>Kỳ 2: ISO date string (yyyy-MM-dd)</summary>
    [Required]
    public string PeriodB { get; set; } = string.Empty;
}

public class PeriodStats
{
    public string Label { get; set; } = string.Empty;
    public DateTime From { get; set; }
    public DateTime To { get; set; }
    public int NewUsers { get; set; }
    public int ActiveUsers { get; set; }
    public int TotalContentGenerated { get; set; }
    public int TotalApiCalls { get; set; }
    public int NewKnowledgeItems { get; set; }
    public int NewTrends { get; set; }
}

public class StatsCompareResponse
{
    public PeriodStats PeriodA { get; set; } = new();
    public PeriodStats PeriodB { get; set; } = new();
    public PeriodDiff Diff { get; set; } = new();
}

public class PeriodDiff
{
    public int NewUsersDiff { get; set; }
    public double NewUsersChangePercent { get; set; }
    public int ContentGeneratedDiff { get; set; }
    public double ContentGeneratedChangePercent { get; set; }
    public int NewKnowledgeDiff { get; set; }
    public double NewKnowledgeChangePercent { get; set; }
    public int NewTrendsDiff { get; set; }
    public double NewTrendsChangePercent { get; set; }
}

public class DashboardSummaryResponse
{
    public int TotalUsers { get; set; }
    public int ActiveUsers { get; set; }
    public int TotalContentGenerated { get; set; }
    public int TotalKnowledgeItems { get; set; }
    public int TotalTrends { get; set; }
    public int ActiveApiKeys { get; set; }
    public int CoolingDownApiKeys { get; set; }
    public List<DailyStatPoint> Last7DaysContent { get; set; } = new();
}

public class DailyStatPoint
{
    public string Date { get; set; } = string.Empty;
    public int ContentGenerated { get; set; }
    public int NewUsers { get; set; }
}

// ── Tier Management ───────────────────────────────────────────────────────────

public class UpdateUserTierRequest
{
    /// <summary>Free | Pro | Enterprise</summary>
    [Required]
    public string Tier { get; set; } = "Free";

    /// <summary>
    /// Override quota tùy chỉnh. Null = dùng mặc định của tier.
    /// -1 = unlimited (chỉ hợp lệ với Enterprise).
    /// </summary>
    public int? CustomDailyQuota { get; set; }
}

// ── User Quota (public endpoint) ──────────────────────────────────────────────

public class UserQuotaResponse
{
    public int UserId { get; set; }
    public string Tier { get; set; } = "Free";
    public int DailyQuotaLimit { get; set; }
    public int RemainingQuota { get; set; }
    public bool IsUnlimited { get; set; }
    public DateTime LastQuotaReset { get; set; }
    public DateTime NextResetAt { get; set; }
    public double UsagePercent { get; set; }
}
