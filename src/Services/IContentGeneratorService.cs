using SocialSense.DTOs.Content;

namespace SocialSense.Services;

public interface IContentGeneratorService
{
    Task<GenerateContentResponse?> GenerateAsync(GenerateContentRequest request, CancellationToken ct);
}
