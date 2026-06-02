namespace SocialSense.Configuration;

public class SmtpOptions
{
    // ── Gmail SMTP (local dev) ────────────────────────────────────────────────
    public string Host { get; set; } = "smtp.gmail.com";
    public int Port { get; set; } = 465;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromName { get; set; } = "SocialSense";
    public int OtpExpiryMinutes { get; set; } = 10;

    // ── Brevo HTTP API (production — không bị cloud block) ───────────────────
    /// <summary>
    /// xkeysib-... từ https://app.brevo.com → SMTP & API → API Keys
    /// Khi có key này → ưu tiên dùng Brevo thay SMTP
    /// </summary>
    public string BrevoApiKey { get; set; } = string.Empty;

    /// <summary>From email đã verify trên Brevo. Để trống = dùng Username.</summary>
    public string BrevoFromAddress { get; set; } = string.Empty;
}
