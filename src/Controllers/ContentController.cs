using Microsoft.AspNetCore.Mvc;
using SocialSense.DTOs.Content;
using SocialSense.Filters;
using SocialSense.Services;

namespace SocialSense.Controllers;

[ApiController]
[Route("content")]
public class ContentController : ControllerBase
{
    private static readonly HashSet<string> AllowedLanguages = new(StringComparer.OrdinalIgnoreCase) { "vi", "en" };
    private readonly IContentGeneratorService _service;
    private readonly IContentHistoryService _historyService;

    public ContentController(IContentGeneratorService service, IContentHistoryService historyService)
    {
        _service = service;
        _historyService = historyService;
    }

    [HttpPost("generate")]
    [TypeFilter(typeof(QuotaCheckFilter))]
    public async Task<IActionResult> Generate([FromBody] GenerateContentRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.UserId))
        {
            return BadRequest(new { code = "CONTENT_USERID_REQUIRED", message = "userId is required." });
        }

        // TrendId is now optional. If null or empty, the service will run Smart Trend Matching.

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
            return NotFound();
        }

        return Ok(response);
    }

    [HttpPost("check-alignment")]
    public async Task<IActionResult> CheckBrandAlignment([FromBody] CheckBrandAlignmentRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.UserId))
        {
            return BadRequest(new { code = "CONTENT_USERID_REQUIRED", message = "userId is required." });
        }

        if (string.IsNullOrWhiteSpace(request.DraftContent) || request.DraftContent.Length < 10)
        {
            return BadRequest(new { code = "CONTENT_DRAFT_INVALID", message = "DraftContent is required and must be at least 10 characters." });
        }

        var response = await _service.CheckBrandAlignmentAsync(request, ct);
        if (response == null)
        {
            return NotFound();
        }

        return Ok(response);
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory(
        [FromQuery] string userId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            return BadRequest(new { code = "HISTORY_USERID_REQUIRED", message = "userId is required." });
        }

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
        [FromRoute] Guid id,
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
