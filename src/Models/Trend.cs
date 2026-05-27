using System.ComponentModel.DataAnnotations;

namespace SocialSense.Models;

public class Trend
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [MaxLength(1000)]
    public string Summary { get; set; } = string.Empty;

    [Required]
    [MaxLength(500)]
    public string SourceUrl { get; set; } = string.Empty;

    public int HotLevel { get; set; }

    [Required]
    [MaxLength(20)]
    public string Sentiment { get; set; } = "neutral";

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
