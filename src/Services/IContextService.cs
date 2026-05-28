using SocialSense.DTOs.Context;

namespace SocialSense.Services;

public interface IContextService
{
    Task<OnboardingResponse> SubmitOnboardingAsync(OnboardingRequest request, CancellationToken ct);

    Task<PersonaResponse?> GetPersonaAsync(int userId, CancellationToken ct);

    Task<PersonaResponse> UpdatePersonaAsync(int userId, UpdatePersonaRequest request, CancellationToken ct);
}
