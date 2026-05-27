using System.ComponentModel.DataAnnotations;

namespace SocialSense.Models;

public class UserRole
{
    [Required]
    [MaxLength(64)]
    public string UserId { get; set; } = string.Empty;

    public Guid RoleId { get; set; }
}
