namespace SocialSense.DTOs.Trends;

public class TrendItemResponse
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Summary { get; set; } = string.Empty;

    public string SourceUrl { get; set; } = string.Empty;

    public int HotLevel { get; set; }

    public DateTime CreatedAt { get; set; }

    public List<TagResponse> Tags { get; set; } = new();
}
