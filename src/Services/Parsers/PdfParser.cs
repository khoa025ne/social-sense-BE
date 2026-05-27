using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UglyToad.PdfPig;

namespace SocialSense.Services.Parsers;

public class PdfParser : IFileParser
{
    public Task<string> ParseAsync(Stream stream, CancellationToken ct)
    {
        try
        {
            // Note: PdfDocument.Open requires a seekable stream or reads bytes.
            // Since IFormFile Stream can be read, we can open it.
            using var document = PdfDocument.Open(stream);
            var sb = new StringBuilder();
            foreach (var page in document.GetPages())
            {
                if (ct.IsCancellationRequested)
                {
                    throw new OperationCanceledException(ct);
                }
                sb.AppendLine(page.Text);
            }
            return Task.FromResult(sb.ToString());
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException("Failed to parse PDF document.", ex);
        }
    }
}
