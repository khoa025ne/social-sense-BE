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
    /// Resend gửi qua HTTP nên không bị Render block như SMTP port 587/465.
    /// </summary>
    public string ResendApiKey { get; set; } = string.Empty;

    /// <summary>From address đã verify trên Resend (phải là domain đã verify hoặc onboarding@resend.dev để test)</summary>
    public string ResendFromAddress { get; set; } = string.Empty;

    /// <summary>OTP hết hạn sau bao nhiêu phút. Mặc định 10 phút.</summary>
    public int OtpExpiryMinutes { get; set; } = 10;
}
