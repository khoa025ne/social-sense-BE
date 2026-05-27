namespace SocialSense.Services;

public class DummyContextAiExtractor : IContextAiExtractor
{
    public Task<ExtractedPersona> ExtractPersonaAsync(List<string> answers, string language, CancellationToken ct)
    {
        var persona = new ExtractedPersona
        {
            JobTitle = "Unknown",
            ToneOfVoice = "neutral",
            PlatformPreferences = new List<string>(),
            TargetAudience = new List<string>(),
            ContentFormats = new List<string>(),
            NegativeConstraints = new List<string>()
        };

        return Task.FromResult(persona);
    }
}
