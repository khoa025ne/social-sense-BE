using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SocialSense.Data;
using SocialSense.DTOs.Analytics;
using SocialSense.Services;

namespace SocialSense.Controllers;

[ApiController]
[Route("analytics")]
[Authorize]
public class AnalyticsController : ControllerBase
{
    private readonly IAnalyticsService _service;
    private readonly AppDbContext _db;

    public AnalyticsController(IAnalyticsService service, AppDbContext db)
    {
        _service = service;
        _db = db;
    }

    /// <summary>GET /analytics/template — Tải file Excel template để điền số liệu</summary>
    [HttpGet("template")]
    [AllowAnonymous]
    public IActionResult GetTemplate()
    {
        var bytes = _service.GenerateTemplate();
        return File(bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "SocialSense_Analytics_Template.xlsx");
    }

    /// <summary>POST /analytics/upload — Upload file Excel đã điền → parse thành metrics JSON</summary>
    [HttpPost("upload")]
    public async Task<IActionResult> Upload(IFormFile file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { code = "INVALID_FILE", message = "File không hợp lệ." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx")
            return BadRequest(new { code = "INVALID_FILE_FORMAT", message = "Chỉ hỗ trợ file .xlsx." });

        if (file.Length > 5 * 1024 * 1024)
            return BadRequest(new { code = "FILE_TOO_LARGE", message = "File quá lớn (tối đa 5MB)." });

        try
        {
            using var stream = file.OpenReadStream();
            var parsed = await _service.ParseExcelAsync(stream, ct);
            return Ok(new
            {
                message = "Đọc file thành công.",
                periodA = parsed.PeriodA,
                periodB = parsed.PeriodB
            });
        }
        catch (Exception ex)
        {
            return UnprocessableEntity(new { code = "PARSE_ERROR", message = $"Không đọc được file: {ex.Message}" });
        }
    }

    /// <summary>
    /// POST /analytics/analyze — Phân tích 1 kỳ (interpret đơn giản).
    /// Tốn 1 quota.
    /// </summary>
    [HttpPost("analyze")]
    public async Task<IActionResult> Analyze([FromBody] AnalyzeSingleRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId == 0) return Unauthorized(new { code = "AUTH_INVALID_TOKEN" });

        var quota = await CheckAndGetQuotaAsync(userId, ct);
        if (quota == null) return Unauthorized(new { code = "USER_NOT_FOUND" });
        if (quota.Value <= 0) return StatusCode(429, new { code = "QUOTA_EXCEEDED", message = "Hết quota hôm nay." });

        try
        {
            var result = await _service.AnalyzeSingleAsync(userId, request, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(503, new { code = "AI_ERROR", message = ex.Message });
        }
    }

    /// <summary>
    /// POST /analytics/compare — So sánh 2 kỳ và phân tích chi tiết.
    /// Tốn 1 quota.
    /// </summary>
    [HttpPost("compare")]
    public async Task<IActionResult> Compare([FromBody] AnalyzeCompareRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId == 0) return Unauthorized(new { code = "AUTH_INVALID_TOKEN" });

        var quota = await CheckAndGetQuotaAsync(userId, ct);
        if (quota == null) return Unauthorized(new { code = "USER_NOT_FOUND" });
        if (quota.Value <= 0) return StatusCode(429, new { code = "QUOTA_EXCEEDED", message = "Hết quota hôm nay." });

        try
        {
            var result = await _service.AnalyzeCompareAsync(userId, request, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(503, new { code = "AI_ERROR", message = ex.Message });
        }
    }

    /// <summary>
    /// POST /analytics/upload-and-compare — Upload Excel rồi phân tích luôn (1 bước).
    /// Tốn 1 quota.
    /// </summary>
    [HttpPost("upload-and-compare")]
    public async Task<IActionResult> UploadAndCompare(IFormFile file, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId == 0) return Unauthorized(new { code = "AUTH_INVALID_TOKEN" });

        var quota = await CheckAndGetQuotaAsync(userId, ct);
        if (quota == null) return Unauthorized(new { code = "USER_NOT_FOUND" });
        if (quota.Value <= 0) return StatusCode(429, new { code = "QUOTA_EXCEEDED", message = "Hết quota hôm nay." });

        if (file == null || file.Length == 0)
            return BadRequest(new { code = "INVALID_FILE", message = "File không hợp lệ." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx")
            return BadRequest(new { code = "INVALID_FILE_FORMAT", message = "Chỉ hỗ trợ file .xlsx." });

        try
        {
            using var stream = file.OpenReadStream();
            var parsed = await _service.ParseExcelAsync(stream, ct);
            try
            {
                var result = await _service.AnalyzeCompareAsync(userId, parsed, ct);
                return Ok(result);
            }
            catch (Exception aiEx)
            {
                return StatusCode(503, new { code = "AI_ERROR", message = aiEx.Message });
            }
        }
        catch (Exception ex)
        {
            return UnprocessableEntity(new { code = "PARSE_ERROR", message = $"Không đọc được file: {ex.Message}" });
        }
    }

    /// <summary>GET /analytics/history — Lịch sử các lần phân tích của user</summary>
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        var userId = GetUserId();
        if (userId == 0) return Unauthorized(new { code = "AUTH_INVALID_TOKEN" });

        var items = await _service.GetHistoryAsync(userId, page, pageSize, ct);
        return Ok(new { page, pageSize, data = items });
    }

    /// <summary>GET /analytics/history/{id} — Chi tiết 1 report</summary>
    [HttpGet("history/{id:int}")]
    public async Task<IActionResult> GetReport(int id, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId == 0) return Unauthorized(new { code = "AUTH_INVALID_TOKEN" });

        var report = await _service.GetReportAsync(userId, id, ct);
        if (report == null) return NotFound(new { code = "REPORT_NOT_FOUND" });
        return Ok(report);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private int GetUserId()
    {
        var s = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(s, out var id) ? id : 0;
    }

    private async Task<int?> CheckAndGetQuotaAsync(int userId, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null) return null;
        if (user.DailyQuotaLimit == -1) return int.MaxValue; // Enterprise unlimited
        var now = DateTime.UtcNow;
        if (user.LastQuotaReset.Date < now.Date)
        {
            user.RemainingQuota = user.DailyQuotaLimit;
            user.LastQuotaReset = now;
            await _db.SaveChangesAsync(ct);
        }
        return user.RemainingQuota;
    }
}
