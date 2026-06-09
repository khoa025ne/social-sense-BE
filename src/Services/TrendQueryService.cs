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

        return await BuildResponseAsync(trends, total, page, pageSize, ct);
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

    public async Task<TrendListResponse> GetRecommendedAsync(int userId, int page, int pageSize, CancellationToken ct)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize < 1 ? 20 : Math.Min(pageSize, MaxPageSize);

        // Lấy context (persona) của user
        var context = await _db.UserContexts.AsNoTracking()
            .Where(c => c.UserId == userId && c.IsActive)
            .OrderByDescending(c => c.Version)
            .FirstOrDefaultAsync(ct);

        // Nếu chưa có context → trả về trends mới nhất như bình thường
        if (context == null)
            return await GetTrendsAsync(new TrendListRequest { Page = page, PageSize = pageSize }, ct);

        // Parse keywords từ persona JSON fields
        var keywords = new List<string>();

        if (!string.IsNullOrWhiteSpace(context.PlatformPreferencesJson))
        {
            try
            {
                var platforms = System.Text.Json.JsonSerializer.Deserialize<List<string>>(context.PlatformPreferencesJson);
                if (platforms != null)
                    keywords.AddRange(platforms.Select(s => s.ToLower().Trim()));
            }
            catch { }
        }

        if (!string.IsNullOrWhiteSpace(context.TargetAudienceJson))
        {
            try
            {
                var audience = System.Text.Json.JsonSerializer.Deserialize<List<string>>(context.TargetAudienceJson);
                if (audience != null)
                    keywords.AddRange(audience.Select(s => s.ToLower().Trim()));
            }
            catch { }
        }

        if (!string.IsNullOrWhiteSpace(context.JobTitle))
            keywords.AddRange(context.JobTitle.ToLower()
                .Split(new[] { ' ', ',', '/', '-' }, StringSplitOptions.RemoveEmptyEntries)
                .Where(w => w.Length > 2));

        keywords = keywords.Distinct().ToList();

        // Không có keyword nào → fallback
        if (keywords.Count == 0)
            return await GetTrendsAsync(new TrendListRequest { Page = page, PageSize = pageSize }, ct);

        // Lấy tag IDs khớp với keywords từ persona
        var allTags = await _db.Tags.AsNoTracking().ToListAsync(ct);
        var matchedTagIds = allTags
            .Where(t => keywords.Any(kw =>
                t.Name.ToLower().Contains(kw) || kw.Contains(t.Name.ToLower())))
            .Select(t => t.Id)
            .ToList();

        if (matchedTagIds.Count == 0)
            return await GetTrendsAsync(new TrendListRequest { Page = page, PageSize = pageSize }, ct);

        // Trends có tag khớp persona → ưu tiên lên đầu
        var matchedTrendIds = await _db.TrendTags.AsNoTracking()
            .Where(tt => matchedTagIds.Contains(tt.TagId))
            .GroupBy(tt => tt.TrendId)
            .OrderByDescending(g => g.Count())
            .Select(g => g.Key)
            .ToListAsync(ct);

        var matchedTrends = await _db.Trends.AsNoTracking()
            .Where(t => matchedTrendIds.Contains(t.Id))
            .OrderByDescending(t => t.HotLevel)
            .ThenByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        var otherTrends = await _db.Trends.AsNoTracking()
            .Where(t => !matchedTrendIds.Contains(t.Id))
            .OrderByDescending(t => t.HotLevel)
            .ThenByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        var combined = matchedTrends.Concat(otherTrends).ToList();
        var total = combined.Count;
        var paged = combined.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return await BuildResponseAsync(paged, total, page, pageSize, ct);
    }

    private async Task<TrendListResponse> BuildResponseAsync(
        List<SocialSense.Models.Trend> trends, int total, int page, int pageSize, CancellationToken ct)
    {
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

        return new TrendListResponse { Page = page, PageSize = pageSize, Total = total, Items = items };
    }
}
