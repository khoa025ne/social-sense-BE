namespace SocialSense.Configuration;

public class ImageGeneratorOptions
{
    public string Provider { get; set; } = "DALLE3";
    public string ApiKey { get; set; } = string.Empty;
    public bool Enabled { get; set; } = false;
    public int TimeoutSeconds { get; set; } = 60;
}
