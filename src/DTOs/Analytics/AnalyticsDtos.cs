using System.ComponentModel.DataAnnotations;

namespace SocialSense.DTOs.Analytics;

// ── Input ─────────────────────────────────────────────────────────────────────

/// <summary>Metrics của 1 kỳ báo cáo — tất cả nullable để hỗ trợ điền một phần</summary>
public class AnalyticsMetrics
{
    /// <summary>TikTok | Facebook | Instagram | YouTube</summary>
    [Required, MaxLength(50)]
    public string Platform { get; set; } = string.Empty;

    /// <summary>VD: "Tháng 5/2026", "Tuần 1 tháng 6"</summary>
    [Required, MaxLength(100)]
    public string PeriodLabel { get; set; } = string.Empty;

    public long? Reach { get; set; }
    public long? Impressions { get; set; }
    public long? TotalEngagement { get; set; }
    public long? Likes { get; set; }
    public long? Comments { get; set; }
    public long? Shares { get; set; }
    public long? Clicks { get; set; }
    public long? NewFollowers { get; set; }
    public long? ProfileVisits { get; set; }

    /// <summary>% — VD: 18.6</summary>
    public double? EngagementRate { get; set; }

    /// <summary>% — VD: 72.4</summary>
    public double? CompletionRate { get; set; }

    /// <summary>Giây — VD: 108 (= 1:48)</summary>
    public double? AvgViewDurationSeconds { get; set; }

    /// <summary>% — VD: 3.2</summary>
    public double? ConversionRate { get; set; }

    /// <summary>% — VD: 5.1</summary>
    public double? ClickThroughRate { get; set; }

    /// <summary>Số bài đăng trong kỳ</summary>
    public int? PostsCount { get; set; }
}

/// <summary>Request phân tích 1 kỳ</summary>
public class AnalyzeSingleRequest
{
    [Required]
    public AnalyticsMetrics Metrics { get; set; } = new();
}

/// <summary>Request so sánh 2 kỳ</summary>
public class AnalyzeCompareRequest
{
    [Required]
    public AnalyticsMetrics PeriodA { get; set; } = new();

    [Required]
    public AnalyticsMetrics PeriodB { get; set; } = new();
}

// ── Output ────────────────────────────────────────────────────────────────────

public class MetricComparison
{
    public string MetricKey { get; set; } = string.Empty;
    public string MetricName { get; set; } = string.Empty;
    public string? ValueAFormatted { get; set; }
    public string? ValueBFormatted { get; set; }
    public double? ChangePercent { get; set; }

    /// <summary>good | warning | neutral | critical</summary>
    public string Status { get; set; } = "neutral";

    /// <summary>Giải thích ngắn gọn tiếng Việt cho người mới</summary>
    public string SimpleExplain { get; set; } = string.Empty;

    /// <summary>Phân tích chuyên sâu từ AI</summary>
    public string Detail { get; set; } = string.Empty;

    /// <summary>true = tăng là tốt; false = giảm là tốt (VD: Bounce Rate)</summary>
    public bool HigherIsBetter { get; set; } = true;
}

public class AnalyticsSummary
{
    public List<string> Highlights { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
    public int OverallScore { get; set; }

    /// <summary>growing | declining | stable</summary>
    public string OverallTrend { get; set; } = "stable";

    public string TopRecommendation { get; set; } = string.Empty;
}

public class AnalyticsResult
{
    public string Platform { get; set; } = string.Empty;
    public string ReportType { get; set; } = "single";
    public string PeriodALabel { get; set; } = string.Empty;
    public string? PeriodBLabel { get; set; }

    public List<MetricComparison> Metrics { get; set; } = new();
    public AnalyticsSummary Summary { get; set; } = new();

    /// <summary>Tường thuật AI dạng đoạn văn tự nhiên tiếng Việt</summary>
    public string AiNarrative { get; set; } = string.Empty;
}

public class AnalyticsReportResponse
{
    public int Id { get; set; }
    public string Platform { get; set; } = string.Empty;
    public string ReportType { get; set; } = string.Empty;
    public string PeriodALabel { get; set; } = string.Empty;
    public string? PeriodBLabel { get; set; }
    public AnalyticsResult Result { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}

public class AnalyticsHistoryItem
{
    public int Id { get; set; }
    public string Platform { get; set; } = string.Empty;
    public string ReportType { get; set; } = string.Empty;
    public string PeriodALabel { get; set; } = string.Empty;
    public string? PeriodBLabel { get; set; }
    public int OverallScore { get; set; }
    public string OverallTrend { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
