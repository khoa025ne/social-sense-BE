using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SocialSense.Data;
using SocialSense.DTOs.Content;
using SocialSense.Services;

namespace SocialSense.Controllers;

[ApiController]
[Route("content/image")]
[Authorize]
public class ImageController : ControllerBase
{
    private readonly IImageGenerationService _service;
    private readonly AppDbContext _db;

    public ImageController(IImageGenerationService service, AppDbContext db)
    {
        _service = service;
        _db = db;
    }

    /// <summary>
    /// POST /content/image/analyze — Bước 1: AI đọc content, phân tích và trả về
    /// tóm tắt hình ảnh + câu hỏi clarifying + draft prompt.
    /// Không tốn quota.
    /// </summary>
    [HttpPost("analyze")]
    public async Task<IActionResult> Analyze(
        [FromBody] ImageAnalyzeRequest request, CancellationToken ct)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out var userId))
            return Unauthorized(new { code = "AUTH_INVALID_TOKEN" });

        if (request.ContentHistoryId == null && string.IsNullOrWhiteSpace(request.ContentText))
            return BadRequest(new
            {
                code = "IMAGE_CONTENT_REQUIRED",
                message = "Cần truyền contentHistoryId hoặc contentText."
            });

        var result = await _service.AnalyzeAsync(request, userId, ct);
        return Ok(result);
    }

    /// <summary>
    /// POST /content/image/generate — Bước 2: Nhận answers từ user,
    /// build final prompt và tạo ảnh. Tốn 1 quota như tạo content.
    /// </summary>
    [HttpPost("generate")]
    public async Task<IActionResult> Generate(
        [FromBody] ImageGenerateRequest request, CancellationToken ct)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out var userId))
            return Unauthorized(new { code = "AUTH_INVALID_TOKEN" });

        if (request.ContentHistoryId == null && string.IsNullOrWhiteSpace(request.ContentText))
            return BadRequest(new { code = "IMAGE_CONTENT_REQUIRED", message = "Cần truyền contentHistoryId hoặc contentText." });

        if (string.IsNullOrWhiteSpace(request.DraftPrompt))
            return BadRequest(new { code = "IMAGE_DRAFT_PROMPT_REQUIRED", message = "Cần truyền draftPrompt từ bước Analyze." });

        // ── Kiểm tra và trừ quota ─────────────────────────────────────────────
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null)
            return Unauthorized(new { code = "USER_NOT_FOUND" });

        // Reset quota nếu sang ngày mới
        var now = DateTime.UtcNow;
        if (user.LastQuotaReset.Date < now.Date)
        {
            user.RemainingQuota = user.DailyQuotaLimit == -1 ? int.MaxValue : user.DailyQuotaLimit;
            user.LastQuotaReset = now;
        }

        // Kiểm tra quota (DailyQuotaLimit = -1 → Enterprise unlimited)
        if (user.DailyQuotaLimit != -1 && user.RemainingQuota <= 0)
        {
            return StatusCode(429, new
            {
                code = "QUOTA_EXCEEDED",
                tier = user.Tier.ToString(),
                remainingQuota = 0,
                dailyLimit = user.DailyQuotaLimit,
                message = $"Bạn đã dùng hết {user.DailyQuotaLimit} lượt/ngày của gói {user.Tier}. " +
                          "Nâng cấp lên Pro/Ultra để có thêm lượt hoặc quay lại vào ngày mai."
            });
        }

        // ── Tạo ảnh ──────────────────────────────────────────────────────────
        var result = await _service.GenerateAsync(request, userId, ct);

        // Trừ 1 quota sau khi generate thành công
        if (user.DailyQuotaLimit != -1)
        {
            user.RemainingQuota = Math.Max(0, user.RemainingQuota - 1);
        }
        user.UpdatedAt = now;
        await _db.SaveChangesAsync(ct);

        return Ok(result);
    }
}
