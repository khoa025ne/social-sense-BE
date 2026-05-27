using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using SocialSense.DTOs.Context;
using SocialSense.Services;

namespace SocialSense.Controllers;

[ApiController]
[Route("context")]
[Authorize]
public class ContextController : ControllerBase
{
    private const int MaxAnswerLength = 1000;
    private const int MaxPlatformItemLength = 60;
    private static readonly HashSet<string> AllowedLanguages = new(StringComparer.OrdinalIgnoreCase) { "vi", "en" };

    private readonly IContextService _service;

    public ContextController(IContextService service)
    {
        _service = service;
    }

    [HttpPost("onboarding")]
    public async Task<IActionResult> SubmitOnboarding([FromBody] OnboardingRequest request, CancellationToken ct)
    {
        if (ControllerContext?.HttpContext?.User?.Identity?.IsAuthenticated == true)
        {
            var claimsUserId = ControllerContext.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(claimsUserId))
            {
                request.UserId = claimsUserId;
            }
        }

        if (!AllowedLanguages.Contains(request.Language))
        {
            return BadRequest(new { code = "CONTEXT_INVALID_LANGUAGE", message = "Language must be vi or en." });
        }

        if (request.Answers == null || request.Answers.Count < 3)
        {
            return BadRequest(new { code = "CONTEXT_ANSWERS_TOO_FEW", message = "At least 3 answers are required." });
        }

        if (request.Answers.Any(a => string.IsNullOrWhiteSpace(a) || a.Length > MaxAnswerLength))
        {
            return BadRequest(new { code = "CONTEXT_ANSWERS_INVALID", message = "Each answer must be 1..1000 chars." });
        }

        var response = await _service.SubmitOnboardingAsync(request, ct);
        return Ok(response);
    }

    [HttpGet("persona")]
    public async Task<IActionResult> GetPersona([FromQuery] string? userId, CancellationToken ct)
    {
        var targetUserId = userId;
        if (ControllerContext?.HttpContext?.User?.Identity?.IsAuthenticated == true)
        {
            var claimsUserId = ControllerContext.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(claimsUserId))
            {
                targetUserId = claimsUserId;
            }
        }

        if (string.IsNullOrWhiteSpace(targetUserId))
        {
            return BadRequest(new { code = "CONTEXT_USERID_REQUIRED", message = "userId is required." });
        }

        var persona = await _service.GetPersonaAsync(targetUserId, ct);
        if (persona == null)
        {
            return NotFound();
        }

        return Ok(persona);
    }

    [HttpPut("persona")]
    public async Task<IActionResult> UpdatePersona([FromQuery] string? userId, [FromBody] UpdatePersonaRequest request, CancellationToken ct)
    {
        var targetUserId = userId;
        if (ControllerContext?.HttpContext?.User?.Identity?.IsAuthenticated == true)
        {
            var claimsUserId = ControllerContext.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(claimsUserId))
            {
                targetUserId = claimsUserId;
            }
        }

        if (string.IsNullOrWhiteSpace(targetUserId))
        {
            return BadRequest(new { code = "CONTEXT_USERID_REQUIRED", message = "userId is required." });
        }

        if (request.PlatformPreferences != null && request.PlatformPreferences.Any(p => string.IsNullOrWhiteSpace(p) || p.Length > MaxPlatformItemLength))
        {
            return BadRequest(new { code = "CONTEXT_PLATFORM_INVALID", message = "Platform preferences items must be 1..60 chars." });
        }

        if (request.TargetAudience != null && request.TargetAudience.Any(t => string.IsNullOrWhiteSpace(t) || t.Length > 100))
        {
            return BadRequest(new { code = "CONTEXT_TARGET_AUDIENCE_INVALID", message = "Target audience items must be 1..100 chars." });
        }

        if (request.ContentFormats != null && request.ContentFormats.Any(f => string.IsNullOrWhiteSpace(f) || f.Length > 100))
        {
            return BadRequest(new { code = "CONTEXT_CONTENT_FORMATS_INVALID", message = "Content formats items must be 1..100 chars." });
        }

        if (request.NegativeConstraints != null && request.NegativeConstraints.Any(c => string.IsNullOrWhiteSpace(c) || c.Length > 100))
        {
            return BadRequest(new { code = "CONTEXT_NEGATIVE_CONSTRAINTS_INVALID", message = "Negative constraints items must be 1..100 chars." });
        }

        if (request.Language != null && !AllowedLanguages.Contains(request.Language))
        {
            return BadRequest(new { code = "CONTEXT_INVALID_LANGUAGE", message = "Language must be vi or en." });
        }

        var persona = await _service.UpdatePersonaAsync(targetUserId, request, ct);
        return Ok(persona);
    }
}
