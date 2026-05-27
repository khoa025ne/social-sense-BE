using System.ComponentModel.DataAnnotations;

namespace SocialSense.DTOs.Taxonomy;

public class UpdateTagTaxonomyRequest
{
    public bool? Enforced { get; set; }

    [MaxLength(200)]
    public List<string>? AllowedTags { get; set; }
}
