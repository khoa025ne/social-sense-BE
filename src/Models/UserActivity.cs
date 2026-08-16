using System;

namespace SocialSense.Models;

public class UserActivity
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string ActionType { get; set; } = string.Empty; // LOGIN, CREATE_PROMPT, IMAGE_GEN, UPLOAD_KNOWLEDGE, PAYMENT
    public string ActionLabel { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property
    public User? User { get; set; }
}
