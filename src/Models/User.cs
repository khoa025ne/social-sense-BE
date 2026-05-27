using System.ComponentModel.DataAnnotations;

namespace SocialSense.Models;

public class User
{
    [Key]
    [MaxLength(64)]
    public string Id { get; set; } = string.Empty;

    [Required]
    [MaxLength(160)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(160)]
    public string? DisplayName { get; set; }

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    public bool HasContext { get; set; }

    public bool IsActive { get; set; } = true;

    public int DailyQuotaLimit { get; set; } = 10;

    public int RemainingQuota { get; set; } = 10;

    public DateTime LastQuotaReset { get; set; } = DateTime.UtcNow;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
