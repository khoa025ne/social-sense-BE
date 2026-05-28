using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SocialSense.Models;

public class KnowledgeItem
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    [MaxLength(250)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string SourceType { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? SourceUrlOrFileName { get; set; }

    [Required]
    [MaxLength(64)]
    public string ContentHash { get; set; } = string.Empty;

    [Required]
    public string RawContent { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}
