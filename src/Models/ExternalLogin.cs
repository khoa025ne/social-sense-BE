using System.ComponentModel.DataAnnotations;

namespace SocialSense.Models;

public class ExternalLogin
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    [MaxLength(64)]
    public string UserId { get; set; } = string.Empty;

    [Required]
    [MaxLength(40)]
    public string Provider { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string ProviderKey { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}
