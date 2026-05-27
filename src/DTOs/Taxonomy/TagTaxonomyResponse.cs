namespace SocialSense.DTOs.Taxonomy;

public class TagTaxonomyResponse
{
    public bool Enforced { get; set; }

    public List<string> AllowedTags { get; set; } = new();
}
