using SocialSense.DTOs.Taxonomy;

namespace SocialSense.Services;

public interface ITagTaxonomyService
{
    TagTaxonomyResponse GetCurrent();

    TagTaxonomyResponse Update(UpdateTagTaxonomyRequest request);
}
