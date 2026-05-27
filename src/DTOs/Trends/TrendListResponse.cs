namespace SocialSense.DTOs.Trends;

public class TrendListResponse
{
    public List<TrendItemResponse> Items { get; set; } = new();

    public int Page { get; set; }

    public int PageSize { get; set; }

    public int Total { get; set; }
}
