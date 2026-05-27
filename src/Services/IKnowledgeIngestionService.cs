using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using SocialSense.DTOs.Knowledge;
using SocialSense.Models;

namespace SocialSense.Services;

public interface IKnowledgeIngestionService
{
    Task<KnowledgeItem> IngestManualAsync(ManualKnowledgeRequest request, CancellationToken ct);
    Task<KnowledgeItem> IngestScrapedAsync(ScrapeKnowledgeRequest request, CancellationToken ct);
    Task<KnowledgeItem> IngestFileAsync(string fileName, Stream fileStream, CancellationToken ct);
}
