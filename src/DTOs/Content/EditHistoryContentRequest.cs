using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace SocialSense.DTOs.Content;

public class EditHistoryContentRequest
{
    public string? Title { get; set; }

    [Required(AllowEmptyStrings = false)]
    public string Body { get; set; } = string.Empty;

    public List<string>? Hashtags { get; set; }
}
