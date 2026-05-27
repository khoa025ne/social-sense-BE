using Microsoft.AspNetCore.Mvc;
using SocialSense.DTOs.Taxonomy;
using SocialSense.Services;

namespace SocialSense.Controllers;

[ApiController]
[Route("taxonomy/tags")]
public class TagTaxonomyController : ControllerBase
{
    private const int MaxTagLength = 60;
    private readonly ITagTaxonomyService _service;

    public TagTaxonomyController(ITagTaxonomyService service)
    {
        _service = service;
    }

    [HttpGet]
    public IActionResult GetCurrent()
    {
        return Ok(_service.GetCurrent());
    }

    [HttpPut]
    public IActionResult Update([FromBody] UpdateTagTaxonomyRequest request)
    {
        if (request.AllowedTags != null && request.AllowedTags.Any(t => string.IsNullOrWhiteSpace(t) || t.Length > MaxTagLength))
        {
            return BadRequest(new { code = "TAXONOMY_TAG_INVALID", message = "Tags must be 1..60 chars." });
        }

        return Ok(_service.Update(request));
    }
}
