using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SocialSense.Models;

/// <summary>
/// Lưu trữ AI API keys trong database.
/// KeyValue được mã hóa AES-256 trước khi lưu.
/// </summary>
public class ApiKeyConfig
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Label { get; set; } = string.Empty;

    /// <summary>Giá trị API key — được mã hóa AES-256 khi IsEncrypted = true</summary>
    [Required]
    [MaxLength(500)]
    public string KeyValue { get; set; } = string.Empty;

    /// <summary>true = KeyValue đang được mã hóa AES-256</summary>
    public bool IsEncrypted { get; set; } = false;

    public bool IsActive { get; set; } = true;

    /// <summary>openrouter | groq | openai | gemini</summary>
    [MaxLength(50)]
    public string Provider { get; set; } = "openrouter";

    /// <summary>Model ID override. Null = dùng model mặc định của provider.</summary>
    [MaxLength(200)]
    public string? ModelOverride { get; set; }

    /// <summary>Model này có hỗ trợ generate ảnh không (multimodal)</summary>
    public bool SupportsImageGen { get; set; } = false;

    /// <summary>Ghi chú tùy ý của admin</summary>
    [MaxLength(500)]
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
