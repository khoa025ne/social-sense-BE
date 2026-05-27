namespace SocialSense.Configuration;

public class QdrantOptions
{
    public bool Enabled { get; set; }

    public string Endpoint { get; set; } = "http://localhost:6333";

    public string Collection { get; set; } = "user_persona";

    public string TrendCollection { get; set; } = "trends";

    public int VectorSize { get; set; } = 768;

    public int TopK { get; set; } = 5;

    public string? ApiKey { get; set; }

    public string Distance { get; set; } = "Cosine";
}
