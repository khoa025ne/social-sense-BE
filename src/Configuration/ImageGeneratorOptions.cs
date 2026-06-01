namespace SocialSense.Configuration;

public class ImageGeneratorOptions
{
    public string Provider { get; set; } = "Pollinations";
    /// <summary>API key cho DALL-E 3 (OpenAI). Không dùng cho Pollinations.</summary>
    public string ApiKey { get; set; } = string.Empty;
    public bool Enabled { get; set; } = true;
    public int TimeoutSeconds { get; set; } = 60;
}
