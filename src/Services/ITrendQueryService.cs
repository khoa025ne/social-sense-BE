using SocialSense.DTOs.Trends;

namespace SocialSense.Services;

public interface ITrendQueryService
{
    Task<TrendListResponse> GetTrendsAsync(TrendListRequest request, CancellationToken ct);

    Task<List<TagResponse>> GetTagsAsync(CancellationToken ct);
}
