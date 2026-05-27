using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

namespace SocialSense.Services.Parsers;

public class DocxParser : IFileParser
{
    public Task<string> ParseAsync(Stream stream, CancellationToken ct)
    {
        try
        {
            using var wordDoc = WordprocessingDocument.Open(stream, false);
            var body = wordDoc.MainDocumentPart?.Document?.Body;
            if (body == null)
            {
                return Task.FromResult(string.Empty);
            }

            var sb = new StringBuilder();
            // Paragraph elements are children of Body or other block-level elements
            foreach (var paragraph in body.Descendants<Paragraph>())
            {
                if (ct.IsCancellationRequested)
                {
                    throw new OperationCanceledException(ct);
                }
                sb.AppendLine(paragraph.InnerText);
            }

            return Task.FromResult(sb.ToString());
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException("Failed to parse DOCX document.", ex);
        }
    }
}
