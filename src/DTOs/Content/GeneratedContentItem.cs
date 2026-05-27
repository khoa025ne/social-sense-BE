namespace SocialSense.DTOs.Content;

public class GeneratedContentItem
{
    public string Platform { get; set; } = string.Empty;

    public string Hook { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public string Cta { get; set; } = string.Empty;

    public List<string> Hashtags { get; set; } = new();

    public string Language { get; set; } = "vi";

    public string? MediaUrl { get; set; }

    public string? BannerImagePrompt { get; set; }

    public string? BestTimeToPost { get; set; }
}
