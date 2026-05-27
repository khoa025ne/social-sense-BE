namespace SocialSense.Configuration;

public class EmbeddingOptions
{
    public bool Enabled { get; set; }

    public string ApiKey { get; set; } = string.Empty;

    public string Model { get; set; } = "text-embedding-004";

    public string Endpoint { get; set; } = "https://generativelanguage.googleapis.com/v1beta";

    public int TimeoutSeconds { get; set; } = 30;

    public int VectorSize { get; set; } = 768;
}
