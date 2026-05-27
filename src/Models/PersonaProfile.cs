using System.Collections.Generic;

namespace SocialSense.Models;

public class PersonaProfile
{
    public string? JobTitle { get; set; }
    public string? ToneOfVoice { get; set; }
    public List<string> PlatformPreferences { get; set; } = new();
    public List<string> TargetAudience { get; set; } = new();
    public List<string> ContentFormats { get; set; } = new();
    public List<string> NegativeConstraints { get; set; } = new();
    public string Language { get; set; } = "vi";
}
