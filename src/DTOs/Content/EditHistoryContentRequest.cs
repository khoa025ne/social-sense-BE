using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace SocialSense.DTOs.Content;

public class EditHistoryContentRequest
{
    public string? Hook { get; set; }

    [Required(AllowEmptyStrings = false)]
    public string Body { get; set; } = string.Empty;

    public string? Cta { get; set; }

    public List<string>? Hashtags { get; set; }
}
