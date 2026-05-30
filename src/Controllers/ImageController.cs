using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SocialSense.DTOs.Content;
using SocialSense.Services;

namespace SocialSense.Controllers;

[ApiController]
[Route("content/image")]
[Authorize]
public class ImageController : ControllerBase
{
    private readonly IImageGenerationService _service;

    public ImageController(IImageGenerationService service)
    {
        _service = service;
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
    /// POST /content/image/generate — Bước 3: Nhận answers từ user,
    /// build final prompt chuyên nghiệp và tạo ảnh (nếu có image model key).
    /// Nếu không có image model → trả về finalPrompt để dùng với Midjourney/DALL-E.
    /// </summary>
    [HttpPost("generate")]
    public async Task<IActionResult> Generate(
        [FromBody] ImageGenerateRequest request, CancellationToken ct)
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

        if (string.IsNullOrWhiteSpace(request.DraftPrompt))
            return BadRequest(new
            {
                code = "IMAGE_DRAFT_PROMPT_REQUIRED",
                message = "Cần truyền draftPrompt từ bước Analyze."
            });

        var result = await _service.GenerateAsync(request, userId, ct);
        return Ok(result);
    }
}
