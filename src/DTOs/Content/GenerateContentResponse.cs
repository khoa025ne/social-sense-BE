namespace SocialSense.DTOs.Content;

public class GenerateContentResponse
{
    public List<GeneratedContentItem> Items { get; set; } = new();
    public string? SelectedTrendTitle { get; set; }
    public string? SmartMatchReason { get; set; }
}
