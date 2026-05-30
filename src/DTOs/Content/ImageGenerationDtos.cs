using System.ComponentModel.DataAnnotations;

namespace SocialSense.DTOs.Content;

// ── Bước 1: Analyze ───────────────────────────────────────────────────────────

public class ImageAnalyzeRequest
{
    /// <summary>ID của content history đã tạo trước đó</summary>
    public int? ContentHistoryId { get; set; }

    /// <summary>Hoặc truyền thẳng content text nếu chưa lưu history</summary>
    [MaxLength(5000)]
    public string? ContentText { get; set; }

    /// <summary>Nền tảng mục tiêu để AI gợi ý kích thước banner phù hợp</summary>
    [MaxLength(60)]
    public string Platform { get; set; } = "Facebook";
}

public class ImageAnalyzeResponse
{
    /// <summary>Tóm tắt hình ảnh AI phân tích được từ content</summary>
    public string ImageSummary { get; set; } = string.Empty;

    /// <summary>Draft prompt sơ bộ — sẽ được tinh chỉnh ở bước 3</summary>
    public string DraftPrompt { get; set; } = string.Empty;

    /// <summary>Ngành nghề AI suy luận được (real_estate, fashion, food, tech, finance, education, other)</summary>
    public string DetectedIndustry { get; set; } = "other";

    /// <summary>Danh sách câu hỏi clarifying (tối đa 3)</summary>
    public List<ClarifyingQuestion> ClarifyingQuestions { get; set; } = new();

    /// <summary>Kích thước banner gợi ý theo platform</summary>
    public BannerSpecs BannerSpecs { get; set; } = new();
}

public class ClarifyingQuestion
{
    public string Id { get; set; } = string.Empty;
    public string Question { get; set; } = string.Empty;
    /// <summary>yesno | choice | text_optional</summary>
    public string Type { get; set; } = "yesno";
    public List<string>? Options { get; set; }
}

public class BannerSpecs
{
    public string Platform { get; set; } = string.Empty;
    public string Dimensions { get; set; } = string.Empty;
    public string AspectRatio { get; set; } = string.Empty;
    public string RecommendedStyle { get; set; } = string.Empty;
}

// ── Bước 3: Generate ─────────────────────────────────────────────────────────

public class ImageGenerateRequest
{
    /// <summary>ID content history (để lấy lại content text)</summary>
    public int? ContentHistoryId { get; set; }

    /// <summary>Hoặc truyền thẳng content text</summary>
    [MaxLength(5000)]
    public string? ContentText { get; set; }

    [MaxLength(60)]
    public string Platform { get; set; } = "Facebook";

    /// <summary>Draft prompt từ bước Analyze</summary>
    [Required]
    public string DraftPrompt { get; set; } = string.Empty;

    /// <summary>Ngành nghề từ bước Analyze</summary>
    public string DetectedIndustry { get; set; } = "other";

    /// <summary>Câu trả lời của user từ bước Refine</summary>
    public Dictionary<string, string> Answers { get; set; } = new();
}

public class ImageGenerateResponse
{
    /// <summary>URL ảnh đã tạo (nếu có image model)</summary>
    public string? ImageUrl { get; set; }

    /// <summary>Final prompt đã được build — FE có thể dùng với Midjourney/DALL-E</summary>
    public string FinalPrompt { get; set; } = string.Empty;

    /// <summary>Thông tin banner</summary>
    public BannerSpecs BannerSpecs { get; set; } = new();

    /// <summary>true = ảnh được tạo bởi AI, false = chỉ trả về prompt</summary>
    public bool IsGenerated { get; set; }

    /// <summary>Gợi ý cách dùng prompt với các tool khác nếu không có image model</summary>
    public string? PromptUsageTip { get; set; }
}
