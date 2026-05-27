using System;
using System.ComponentModel.DataAnnotations;

namespace SocialSense.Models;

public class KnowledgeChunk
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    public Guid ItemId { get; set; }

    [Required]
    public string ChunkText { get; set; } = string.Empty;

    [Required]
    public string AiSummary { get; set; } = string.Empty;

    [Required]
    public string AiInsightsJson { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Category { get; set; } = string.Empty;

    [Required]
    public string KeywordsJson { get; set; } = string.Empty;
}
