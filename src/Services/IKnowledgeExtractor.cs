using System.Threading;
using System.Threading.Tasks;
using SocialSense.DTOs.Knowledge;

namespace SocialSense.Services;

public interface IKnowledgeExtractor
{
    Task<GeminiKnowledgeOutput> ExtractKnowledgeAsync(string chunkText, CancellationToken ct);

    Task<GeminiTrendOutput> ExtractTrendAsync(string text, List<RecentTrendDto> recentTrends, CancellationToken ct);
}
