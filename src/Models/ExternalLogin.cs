using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SocialSense.Models;

public class ExternalLogin
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    public int UserId { get; set; }

    [Required]
    [MaxLength(40)]
    public string Provider { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string ProviderKey { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}
