using System.ComponentModel.DataAnnotations;

namespace SocialSense.Models;

public class ContentHistory
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    [MaxLength(64)]
    public string UserId { get; set; } = string.Empty;

    public Guid? OriginalTrendId { get; set; }

    [Required]
    public string GeneratedContent { get; set; } = string.Empty;

    public string? UserEditedContent { get; set; }

    public bool IsEdited { get; set; } = false;

    [MaxLength(500)]
    public string? MediaUrl { get; set; }

    public DateTime CreatedAt { get; set; }
}
