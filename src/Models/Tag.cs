using System.ComponentModel.DataAnnotations;

namespace SocialSense.Models;

public class Tag
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    [MaxLength(60)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(80)]
    public string Slug { get; set; } = string.Empty;
}
