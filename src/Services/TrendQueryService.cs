using Microsoft.EntityFrameworkCore;
using SocialSense.Data;
using SocialSense.DTOs.Trends;

namespace SocialSense.Services;

public class TrendQueryService : ITrendQueryService
{
    private const int MaxPageSize = 100;
    private readonly AppDbContext _db;

    public TrendQueryService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<TrendListResponse> GetTrendsAsync(TrendListRequest request, CancellationToken ct)
    {
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize < 1 ? 20 : Math.Min(request.PageSize, MaxPageSize);

        var query = _db.Trends.AsNoTracking();
        if (request.TagId.HasValue)
        {
            var tagId = request.TagId.Value;
            query = query.Where(t => _db.TrendTags.Any(tt => tt.TrendId == t.Id && tt.TagId == tagId));
        }

        var total = await query.CountAsync(ct);
        var trends = await query
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var trendIds = trends.Select(t => t.Id).ToList();
        var tagPairs = await _db.TrendTags.AsNoTracking()
            .Where(tt => trendIds.Contains(tt.TrendId))
            .Join(_db.Tags.AsNoTracking(), tt => tt.TagId, t => t.Id,
                (tt, tag) => new { tt.TrendId, Tag = new TagResponse { Id = tag.Id, Name = tag.Name, Slug = tag.Slug } })
            .ToListAsync(ct);

        var tagsByTrend = tagPairs
            .GroupBy(x => x.TrendId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Tag).ToList());

        var items = trends.Select(t => new TrendItemResponse
        {
            Id = t.Id,
            Title = t.Title,
            Summary = t.Summary,
            SourceUrl = t.SourceUrl,
            HotLevel = t.HotLevel,
            CreatedAt = t.CreatedAt,
            Tags = tagsByTrend.TryGetValue(t.Id, out var tags) ? tags : new List<TagResponse>()
        }).ToList();

        return new TrendListResponse
        {
            Page = page,
            PageSize = pageSize,
            Total = total,
            Items = items
        };
    }

    public async Task<List<TagResponse>> GetTagsAsync(CancellationToken ct)
    {
        return await _db.Tags.AsNoTracking()
            .OrderBy(t => t.Name)
            .Select(t => new TagResponse
            {
                Id = t.Id,
                Name = t.Name,
                Slug = t.Slug
            })
            .ToListAsync(ct);
    }
}
