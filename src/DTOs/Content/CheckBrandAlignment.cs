using System.ComponentModel.DataAnnotations;

namespace SocialSense.DTOs.Content;

public class CheckBrandAlignmentRequest
{
    [Required]
    [MaxLength(64)]
    public string UserId { get; set; } = string.Empty;

    [Required]
    [MinLength(10, ErrorMessage = "DraftContent must be at least 10 characters.")]
    public string DraftContent { get; set; } = string.Empty;
}

public class CheckBrandAlignmentResponse
{
    public int BrandScore { get; set; }
    public string Analysis { get; set; } = string.Empty;
    public string Suggestions { get; set; } = string.Empty;
    public string RefinedContent { get; set; } = string.Empty;
}
