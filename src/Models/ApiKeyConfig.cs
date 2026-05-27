using System.ComponentModel.DataAnnotations;

namespace SocialSense.Models;

/// <summary>
/// Lưu trữ Gemini API keys trong database để admin có thể quản lý qua web.
/// </summary>
public class ApiKeyConfig
{
    [Key]
    public Guid Id { get; set; }

    /// <summary>Tên hiển thị để dễ nhận biết, ví dụ: "Key Gmail Phụ 1"</summary>
    [Required]
    [MaxLength(100)]
    public string Label { get; set; } = string.Empty;

    /// <summary>Giá trị API key thực tế</summary>
    [Required]
    [MaxLength(200)]
    public string KeyValue { get; set; } = string.Empty;

    /// <summary>Bật/tắt key này mà không cần xóa</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>Ghi chú tùy ý của admin</summary>
    [MaxLength(500)]
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
