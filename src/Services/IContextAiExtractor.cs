namespace SocialSense.Services;

public interface IContextAiExtractor
{
    Task<ExtractedPersona> ExtractPersonaAsync(List<string> answers, string language, CancellationToken ct);
}

public class ExtractedPersona
{
    public string? JobTitle { get; set; }

    public string? ToneOfVoice { get; set; }

    public List<string> PlatformPreferences { get; set; } = new();

    public List<string> TargetAudience { get; set; } = new();

    public List<string> ContentFormats { get; set; } = new();

    public List<string> NegativeConstraints { get; set; } = new();
}
