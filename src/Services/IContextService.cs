using SocialSense.DTOs.Context;

namespace SocialSense.Services;

public interface IContextService
{
    Task<OnboardingResponse> SubmitOnboardingAsync(OnboardingRequest request, CancellationToken ct);

    Task<PersonaResponse?> GetPersonaAsync(string userId, CancellationToken ct);

    Task<PersonaResponse> UpdatePersonaAsync(string userId, UpdatePersonaRequest request, CancellationToken ct);
}
