using System;
using System.Collections.Generic;

namespace SocialSense.DTOs.Content;

public class HistoryItemResponse
{
    public Guid Id { get; set; }

    public string UserId { get; set; } = string.Empty;

    public Guid? OriginalTrendId { get; set; }

    public List<GeneratedContentItem> GeneratedContent { get; set; } = new();

    public EditHistoryContentRequest? UserEditedContent { get; set; }

    public bool IsEdited { get; set; }

    public string? MediaUrl { get; set; }

    public DateTime CreatedAt { get; set; }
}
