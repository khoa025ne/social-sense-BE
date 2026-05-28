using System.ComponentModel.DataAnnotations;

namespace SocialSense.DTOs.Content;

/// <summary>
/// TrendBased: AI chọn trend phù hợp rồi sinh content xoay quanh trend đó (mặc định).
/// PersonaDriven: AI đọc sâu persona, tự suy luận sản phẩm/ngành nghề và sinh content
///               thuần tâm lý mà không cần trend — phù hợp với người bán hàng, BĐS, dịch vụ...
/// </summary>
public enum ContentMode
{
    TrendBased,
    PersonaDriven
}

public class GenerateContentRequest
{
    [Required]
    [MaxLength(64)]
    public string UserId { get; set; } = string.Empty;

    public Guid? TrendId { get; set; }

    [Range(1, 3)]
    public int OutputCount { get; set; } = 1;

    [RegularExpression("^(vi|en)$", ErrorMessage = "Language must be vi or en.")]
    public string? Language { get; set; }

    public List<string>? TargetPlatforms { get; set; }

    public bool GenerateImage { get; set; } = false;

    /// <summary>
    /// Yêu cầu bổ sung từ người dùng: chủ đề cụ thể, sản phẩm muốn quảng bá,
    /// phong cách viết, điểm nhấn nội dung, v.v.
    /// Ví dụ: "Tập trung vào dự án Vinhomes Grand Park, nhấn mạnh tiện ích hồ bơi và trường học"
    /// </summary>
    [MaxLength(1000)]
    public string? UserInstruction { get; set; }

    /// <summary>
    /// TrendBased (mặc định): sinh content dựa trên trend + knowledge base.
    /// PersonaDriven: AI đọc sâu persona, tự suy luận ngành nghề và áp dụng
    ///               công thức tâm lý phù hợp — không cần trend.
    /// </summary>
    public ContentMode Mode { get; set; } = ContentMode.TrendBased;
}
