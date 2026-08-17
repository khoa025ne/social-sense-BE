using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SocialSense.DTOs.Content;
using SocialSense.Filters;
using SocialSense.Services;

namespace SocialSense.Controllers;

[ApiController]
[Route("content")]
[Authorize]
public class ContentController : ControllerBase
{
    private static readonly HashSet<string> AllowedLanguages = new(StringComparer.OrdinalIgnoreCase) { "vi", "en" };
    private readonly IContentGeneratorService _service;
    private readonly IContentHistoryService _historyService;
    private readonly IActivityLogger _activityLogger;

    public ContentController(IContentGeneratorService service, IContentHistoryService historyService, IActivityLogger activityLogger)
    {
        _service = service;
        _historyService = historyService;
        _activityLogger = activityLogger;
    }

    [HttpPost("generate")]
    [TypeFilter(typeof(QuotaCheckFilter))]
    public async Task<IActionResult> Generate([FromBody] GenerateContentRequest request, CancellationToken ct)
    {
        // Lấy UserId từ JWT claim
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
            return Unauthorized(new { code = "AUTH_INVALID_TOKEN" });

        request.UserId = userId;

        if (request.OutputCount < 1 || request.OutputCount > 3)
        {
            return BadRequest(new { code = "CONTENT_COUNT_INVALID", message = "outputCount must be 1..3." });
        }

        if (request.Language != null && !AllowedLanguages.Contains(request.Language))
        {
            return BadRequest(new { code = "CONTENT_LANGUAGE_INVALID", message = "language must be vi or en." });
        }

        if (request.TargetPlatforms != null && request.TargetPlatforms.Any(p => string.IsNullOrWhiteSpace(p) || p.Length > 60))
        {
            return BadRequest(new { code = "CONTENT_PLATFORM_INVALID", message = "Target platforms must not contain null/empty and items must be <= 60 chars." });
        }

        if (request.UserInstruction != null && request.UserInstruction.Length > 1000)
        {
            return BadRequest(new { code = "CONTENT_INSTRUCTION_TOO_LONG", message = "userInstruction must be <= 1000 characters." });
        }

        var response = await _service.GenerateAsync(request, ct);
        if (response == null)
        {
            return StatusCode(503, new
            {
                code = "AI_SERVICE_UNAVAILABLE",
                message = "Hệ thống AI chưa khởi tạo được bài viết. Vui lòng kiểm tra lại cấu hình API key trong Admin hoặc thử lại sau."
            });
        }

        var topicDetail = !string.IsNullOrWhiteSpace(request.UserInstruction) ? request.UserInstruction : "Bài viết sáng tạo AI Đa kênh";
        await _activityLogger.LogAsync(userId, "CREATE_PROMPT", "Tạo bài viết AI Đa kênh", $"Nội dung: '{topicDetail}'", ct);

        return Ok(response);
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
            return Unauthorized(new { code = "AUTH_INVALID_TOKEN" });

        if (page < 1)
        {
            return BadRequest(new { code = "HISTORY_PAGE_INVALID", message = "page must be >= 1." });
        }

        if (pageSize < 1 || pageSize > 100)
        {
            return BadRequest(new { code = "HISTORY_PAGESIZE_INVALID", message = "pageSize must be 1..100." });
        }

        var response = await _historyService.GetHistoryAsync(userId, page, pageSize, ct);
        return Ok(response);
    }

    [HttpPut("history/{id}/edit")]
    public async Task<IActionResult> EditHistory(
        [FromRoute] int id,
        [FromBody] EditHistoryContentRequest request,
        CancellationToken ct)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Body))
        {
            return BadRequest(new { code = "HISTORY_EDIT_BODY_REQUIRED", message = "Edited content body is required." });
        }

        var updated = await _historyService.EditHistoryAsync(id, request, ct);
        if (!updated)
        {
            return NotFound(new { code = "HISTORY_NOT_FOUND", message = $"Content history with ID {id} not found." });
        }

        return Ok(new { message = "Content history updated successfully." });
    }
}
