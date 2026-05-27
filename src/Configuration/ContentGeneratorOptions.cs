namespace SocialSense.Configuration;

public class ContentGeneratorOptions
{
    public bool Enabled { get; set; }

    public string ApiKey { get; set; } = string.Empty;

    public string Model { get; set; } = "meta-llama/llama-4-scout";

    /// <summary>
    /// Base URL của provider.
    /// OpenRouter: https://openrouter.ai/api/v1
    /// Groq:       https://api.groq.com/openai/v1
    /// </summary>
    public string Endpoint { get; set; } = "https://openrouter.ai/api/v1";

    public int TimeoutSeconds { get; set; } = 60;

    public double Temperature { get; set; } = 0.7;

    public int MaxOutputTokens { get; set; } = 2048;

    public int MaxTitleLength { get; set; } = 120;

    public int MaxBodyLength { get; set; } = 1200;

    public int MaxHashtags { get; set; } = 6;

    public bool MultiPlatformEnabled { get; set; } = true;

    /// <summary>Số lượng KnowledgeItems tối đa đưa vào prompt.</summary>
    public int MaxKnowledgeItems { get; set; } = 5;

    /// <summary>Số ký tự tối đa của RawContent mỗi KnowledgeItem trong prompt.</summary>
    public int MaxKnowledgeContentLength { get; set; } = 300;
}
