using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SocialSense.DTOs.Knowledge;
using SocialSense.Services;

namespace SocialSense.Controllers;

[ApiController]
[Route("knowledge")]
public class KnowledgeIngestionController : ControllerBase
{
    private readonly IKnowledgeIngestionService _service;
    private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10MB

    public KnowledgeIngestionController(IKnowledgeIngestionService service)
    {
        _service = service;
    }

    [HttpPost("manual")]
    public async Task<IActionResult> IngestManual([FromBody] ManualKnowledgeRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var result = await _service.IngestManualAsync(request, ct);
            return Ok(new
            {
                message = "Knowledge ingested successfully.",
                itemId = result.Id,
                title = result.Title
            });
        }
        catch (DuplicateKnowledgeException)
        {
            return Conflict(new { code = "KNOWLEDGE_ALREADY_EXISTS", message = "This knowledge content has already been ingested." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred during ingestion.", details = ex.Message });
        }
    }

    [HttpPost("scrape")]
    public async Task<IActionResult> IngestScraped([FromBody] ScrapeKnowledgeRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var result = await _service.IngestScrapedAsync(request, ct);
            return Ok(new
            {
                message = "Knowledge crawled and ingested successfully.",
                itemId = result.Id,
                title = result.Title,
                sourceUrl = result.SourceUrlOrFileName
            });
        }
        catch (UnsupportedWebsiteException)
        {
            return BadRequest(new { code = "UNSUPPORTED_WEBSITE_SOURCE", message = "Crawling from this website domain is not allowed by whitelist options." });
        }
        catch (DuplicateKnowledgeException)
        {
            return Conflict(new { code = "KNOWLEDGE_ALREADY_EXISTS", message = "This content has already been crawled and ingested." });
        }
        catch (EmptyContentException)
        {
            return UnprocessableEntity(new { code = "CANNOT_EXTRACT_TEXT_FROM_FILE", message = "Could not scrape clean text from the target URL." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred during web crawling and ingestion.", details = ex.Message });
        }
    }

    [HttpPost("upload-file")]
    public async Task<IActionResult> IngestFile(IFormFile file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { code = "INVALID_FILE_FORMAT", message = "File cannot be null or empty." });
        }

        if (file.Length > MaxFileSizeBytes)
        {
            return BadRequest(new { code = "FILE_TOO_LARGE", message = "File size must not exceed 10MB." });
        }

        var ext = Path.GetExtension(file.FileName);
        var allowedExtensions = new[] { ".txt", ".md", ".docx", ".pdf" };
        if (!System.Linq.Enumerable.Contains(allowedExtensions, ext, StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest(new { code = "INVALID_FILE_FORMAT", message = "Only .txt, .md, .docx, and .pdf file formats are allowed." });
        }

        try
        {
            using var stream = file.OpenReadStream();
            var result = await _service.IngestFileAsync(file.FileName, stream, ct);
            return Ok(new
            {
                message = "File uploaded and ingested successfully.",
                itemId = result.Id,
                fileName = result.SourceUrlOrFileName
            });
        }
        catch (InvalidFileException)
        {
            return BadRequest(new { code = "INVALID_FILE_FORMAT", message = "Only .txt, .md, .docx, and .pdf files are supported." });
        }
        catch (DuplicateKnowledgeException)
        {
            return Conflict(new { code = "KNOWLEDGE_ALREADY_EXISTS", message = "This file content has already been uploaded and ingested." });
        }
        catch (EmptyContentException)
        {
            return UnprocessableEntity(new { code = "CANNOT_EXTRACT_TEXT_FROM_FILE", message = "The uploaded file is empty or no readable text could be extracted." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred during file ingestion.", details = ex.Message });
        }
    }
}
