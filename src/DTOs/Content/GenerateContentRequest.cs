using System.ComponentModel.DataAnnotations;

namespace SocialSense.DTOs.Content;

public class GenerateContentRequest
{
    [Required]
    [MaxLength(64)]
    public string UserId { get; set; } = string.Empty;

    public Guid? TrendId { get; set; }

    [Range(1, 3)]
    public int OutputCount { get; set; } = 1;

    [RegularExpression("^(vi|en)$", ErrorMessage = "Language must be vi or en.")]
    public string? Language { get; set; }

    public List<string>? TargetPlatforms { get; set; }

    public bool GenerateImage { get; set; } = false;
}
