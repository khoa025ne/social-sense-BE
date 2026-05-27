using System.Threading;
using System.Threading.Tasks;

namespace SocialSense.Services.Scrapers;

public interface IWebScraperClient
{
    Task<string> ScrapeUrlAsync(string url, CancellationToken ct);

    Task<string> ScrapeRawAsync(string url, CancellationToken ct);
}
