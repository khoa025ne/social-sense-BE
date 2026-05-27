using Microsoft.AspNetCore.Mvc;
using SocialSense.DTOs.Trends;
using SocialSense.Services;

namespace SocialSense.Controllers;

[ApiController]
[Route("trends")]
public class TrendsController : ControllerBase
{
    private const int MaxPageSize = 100;
    private readonly ITrendQueryService _service;

    public TrendsController(ITrendQueryService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetTrends([FromQuery] TrendListRequest request, CancellationToken ct)
    {
        request.Page = request.Page < 1 ? 1 : request.Page;
        request.PageSize = request.PageSize < 1 ? 20 : Math.Min(request.PageSize, MaxPageSize);

        var result = await _service.GetTrendsAsync(request, ct);
        return Ok(result);
    }

    [HttpGet("tags")]
    public async Task<IActionResult> GetTags(CancellationToken ct)
    {
        var tags = await _service.GetTagsAsync(ct);
        return Ok(tags);
    }
}
