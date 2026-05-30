using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SocialSense.Data;
using SocialSense.Models;

namespace SocialSense.Services;

/// <summary>
/// Thread-safe round-robin pool cho AI API keys.
/// Hỗ trợ OpenRouter, Groq và các provider OpenAI-compatible khác.
/// Ưu tiên load từ DB (bảng ApiKeyConfigs), fallback về AiProviderKeys trong appsettings.json.
/// Hỗ trợ hot-reload: gọi ReloadFromDatabaseAsync() để cập nhật keys mà không cần restart.
/// </summary>
public class GeminiApiKeyPool
{
    private KeySlot[] _slots;
    private int _counter;
    private readonly IConfiguration _configuration;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<GeminiApiKeyPool> _logger;
    private readonly ApiKeyEncryptionService _encryption;
    private readonly SemaphoreSlim _reloadLock = new(1, 1);

    public class KeySlot
    {
        public string Key { get; init; } = string.Empty;
        public string Label { get; init; } = string.Empty;
        public string Provider { get; init; } = "openrouter";
        public string? ModelOverride { get; init; }
        /// <summary>Model này có hỗ trợ generate ảnh không</summary>
        public bool SupportsImageGen { get; init; } = false;
        public DateTime CooldownUntil { get; set; } = DateTime.MinValue;
    }

    private class AiProviderKeyConfig
    {
        public string Label { get; set; } = string.Empty;
        public string KeyValue { get; set; } = string.Empty;
        public string Provider { get; set; } = "openrouter";
        /// <summary>Model ID override cho provider này. Để trống để dùng model mặc định từ Options.</summary>
        public string? ModelOverride { get; set; }
    }

    public GeminiApiKeyPool(
        IConfiguration configuration,
        IServiceScopeFactory scopeFactory,
        ApiKeyEncryptionService encryption,
        ILogger<GeminiApiKeyPool> logger)
    {
        _configuration = configuration;
        _scopeFactory = scopeFactory;
        _encryption = encryption;
        _logger = logger;

        _slots = LoadFromConfig();

        _logger.LogInformation(
            "✅ ApiKeyPool initialized with {Count} key(s) from config.",
            _slots.Length);
    }

    // ── Load từ appsettings.json ──────────────────────────────────────────────
    private KeySlot[] LoadFromConfig()
    {
        // Thử load từ AiProviderKeys (format mới, hỗ trợ multi-provider)
        var providerKeys = _configuration.GetSection("AiProviderKeys").Get<List<AiProviderKeyConfig>>()
                           ?? new List<AiProviderKeyConfig>();

        var validProviderKeys = providerKeys
            .Where(k => !string.IsNullOrWhiteSpace(k.KeyValue) && k.KeyValue != "change-me")
            .ToList();

        if (validProviderKeys.Count > 0)
        {
            return validProviderKeys.Select((k, i) => new KeySlot
            {
                Key = k.KeyValue,
                Label = $"{k.Label} (...{k.KeyValue[^4..]})",
                Provider = k.Provider?.ToLowerInvariant() ?? "openrouter",
                ModelOverride = string.IsNullOrWhiteSpace(k.ModelOverride) ? null : k.ModelOverride
            }).ToArray();
        }

        // Fallback: GeminiApiKeys cũ (backward compat)
        var legacyKeys = _configuration.GetSection("GeminiApiKeys").Get<List<string>>() ?? new List<string>();
        var validLegacy = legacyKeys
            .Where(k => !string.IsNullOrWhiteSpace(k) && k != "change-me")
            .Distinct()
            .ToList();

        if (validLegacy.Count > 0)
        {
            _logger.LogWarning("⚠️ Using legacy GeminiApiKeys. Consider migrating to AiProviderKeys in appsettings.json.");
            return validLegacy.Select((k, i) => new KeySlot
            {
                Key = k,
                Label = $"Legacy-Key-{i + 1} (...{k[^4..]})",
                Provider = "gemini"
            }).ToArray();
        }

        _logger.LogWarning("⚠️ No AI API keys found in config. Add keys via Admin panel or AiProviderKeys in appsettings.json.");
        return Array.Empty<KeySlot>();
    }

    // ── Load từ DB ────────────────────────────────────────────────────────────
    public async Task ReloadFromDatabaseAsync()
    {
        await _reloadLock.WaitAsync();
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var dbKeys = db.ApiKeyConfigs
                .Where(k => k.IsActive)
                .OrderBy(k => k.CreatedAt)
                .Select(k => new
                {
                    k.Label, k.KeyValue, k.IsEncrypted,
                    k.Provider, k.ModelOverride, k.SupportsImageGen, k.Notes
                })
                .ToList();

            if (dbKeys.Count == 0)
            {
                _logger.LogInformation("ℹ️ No active API keys in DB. Keeping config-based keys ({Count} keys).", _slots.Length);
                return;
            }

            var oldCooldowns = _slots.ToDictionary(s => s.Key, s => s.CooldownUntil);

            _slots = dbKeys.Select((k, i) =>
            {
                // Decrypt key nếu đang được mã hóa
                string plainKey;
                try
                {
                    plainKey = k.IsEncrypted ? _encryption.Decrypt(k.KeyValue) : k.KeyValue;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to decrypt key {Label} — skipping.", k.Label);
                    return null;
                }

                // Provider: ưu tiên field Provider, fallback detect từ Notes/prefix
                var provider = !string.IsNullOrWhiteSpace(k.Provider)
                    ? k.Provider.ToLowerInvariant()
                    : DetectProvider(plainKey, k.Notes);

                return new KeySlot
                {
                    Key = plainKey,
                    Label = $"DB-{k.Label} (...{plainKey[^Math.Min(4, plainKey.Length)..]})",
                    Provider = provider,
                    ModelOverride = string.IsNullOrWhiteSpace(k.ModelOverride) ? null : k.ModelOverride,
                    SupportsImageGen = k.SupportsImageGen,
                    CooldownUntil = oldCooldowns.TryGetValue(plainKey, out var cd) ? cd : DateTime.MinValue
                };
            })
            .Where(s => s != null)
            .Cast<KeySlot>()
            .ToArray();

            _counter = 0;

            _logger.LogInformation(
                "🔄 ApiKeyPool reloaded from DB: {Count} active key(s).",
                _slots.Length);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reload API keys from DB. Keeping existing keys.");
        }
        finally
        {
            _reloadLock.Release();
        }
    }

    private static string DetectProvider(string keyValue, string? notes)
    {
        // Detect từ notes nếu có
        if (!string.IsNullOrWhiteSpace(notes))
        {
            var n = notes.ToLowerInvariant();
            if (n.Contains("groq")) return "groq";
            if (n.Contains("openrouter")) return "openrouter";
            if (n.Contains("openai")) return "openai";
            if (n.Contains("gemini")) return "gemini";
        }
        // Detect từ prefix của key
        if (keyValue.StartsWith("sk-or-")) return "openrouter";
        if (keyValue.StartsWith("gsk_")) return "groq";
        if (keyValue.StartsWith("sk-")) return "openai";
        if (keyValue.StartsWith("AIza")) return "gemini";
        return "openrouter";
    }

    /// <summary>Lấy slot tiếp theo theo round-robin (trả về cả Key + Provider).</summary>
    public KeySlot GetNextSlot()
    {
        if (_slots.Length == 0)
            throw new InvalidOperationException("No AI API keys configured. Add keys via Admin panel or appsettings.json.");

        var startIndex = Interlocked.Increment(ref _counter) - 1;
        var now = DateTime.UtcNow;

        for (int i = 0; i < _slots.Length; i++)
        {
            var slot = _slots[(startIndex + i) % _slots.Length];
            if (slot.CooldownUntil <= now)
                return slot;
        }

        var earliest = _slots.OrderBy(s => s.CooldownUntil).First();
        _logger.LogWarning(
            "⚠️ All {Count} API keys are in cooldown. Using {Label} (expires at {CooldownUntil:HH:mm:ss}).",
            _slots.Length, earliest.Label, earliest.CooldownUntil);
        return earliest;
    }

    /// <summary>Backward compat — trả về key string.</summary>
    public string GetNextKey() => GetNextSlot().Key;

    public void MarkRateLimited(string key, TimeSpan cooldownDuration)
    {
        var slot = _slots.FirstOrDefault(s => s.Key == key);
        if (slot != null)
        {
            slot.CooldownUntil = DateTime.UtcNow + cooldownDuration;
            _logger.LogWarning(
                "🔴 API key {Label} marked as rate-limited. Cooldown for {Seconds}s. Remaining active: {ActiveCount}/{TotalCount}.",
                slot.Label,
                (int)cooldownDuration.TotalSeconds,
                _slots.Count(s => s.CooldownUntil <= DateTime.UtcNow),
                _slots.Length);
        }
    }

    public bool AllKeysInCooldown
    {
        get
        {
            if (_slots.Length == 0) return true;
            var now = DateTime.UtcNow;
            return _slots.All(s => s.CooldownUntil > now);
        }
    }

    public bool HasKeys => _slots.Length > 0;
    public int KeyCount => _slots.Length;

    public IReadOnlyList<KeyStatus> GetKeyStatuses()
    {
        var now = DateTime.UtcNow;
        return _slots.Select(s => new KeyStatus
        {
            Label = s.Label,
            KeySuffix = s.Key.Length >= 4 ? s.Key[^4..] : s.Key,
            Provider = s.Provider,
            ModelOverride = s.ModelOverride,
            SupportsImageGen = s.SupportsImageGen,
            IsInCooldown = s.CooldownUntil > now,
            CooldownExpiresAt = s.CooldownUntil > now ? s.CooldownUntil : null
        }).ToList();
    }

    /// <summary>Lấy slot hỗ trợ image generation (nếu có), fallback về slot thường.</summary>
    public KeySlot GetImageSlot()
    {
        var now = DateTime.UtcNow;
        var imageSlot = _slots.FirstOrDefault(s => s.SupportsImageGen && s.CooldownUntil <= now);
        return imageSlot ?? GetNextSlot();
    }

    public class KeyStatus
    {
        public string Label { get; init; } = string.Empty;
        public string KeySuffix { get; init; } = string.Empty;
        public string Provider { get; init; } = string.Empty;
        public string? ModelOverride { get; init; }
        public bool SupportsImageGen { get; init; }
        public bool IsInCooldown { get; init; }
        public DateTime? CooldownExpiresAt { get; init; }
    }
}
