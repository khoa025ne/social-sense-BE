using System.ComponentModel.DataAnnotations;

namespace SocialSense.DTOs.Context;

public class UpdatePersonaRequest
{
    [MaxLength(120)]
    public string? JobTitle { get; set; }

    [MaxLength(60)]
    public string? ToneOfVoice { get; set; }

    public List<string>? PlatformPreferences { get; set; }

    public List<string>? TargetAudience { get; set; }

    public List<string>? ContentFormats { get; set; }

    public List<string>? NegativeConstraints { get; set; }

    [RegularExpression("^(vi|en)$", ErrorMessage = "Language must be vi or en.")]
    public string? Language { get; set; }
}
