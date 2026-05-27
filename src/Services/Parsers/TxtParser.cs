using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace SocialSense.Services.Parsers;

public class TxtParser : IFileParser
{
    public async Task<string> ParseAsync(Stream stream, CancellationToken ct)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, bufferSize: -1, leaveOpen: true);
        return await reader.ReadToEndAsync(ct);
    }
}
