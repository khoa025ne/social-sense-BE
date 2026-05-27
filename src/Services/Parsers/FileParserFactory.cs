using System;
using System.Collections.Generic;

namespace SocialSense.Services.Parsers;

public class FileParserFactory
{
    private readonly Dictionary<string, IFileParser> _parsers = new(StringComparer.OrdinalIgnoreCase);

    public FileParserFactory()
    {
        _parsers.Add(".txt", new TxtParser());
        _parsers.Add(".md", new MarkdownParser());
        _parsers.Add(".pdf", new PdfParser());
        _parsers.Add(".docx", new DocxParser());
    }

    public IFileParser GetParser(string extension)
    {
        if (string.IsNullOrWhiteSpace(extension))
        {
            throw new ArgumentException("Extension cannot be null or empty.");
        }

        var normalized = extension.Trim().ToLowerInvariant();
        if (!normalized.StartsWith("."))
        {
            normalized = "." + normalized;
        }

        if (_parsers.TryGetValue(normalized, out var parser))
        {
            return parser;
        }

        throw new NotSupportedException($"File extension '{extension}' is not supported.");
    }
}
