using System;
using System.Threading;
using System.Threading.Tasks;
using SocialSense.DTOs.Content;

namespace SocialSense.Services;

public interface IContentHistoryService
{
    Task SaveHistoryAsync(string userId, Guid? originalTrendId, string generatedContentJson, CancellationToken ct);

    Task SaveHistoryAsync(string userId, Guid? originalTrendId, string generatedContentJson, string? mediaUrl, CancellationToken ct);

    Task<PaginatedHistoryResponse> GetHistoryAsync(string userId, int page, int pageSize, CancellationToken ct);

    Task<bool> EditHistoryAsync(Guid id, EditHistoryContentRequest request, CancellationToken ct);
}
