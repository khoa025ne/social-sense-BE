using System.ComponentModel.DataAnnotations;

namespace SocialSense.Models;

public class Role
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; }
}
