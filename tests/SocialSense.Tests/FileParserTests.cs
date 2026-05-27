using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using SocialSense.Services.Parsers;
using Xunit;

namespace SocialSense.Tests;

public class FileParserTests
{
    [Fact]
    public async Task TxtParser_ParsesContentCorrectly()
    {
        // Arrange
        var parser = new TxtParser();
        var content = "Hello World. This is a text file content.";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(content));

        // Act
        var result = await parser.ParseAsync(stream, CancellationToken.None);

        // Assert
        Assert.Equal(content, result);
    }

    [Fact]
    public async Task MarkdownParser_ParsesContentCorrectly()
    {
        // Arrange
        var parser = new MarkdownParser();
        var content = "# Hello World\nThis is markdown.";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(content));

        // Act
        var result = await parser.ParseAsync(stream, CancellationToken.None);

        // Assert
        Assert.Equal(content, result);
    }

    [Fact]
    public async Task PdfParser_ThrowsInvalidOperationException_OnInvalidStream()
    {
        // Arrange
        var parser = new PdfParser();
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes("Not a valid PDF content"));

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(() => parser.ParseAsync(stream, CancellationToken.None));
    }

    [Fact]
    public async Task DocxParser_ThrowsInvalidOperationException_OnInvalidStream()
    {
        // Arrange
        var parser = new DocxParser();
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes("Not a valid DOCX zip"));

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(() => parser.ParseAsync(stream, CancellationToken.None));
    }

    [Fact]
    public void FileParserFactory_ReturnsCorrectParser()
    {
        // Arrange
        var factory = new FileParserFactory();

        // Act
        var txtParser = factory.GetParser(".txt");
        var pdfParser = factory.GetParser("pdf");
        var docxParser = factory.GetParser(".docx");
        var mdParser = factory.GetParser(".md");

        // Assert
        Assert.IsType<TxtParser>(txtParser);
        Assert.IsType<PdfParser>(pdfParser);
        Assert.IsType<DocxParser>(docxParser);
        Assert.IsType<MarkdownParser>(mdParser);
    }

    [Fact]
    public void FileParserFactory_ThrowsNotSupportedException_OnUnsupportedExtension()
    {
        // Arrange
        var factory = new FileParserFactory();

        // Act & Assert
        Assert.Throws<NotSupportedException>(() => factory.GetParser(".png"));
    }
}
