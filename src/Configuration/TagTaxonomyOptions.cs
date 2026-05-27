namespace SocialSense.Configuration;

public class TagTaxonomyOptions
{
    public bool Enforced { get; set; }

    public List<string> AllowedTags { get; set; } = new();
}
