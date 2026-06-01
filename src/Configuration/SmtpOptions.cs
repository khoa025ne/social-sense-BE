namespace SocialSense.Configuration;

public class SmtpOptions
{
    // ── SMTP (fallback, dùng local dev) ──────────────────────────────────────
    public string Host { get; set; } = "smtp.gmail.com";
    public int Port { get; set; } = 465;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromName { get; set; } = "SocialSense";

    // ── Resend API (ưu tiên dùng trên production) ────────────────────────────
    /// <summary>
    /// API key từ https://resend.com — nếu có, ưu tiên dùng Resend thay SMTP.
    /// </summary>
    public string ResendApiKey { get; set; } = string.Empty;
    public string ResendFromAddress { get; set; } = string.Empty;

    // ── Brevo API (ưu tiên cao nhất — 300 email/ngày free, không cần domain) ─
    /// <summary>
    /// API key từ https://app.brevo.com — SMTP &amp; API → API Keys → xkeysib-...
    /// Brevo gửi qua HTTP nên không bị Render block. Ưu tiên hơn Resend và SMTP.
    /// </summary>
    public string BrevoApiKey { get; set; } = string.Empty;
    /// <summary>From email đã verify trên Brevo. Để trống = dùng Smtp.Username.</summary>
    public string BrevoFromAddress { get; set; } = string.Empty;

    /// <summary>OTP hết hạn sau bao nhiêu phút. Mặc định 10 phút.</summary>
    public int OtpExpiryMinutes { get; set; } = 10;
}
