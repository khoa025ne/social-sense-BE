namespace SocialSense.DTOs.Trends;

public class TrendListRequest
{
    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = 20;

    public Guid? TagId { get; set; }
}
