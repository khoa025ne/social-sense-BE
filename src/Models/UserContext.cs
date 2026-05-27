using System.ComponentModel.DataAnnotations;

namespace SocialSense.Models;

public class UserContext
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    [MaxLength(64)]
    public string UserId { get; set; } = string.Empty;

    [Required]
    [MaxLength(2)]
    public string Language { get; set; } = "vi";

    [Required]
    public string RawAnswersJson { get; set; } = "[]";

    [MaxLength(120)]
    public string? JobTitle { get; set; }

    [MaxLength(60)]
    public string? ToneOfVoice { get; set; }

    public string? PlatformPreferencesJson { get; set; }

    public string? TargetAudienceJson { get; set; }

    public string? ContentFormatsJson { get; set; }

    public string? NegativeConstraintsJson { get; set; }

    public int Version { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
