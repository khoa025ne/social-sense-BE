using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace SocialSense.Services.Parsers;

public interface IFileParser
{
    Task<string> ParseAsync(Stream stream, CancellationToken ct);
}
