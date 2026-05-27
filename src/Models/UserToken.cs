using System.ComponentModel.DataAnnotations;

namespace SocialSense.Models;

public class UserToken
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    [MaxLength(64)]
    public string UserId { get; set; } = string.Empty;

    [Required]
    [MaxLength(256)]
    public string RefreshToken { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    public bool IsRevoked { get; set; }
}
