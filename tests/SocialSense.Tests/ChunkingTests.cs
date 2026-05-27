using System.Collections.Generic;
using System.Text;
using SocialSense.Services;
using Xunit;

namespace SocialSense.Tests;

public class ChunkingTests
{
    [Fact]
    public void ChunkText_ReturnsEmpty_WhenTextIsEmpty()
    {
        // Act
        var result1 = KnowledgeIngestionService.ChunkText("");
        var result2 = KnowledgeIngestionService.ChunkText(null!);

        // Assert
        Assert.Empty(result1);
        Assert.Empty(result2);
    }

    [Fact]
    public void ChunkText_ReturnsSingleChunk_WhenTextIsShorterThanChunkSize()
    {
        // Arrange
        var text = "Hello World!";

        // Act
        var result = KnowledgeIngestionService.ChunkText(text, chunkSize: 100);

        // Assert
        Assert.Single(result);
        Assert.Equal(text, result[0]);
    }

    [Fact]
    public void ChunkText_SplitsIntoMultipleChunks_WithCorrectOverlap()
    {
        // Arrange
        // Create a string of length 5000: 'A' x 2600 + 'B' x 400 + 'C' x 2000
        var sb = new StringBuilder();
        sb.Append('A', 2600); // [0, 2600)
        sb.Append('B', 400);  // [2600, 3000)
        sb.Append('C', 2000); // [3000, 5000)
        var text = sb.ToString();

        // ChunkSize: 3000, Overlap: 400
        // Chunk 1 starts at 0, size 3000. It covers [0, 3000) => 2600 'A's + 400 'B's.
        // Chunk 2 starts at start = 3000 - 400 = 2600. It covers [2600, 5000) => 400 'B's + 2000 'C's.
        // Total chunks = 2.

        // Act
        var result = KnowledgeIngestionService.ChunkText(text, chunkSize: 3000, overlap: 400);

        // Assert
        Assert.Equal(2, result.Count);
        
        // Chunk 1 asserts
        Assert.Equal(3000, result[0].Length);
        Assert.Equal(2600, result[0].Count(c => c == 'A'));
        Assert.Equal(400, result[0].Count(c => c == 'B'));
        
        // Chunk 2 asserts
        Assert.Equal(2400, result[1].Length);
        Assert.Equal(400, result[1].Count(c => c == 'B'));
        Assert.Equal(2000, result[1].Count(c => c == 'C'));
        
        // Overlap assertion: Last 400 chars of Chunk 1 are same as First 400 chars of Chunk 2
        var chunk1End = result[0].Substring(2600);
        var chunk2Start = result[1].Substring(0, 400);
        Assert.Equal(chunk1End, chunk2Start);
    }
}
