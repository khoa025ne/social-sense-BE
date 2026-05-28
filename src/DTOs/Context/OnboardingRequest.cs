using System.ComponentModel.DataAnnotations;

namespace SocialSense.DTOs.Context;

public class OnboardingRequest
{
    public int UserId { get; set; }

    [Required]
    [MinLength(3)]
    public List<string> Answers { get; set; } = new();

    [Required]
    [RegularExpression("^(vi|en)$", ErrorMessage = "Language must be vi or en.")]
    public string Language { get; set; } = "vi";
}
