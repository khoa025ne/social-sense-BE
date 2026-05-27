using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SocialSense.Data;
using SocialSense.DTOs.Context;
using SocialSense.Models;

namespace SocialSense.Services;

public class ContextService : IContextService
{
    private readonly AppDbContext _db;
    private readonly IContextAiExtractor _extractor;
    private readonly ILogger<ContextService> _logger;

    public ContextService(
        AppDbContext db,
        IContextAiExtractor extractor,
        ILogger<ContextService> logger)
    {
        _db = db;
        _extractor = extractor;
        _logger = logger;
    }

    public async Task<OnboardingResponse> SubmitOnboardingAsync(OnboardingRequest request, CancellationToken ct)
    {
        var persona = await _extractor.ExtractPersonaAsync(request.Answers, request.Language, ct);
        var now = DateTime.UtcNow;

        var latest = await _db.UserContexts
            .Where(x => x.UserId == request.UserId)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(ct);

        if (latest != null && latest.IsActive)
        {
            latest.IsActive = false;
            latest.UpdatedAt = now;
        }

        var version = latest?.Version + 1 ?? 1;

        var entity = new UserContext
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            Language = request.Language,
            RawAnswersJson = JsonSerializer.Serialize(request.Answers),
            JobTitle = persona.JobTitle,
            ToneOfVoice = persona.ToneOfVoice,
            PlatformPreferencesJson = JsonSerializer.Serialize(persona.PlatformPreferences),
            TargetAudienceJson = JsonSerializer.Serialize(persona.TargetAudience),
            ContentFormatsJson = JsonSerializer.Serialize(persona.ContentFormats),
            NegativeConstraintsJson = JsonSerializer.Serialize(persona.NegativeConstraints),
            Version = version,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.UserContexts.Add(entity);
        await _db.SaveChangesAsync(ct);

        return new OnboardingResponse
        {
            PersonaVersion = version,
            Status = "done"
        };
    }

    public async Task<PersonaResponse?> GetPersonaAsync(string userId, CancellationToken ct)
    {
        var entity = await _db.UserContexts
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(ct);

        if (entity == null)
        {
            return null;
        }

        return MapPersona(entity);
    }

    public async Task<PersonaResponse> UpdatePersonaAsync(string userId, UpdatePersonaRequest request, CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        var latest = await _db.UserContexts
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(ct);

        if (latest == null)
        {
            var created = new UserContext
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Language = request.Language ?? "vi",
                RawAnswersJson = "[]",
                JobTitle = request.JobTitle,
                ToneOfVoice = request.ToneOfVoice,
                PlatformPreferencesJson = JsonSerializer.Serialize(request.PlatformPreferences ?? new List<string>()),
                TargetAudienceJson = JsonSerializer.Serialize(request.TargetAudience ?? new List<string>()),
                ContentFormatsJson = JsonSerializer.Serialize(request.ContentFormats ?? new List<string>()),
                NegativeConstraintsJson = JsonSerializer.Serialize(request.NegativeConstraints ?? new List<string>()),
                Version = 1,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };

            _db.UserContexts.Add(created);
            await _db.SaveChangesAsync(ct);

            return MapPersona(created);
        }

        if (!latest.IsActive)
        {
            latest.IsActive = true;
        }

        if (request.JobTitle != null)
        {
            latest.JobTitle = request.JobTitle;
        }

        if (request.ToneOfVoice != null)
        {
            latest.ToneOfVoice = request.ToneOfVoice;
        }

        if (request.PlatformPreferences != null)
        {
            latest.PlatformPreferencesJson = JsonSerializer.Serialize(request.PlatformPreferences);
        }

        if (request.TargetAudience != null)
        {
            latest.TargetAudienceJson = JsonSerializer.Serialize(request.TargetAudience);
        }

        if (request.ContentFormats != null)
        {
            latest.ContentFormatsJson = JsonSerializer.Serialize(request.ContentFormats);
        }

        if (request.NegativeConstraints != null)
        {
            latest.NegativeConstraintsJson = JsonSerializer.Serialize(request.NegativeConstraints);
        }

        if (request.Language != null)
        {
            latest.Language = request.Language;
        }

        latest.UpdatedAt = now;
        await _db.SaveChangesAsync(ct);

        return MapPersona(latest);
    }

    private static PersonaResponse MapPersona(UserContext entity)
    {
        return new PersonaResponse
        {
            UserId = entity.UserId,
            Version = entity.Version,
            Language = entity.Language,
            JobTitle = entity.JobTitle,
            ToneOfVoice = entity.ToneOfVoice,
            PlatformPreferences = ParseStringList(entity.PlatformPreferencesJson),
            TargetAudience = ParseStringList(entity.TargetAudienceJson),
            ContentFormats = ParseStringList(entity.ContentFormatsJson),
            NegativeConstraints = ParseStringList(entity.NegativeConstraintsJson),
            UpdatedAt = entity.UpdatedAt
        };
    }

    private static List<string> ParseStringList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new List<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
        }
        catch
        {
            return new List<string>();
        }
    }
}
