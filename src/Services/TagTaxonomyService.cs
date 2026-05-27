using System.Text.Json;
using Microsoft.Extensions.Options;
using SocialSense.Configuration;
using SocialSense.DTOs.Taxonomy;

namespace SocialSense.Services;

public class TagTaxonomyService : ITagTaxonomyService
{
    private readonly TagTaxonomyOptions _options;

    public TagTaxonomyService(IOptions<TagTaxonomyOptions> options)
    {
        _options = options.Value;
    }

    public TagTaxonomyResponse GetCurrent()
    {
        return new TagTaxonomyResponse
        {
            Enforced = _options.Enforced,
            AllowedTags = _options.AllowedTags.ToList()
        };
    }

    public TagTaxonomyResponse Update(UpdateTagTaxonomyRequest request)
    {
        if (request.Enforced.HasValue)
        {
            _options.Enforced = request.Enforced.Value;
        }

        if (request.AllowedTags != null)
        {
            _options.AllowedTags = request.AllowedTags
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Select(t => t.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        return GetCurrent();
    }
}
