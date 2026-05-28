using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace SocialSense.DTOs.Knowledge;

public class ManualKnowledgeRequest
{
    [Required]
    [StringLength(250, MinimumLength = 5, ErrorMessage = "Title must be between 5 and 250 characters.")]
    public string Title { get; set; } = string.Empty;

    [Required]
    [MinLength(100, ErrorMessage = "RawContent must be at least 100 characters.")]
    public string RawContent { get; set; } = string.Empty;
}

public class ScrapeKnowledgeRequest
{
    [Required]
    [Url(ErrorMessage = "TargetUrl must be a valid HTTP/HTTPS URL.")]
    public string TargetUrl { get; set; } = string.Empty;
}

public class GeminiKnowledgeOutput
{
    public string Title { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Category { get; set; } = "General";
    public List<string> Insights { get; set; } = new();
    public List<string> Keywords { get; set; } = new();
}

public class GeminiTrendOutput
{
    public bool IsTrend { get; set; }
    public string? MatchedTrendId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public int HotLevel { get; set; } = 3;
    public string Sentiment { get; set; } = "neutral";
    public List<string> Tags { get; set; } = new();
}

public class RecentTrendDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
}
