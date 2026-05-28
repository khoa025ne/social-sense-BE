using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SocialSense.Models;

public class ContentHistory
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    public int UserId { get; set; }

    public int? OriginalTrendId { get; set; }

    [Required]
    public string GeneratedContent { get; set; } = string.Empty;

    public string? UserEditedContent { get; set; }

    public bool IsEdited { get; set; } = false;

    [MaxLength(500)]
    public string? MediaUrl { get; set; }

    public DateTime CreatedAt { get; set; }
}
