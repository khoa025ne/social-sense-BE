namespace SocialSense.Services;

public interface IEmailService
{
    Task SendPasswordResetOtpAsync(string toEmail, string otpCode, int expiryMinutes, CancellationToken ct = default);
    Task SendWelcomeAsync(string toEmail, string displayName, CancellationToken ct = default);
}
