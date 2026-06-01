namespace SocialSense.Configuration;

public class SmtpOptions
{
    public string Host { get; set; } = "smtp.gmail.com";
    public int Port { get; set; } = 587;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromName { get; set; } = "SocialSense";
    /// <summary>OTP hết hạn sau bao nhiêu phút. Mặc định 10 phút.</summary>
    public int OtpExpiryMinutes { get; set; } = 10;
}
