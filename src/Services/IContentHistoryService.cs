using System;
using System.Threading;
using System.Threading.Tasks;
using SocialSense.DTOs.Content;

namespace SocialSense.Services;

public interface IContentHistoryService
{
    Task SaveHistoryAsync(int userId, int? originalTrendId, string generatedContentJson, CancellationToken ct);

    Task SaveHistoryAsync(int userId, int? originalTrendId, string generatedContentJson, string? mediaUrl, CancellationToken ct);

    Task<PaginatedHistoryResponse> GetHistoryAsync(int userId, int page, int pageSize, CancellationToken ct);

    Task<bool> EditHistoryAsync(int id, EditHistoryContentRequest request, CancellationToken ct);
}
