using SocialSense.DTOs.Content;

namespace SocialSense.Services;

public interface IContentGeneratorService
{
    Task<GenerateContentResponse?> GenerateAsync(GenerateContentRequest request, CancellationToken ct);
    Task<CheckBrandAlignmentResponse?> CheckBrandAlignmentAsync(CheckBrandAlignmentRequest request, CancellationToken ct);
}
