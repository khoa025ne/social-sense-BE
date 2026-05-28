using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SocialSense.Models;

public class KnowledgeChunk
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    public int ItemId { get; set; }

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
