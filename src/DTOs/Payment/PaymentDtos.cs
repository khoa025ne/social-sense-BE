using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace SocialSense.DTOs.Payment;

// ── Request ───────────────────────────────────────────────────────────────────

public class CreatePaymentRequest
{
    /// <summary>Gói muốn mua: "Pro" hoặc "Enterprise"</summary>
    [Required]
    public string Tier { get; set; } = "Pro";
}

// ── Response ──────────────────────────────────────────────────────────────────

public class CreatePaymentResponse
{
    public int OrderId { get; set; }
    public long OrderCode { get; set; }
    public string Tier { get; set; } = string.Empty;
    public int Amount { get; set; }
    public string Description { get; set; } = string.Empty;

    /// <summary>URL trang thanh toán payOS — redirect user đến đây hoặc nhúng iframe</summary>
    public string CheckoutUrl { get; set; } = string.Empty;

    /// <summary>URL ảnh QR code — hiển thị trực tiếp trên FE</summary>
    public string QrCodeUrl { get; set; } = string.Empty;

    /// <summary>Thông tin chuyển khoản thủ công (nếu user không dùng QR)</summary>
    public BankTransferInfo BankTransfer { get; set; } = new();

    public DateTime ExpiresAt { get; set; }
}

public class BankTransferInfo
{
    public string BankName { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public int Amount { get; set; }
    public string Description { get; set; } = string.Empty;
}

public class PaymentStatusResponse
{
    public int OrderId { get; set; }
    public long OrderCode { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Tier { get; set; } = string.Empty;
    public int Amount { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SubscriptionResponse
{
    public int UserId { get; set; }
    public string Tier { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime? StartedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public int DaysRemaining { get; set; }
    public bool IsActive { get; set; }
}

// ── payOS Webhook payload ─────────────────────────────────────────────────────

public class PayOsWebhookPayload
{
    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("desc")]
    public string Desc { get; set; } = string.Empty;

    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("data")]
    public PayOsWebhookData? Data { get; set; }

    [JsonPropertyName("signature")]
    public string Signature { get; set; } = string.Empty;
}

public class PayOsWebhookData
{
    [JsonPropertyName("orderCode")]
    public long OrderCode { get; set; }

    [JsonPropertyName("amount")]
    public int Amount { get; set; }

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("accountNumber")]
    public string AccountNumber { get; set; } = string.Empty;

    [JsonPropertyName("reference")]
    public string Reference { get; set; } = string.Empty;

    [JsonPropertyName("transactionDateTime")]
    public string TransactionDateTime { get; set; } = string.Empty;

    [JsonPropertyName("currency")]
    public string Currency { get; set; } = "VND";

    [JsonPropertyName("paymentLinkId")]
    public string PaymentLinkId { get; set; } = string.Empty;

    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("desc")]
    public string Desc { get; set; } = string.Empty;
}

// ── payOS API request/response ────────────────────────────────────────────────

public class PayOsCreateLinkRequest
{
    [JsonPropertyName("orderCode")]
    public long OrderCode { get; set; }

    [JsonPropertyName("amount")]
    public int Amount { get; set; }

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("buyerName")]
    public string BuyerName { get; set; } = string.Empty;

    [JsonPropertyName("buyerEmail")]
    public string BuyerEmail { get; set; } = string.Empty;

    [JsonPropertyName("items")]
    public List<PayOsItem> Items { get; set; } = new();

    [JsonPropertyName("cancelUrl")]
    public string CancelUrl { get; set; } = string.Empty;

    [JsonPropertyName("returnUrl")]
    public string ReturnUrl { get; set; } = string.Empty;

    [JsonPropertyName("expiredAt")]
    public long ExpiredAt { get; set; }

    [JsonPropertyName("signature")]
    public string Signature { get; set; } = string.Empty;
}

public class PayOsItem
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("quantity")]
    public int Quantity { get; set; } = 1;

    [JsonPropertyName("price")]
    public int Price { get; set; }
}

public class PayOsCreateLinkResponse
{
    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("desc")]
    public string Desc { get; set; } = string.Empty;

    [JsonPropertyName("data")]
    public PayOsLinkData? Data { get; set; }
}

public class PayOsLinkData
{
    [JsonPropertyName("bin")]
    public string Bin { get; set; } = string.Empty;

    [JsonPropertyName("accountNumber")]
    public string AccountNumber { get; set; } = string.Empty;

    [JsonPropertyName("accountName")]
    public string AccountName { get; set; } = string.Empty;

    [JsonPropertyName("amount")]
    public int Amount { get; set; }

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("orderCode")]
    public long OrderCode { get; set; }

    [JsonPropertyName("currency")]
    public string Currency { get; set; } = "VND";

    [JsonPropertyName("paymentLinkId")]
    public string PaymentLinkId { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("checkoutUrl")]
    public string CheckoutUrl { get; set; } = string.Empty;

    [JsonPropertyName("qrCode")]
    public string QrCode { get; set; } = string.Empty;
}
