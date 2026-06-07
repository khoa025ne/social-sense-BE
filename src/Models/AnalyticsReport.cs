using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SocialSense.Models;

/// <summary>
/// Lưu kết quả phân tích analytics của từng user.
/// Mỗi record = 1 lần phân tích (có thể là 1 kỳ hoặc so sánh 2 kỳ).
/// </summary>
public class AnalyticsReport
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    public int UserId { get; set; }

    /// <summary>TikTok | Facebook | Instagram | YouTube</summary>
    [MaxLength(50)]
    public string Platform { get; set; } = string.Empty;

    /// <summary>single | compare</summary>
    [MaxLength(20)]
    public string ReportType { get; set; } = "single";

    /// <summary>Label kỳ chính (VD: "Tháng 5/2026")</summary>
    [MaxLength(100)]
    public string PeriodALabel { get; set; } = string.Empty;

    /// <summary>Label kỳ so sánh (null nếu single)</summary>
    [MaxLength(100)]
    public string? PeriodBLabel { get; set; }

    /// <summary>JSON của metrics kỳ A (AnalyticsMetrics)</summary>
    [Required]
    public string MetricsAJson { get; set; } = string.Empty;

    /// <summary>JSON của metrics kỳ B (null nếu single)</summary>
    public string? MetricsBJson { get; set; }

    /// <summary>JSON kết quả AI phân tích (AnalyticsResult)</summary>
    [Required]
    public string ResultJson { get; set; } = string.Empty;

    /// <summary>Điểm tổng thể AI chấm (0-100)</summary>
    public int OverallScore { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
