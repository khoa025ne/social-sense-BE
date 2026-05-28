using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SocialSense.Models;

/// <summary>
/// Free:       5 lượt/ngày
/// Pro:        50 lượt/ngày
/// Enterprise: 500 lượt/ngày (hoặc unlimited nếu DailyQuotaLimit = -1)
/// </summary>
public enum UserTier
{
    Free = 0,
    Pro = 1,
    Enterprise = 2
}

public class User
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    [MaxLength(160)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(160)]
    public string? DisplayName { get; set; }

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    public bool HasContext { get; set; }

    public bool IsActive { get; set; } = true;

    /// <summary>Tier của user: Free / Pro / Enterprise</summary>
    public UserTier Tier { get; set; } = UserTier.Free;

    /// <summary>
    /// Số lượt tạo content tối đa mỗi ngày.
    /// -1 = unlimited (chỉ dùng cho Enterprise).
    /// Mặc định theo tier: Free=5, Pro=50, Enterprise=500.
    /// Admin có thể override giá trị này.
    /// </summary>
    public int DailyQuotaLimit { get; set; } = 5;

    /// <summary>Số lượt còn lại hôm nay.</summary>
    public int RemainingQuota { get; set; } = 5;

    public DateTime LastQuotaReset { get; set; } = DateTime.UtcNow;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    // ── Tier defaults ─────────────────────────────────────────────────────────
    public static int GetDefaultQuota(UserTier tier) => tier switch
    {
        UserTier.Free       => 5,
        UserTier.Pro        => 50,
        UserTier.Enterprise => 500,
        _                   => 5
    };
}
