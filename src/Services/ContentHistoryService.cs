using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SocialSense.Data;
using SocialSense.DTOs.Content;
using SocialSense.Models;

namespace SocialSense.Services;

public class ContentHistoryService : IContentHistoryService
{
    private readonly AppDbContext _db;
    private readonly ILogger<ContentHistoryService> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public ContentHistoryService(AppDbContext db, ILogger<ContentHistoryService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public Task SaveHistoryAsync(int userId, int? originalTrendId, string generatedContentJson, CancellationToken ct)
    {
        return SaveHistoryAsync(userId, originalTrendId, generatedContentJson, null, ct);
    }

    public async Task SaveHistoryAsync(int userId, int? originalTrendId, string generatedContentJson, string? mediaUrl, CancellationToken ct)
    {
        try
        {
            var history = new ContentHistory
            {
                UserId = userId,
                OriginalTrendId = originalTrendId,
                GeneratedContent = generatedContentJson,
                MediaUrl = mediaUrl,
                IsEdited = false,
                CreatedAt = DateTime.UtcNow
            };

            _db.ContentHistories.Add(history);
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save content generation history for user {UserId}", userId);
            throw;
        }
    }

    public async Task<PaginatedHistoryResponse> GetHistoryAsync(int userId, int page, int pageSize, CancellationToken ct)
    {
        var query = _db.ContentHistories.AsNoTracking().Where(h => h.UserId == userId);

        var totalCount = await query.CountAsync(ct);

        var histories = await query
            .OrderByDescending(h => h.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = new List<HistoryItemResponse>();
        foreach (var h in histories)
        {
            List<GeneratedContentItem> generatedContentList;
            try
            {
                generatedContentList = JsonSerializer.Deserialize<List<GeneratedContentItem>>(h.GeneratedContent, JsonOptions)
                    ?? new List<GeneratedContentItem>();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to deserialize GeneratedContent for history {HistoryId}", h.Id);
                generatedContentList = new List<GeneratedContentItem>();
            }

            EditHistoryContentRequest? userEditedContent = null;
            if (!string.IsNullOrWhiteSpace(h.UserEditedContent))
            {
                try
                {
                    userEditedContent = JsonSerializer.Deserialize<EditHistoryContentRequest>(h.UserEditedContent, JsonOptions);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to deserialize UserEditedContent for history {HistoryId}", h.Id);
                }
            }

            items.Add(new HistoryItemResponse
            {
                Id = h.Id,
                UserId = h.UserId,
                OriginalTrendId = h.OriginalTrendId,
                GeneratedContent = generatedContentList,
                UserEditedContent = userEditedContent,
                IsEdited = h.IsEdited,
                MediaUrl = h.MediaUrl,
                CreatedAt = h.CreatedAt
            });
        }

        return new PaginatedHistoryResponse
        {
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            Items = items
        };
    }

    public async Task<bool> EditHistoryAsync(int id, EditHistoryContentRequest request, CancellationToken ct)
    {
        var history = await _db.ContentHistories.FirstOrDefaultAsync(h => h.Id == id, ct);
        if (history == null)
        {
            return false;
        }

        try
        {
            var serialized = JsonSerializer.Serialize(request, JsonOptions);
            history.UserEditedContent = serialized;
            history.IsEdited = true;

            await _db.SaveChangesAsync(ct);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update content history {HistoryId} with user edits", id);
            return false;
        }
    }
}
