using SocialSense.DTOs.Trends;

namespace SocialSense.Services;

public interface ITrendQueryService
{
    Task<TrendListResponse> GetTrendsAsync(TrendListRequest request, CancellationToken ct);
    Task<List<TagResponse>> GetTagsAsync(CancellationToken ct);
    Task<TrendListResponse> GetRecommendedAsync(int userId, int page, int pageSize, CancellationToken ct);
}
