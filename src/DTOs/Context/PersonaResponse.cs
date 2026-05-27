namespace SocialSense.DTOs.Context;

public class PersonaResponse
{
    public string UserId { get; set; } = string.Empty;

    public int Version { get; set; }

    public string Language { get; set; } = "vi";

    public string? JobTitle { get; set; }

    public string? ToneOfVoice { get; set; }

    public List<string> PlatformPreferences { get; set; } = new();

    public List<string> TargetAudience { get; set; } = new();

    public List<string> ContentFormats { get; set; } = new();

    public List<string> NegativeConstraints { get; set; } = new();

    public DateTime UpdatedAt { get; set; }
}
