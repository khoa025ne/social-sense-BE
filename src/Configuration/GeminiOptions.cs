namespace SocialSense.Configuration;

public class GeminiOptions
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

    public double Temperature { get; set; } = 0.2;

    public int MaxOutputTokens { get; set; } = 1024;

    public int SummaryMaxLength { get; set; } = 1000;

    public int TagLimit { get; set; } = 8;
}
