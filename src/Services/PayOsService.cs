using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using SocialSense.Configuration;
using SocialSense.DTOs.Payment;

namespace SocialSense.Services;

public interface IPayOsService
{
    Task<PayOsCreateLinkResponse?> CreatePaymentLinkAsync(PayOsCreateLinkRequest request, CancellationToken ct);
    bool VerifyWebhookSignature(PayOsWebhookPayload payload);
    string BuildSignatureForCreate(long orderCode, int amount, string description, string cancelUrl, string returnUrl);
}

public class PayOsService : IPayOsService
{
    private readonly PayOsOptions _options;
    private readonly HttpClient _http;
    private readonly ILogger<PayOsService> _logger;

    private static readonly JsonSerializerOptions _jsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public PayOsService(IOptions<PayOsOptions> options, HttpClient http, ILogger<PayOsService> logger)
    {
        _options = options.Value;
        _http = http;
        _logger = logger;

        _http.BaseAddress = new Uri(_options.BaseUrl.TrimEnd('/') + "/");
        _http.DefaultRequestHeaders.Add("x-client-id", _options.ClientId);
        _http.DefaultRequestHeaders.Add("x-api-key", _options.ApiKey);
    }

    public async Task<PayOsCreateLinkResponse?> CreatePaymentLinkAsync(
        PayOsCreateLinkRequest request, CancellationToken ct)
    {
        try
        {
            var json = JsonSerializer.Serialize(request);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _http.PostAsync("v2/payment-requests", content, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("payOS CreatePaymentLink failed: {Status} — {Body}",
                    response.StatusCode, body);
                return null;
            }

            return JsonSerializer.Deserialize<PayOsCreateLinkResponse>(body, _jsonOpts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "payOS CreatePaymentLink exception");
            return null;
        }
    }

    /// <summary>
    /// Verify chữ ký webhook từ payOS.
    /// payOS tạo signature bằng HMAC-SHA256 của sorted data string với ChecksumKey.
    /// </summary>
    public bool VerifyWebhookSignature(PayOsWebhookPayload payload)
    {
        if (payload.Data == null) return false;

        try
        {
            // payOS sort các field của data theo alphabet rồi nối thành key=value&key=value
            var data = payload.Data;
            var dataString = BuildWebhookDataString(data);

            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_options.ChecksumKey));
            var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(dataString));
            var computed = Convert.ToHexString(hashBytes).ToLowerInvariant();

            var isValid = computed == payload.Signature?.ToLowerInvariant();
            if (!isValid)
            {
                _logger.LogWarning("payOS webhook signature mismatch. Expected: {Expected}, Got: {Got}",
                    computed, payload.Signature);
            }
            return isValid;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "payOS signature verification error");
            return false;
        }
    }

    /// <summary>
    /// Tạo signature cho request tạo payment link.
    /// payOS yêu cầu: HMAC-SHA256("amount={amount}&cancelUrl={cancelUrl}&description={description}&orderCode={orderCode}&returnUrl={returnUrl}")
    /// </summary>
    public string BuildSignatureForCreate(
        long orderCode, int amount, string description, string cancelUrl, string returnUrl)
    {
        // Các field phải sort theo alphabet
        var dataString = $"amount={amount}&cancelUrl={cancelUrl}&description={description}&orderCode={orderCode}&returnUrl={returnUrl}";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_options.ChecksumKey));
        var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(dataString));
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static string BuildWebhookDataString(PayOsWebhookData data)
    {
        // payOS sort theo alphabet: accountNumber, amount, description, orderCode, reference, transactionDateTime
        var fields = new SortedDictionary<string, string>
        {
            ["accountNumber"]       = data.AccountNumber ?? "",
            ["amount"]              = data.Amount.ToString(),
            ["description"]         = data.Description ?? "",
            ["orderCode"]           = data.OrderCode.ToString(),
            ["reference"]           = data.Reference ?? "",
            ["transactionDateTime"] = data.TransactionDateTime ?? "",
        };

        return string.Join("&", fields.Select(kv => $"{kv.Key}={kv.Value}"));
    }
}
