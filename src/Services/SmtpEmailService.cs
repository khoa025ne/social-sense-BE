using System.Text;
using System.Text.Json;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using SocialSense.Configuration;

namespace SocialSense.Services;

/// <summary>
/// Gửi email qua Brevo HTTP API (production) hoặc Gmail SMTP (local dev).
/// Brevo không bị cloud block (Railway/Render đều block SMTP outbound).
/// </summary>
public class SmtpEmailService : IEmailService
{
    private readonly SmtpOptions _opts;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(
        IOptions<SmtpOptions> opts,
        IHttpClientFactory httpFactory,
        ILogger<SmtpEmailService> logger)
    {
        _opts = opts.Value;
        _httpFactory = httpFactory;
        _logger = logger;
    }

    public async Task SendWelcomeAsync(string toEmail, string displayName, CancellationToken ct = default)
    {
        await SendAsync(toEmail,
            "Chào mừng bạn đến với SocialSense! 🥳",
            BuildWelcomeHtml(displayName, toEmail),
            $"Chào {displayName},\n\nTài khoản đã tạo thành công.\nEmail: {toEmail}\n\nTrân trọng,\nĐội ngũ SocialSense",
            ct);
    }

    public async Task SendPasswordResetOtpAsync(string toEmail, string otpCode, int expiryMinutes, CancellationToken ct = default)
    {
        await SendAsync(toEmail,
            "Mã xác nhận đặt lại mật khẩu — SocialSense",
            BuildOtpHtml(otpCode, expiryMinutes),
            $"Mã OTP: {otpCode}\nHiệu lực trong {expiryMinutes} phút.",
            ct);
    }

    // ── Router ───────────────────────────────────────────────────────────────
    private async Task SendAsync(string toEmail, string subject, string html, string text, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(_opts.BrevoApiKey))
            await SendViaBrevoAsync(toEmail, subject, html, text, ct);
        else
            await SendViaSmtpAsync(toEmail, subject, html, text, ct);
    }

    // ── Brevo HTTP API ────────────────────────────────────────────────────────
    private async Task SendViaBrevoAsync(string toEmail, string subject, string html, string text, CancellationToken ct)
    {
        var fromEmail = string.IsNullOrWhiteSpace(_opts.BrevoFromAddress)
            ? _opts.Username : _opts.BrevoFromAddress;

        var payload = new
        {
            sender      = new { name = _opts.FromName, email = fromEmail },
            to          = new[] { new { email = toEmail } },
            subject,
            htmlContent = html,
            textContent = text
        };

        var client = _httpFactory.CreateClient("Brevo");
        var req = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email")
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };
        req.Headers.Add("api-key", _opts.BrevoApiKey);
        req.Headers.Add("accept", "application/json");

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromSeconds(15));

        var resp = await client.SendAsync(req, cts.Token);
        var body = await resp.Content.ReadAsStringAsync(cts.Token);

        if (resp.IsSuccessStatusCode)
            _logger.LogInformation("✅ Email sent via Brevo to {Email}", toEmail);
        else
            throw new InvalidOperationException($"Brevo API error {(int)resp.StatusCode}: {body}");
    }

    // ── Gmail SMTP fallback (local dev) ───────────────────────────────────────
    private async Task SendViaSmtpAsync(string toEmail, string subject, string html, string text, CancellationToken ct)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_opts.FromName, _opts.Username));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;
        message.Body = new BodyBuilder { HtmlBody = html, TextBody = text }.ToMessageBody();

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromSeconds(30));

        using var client = new SmtpClient();
        try
        {
            await client.ConnectAsync(_opts.Host, _opts.Port, SecureSocketOptions.SslOnConnect, cts.Token);
            await client.AuthenticateAsync(_opts.Username, _opts.Password, cts.Token);
            await client.SendAsync(message, cts.Token);
            _logger.LogInformation("✅ Email sent via SMTP to {Email}", toEmail);
        }
        finally
        {
            if (client.IsConnected)
                await client.DisconnectAsync(true, CancellationToken.None);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // TEMPLATES
    // ════════════════════════════════════════════════════════════════════════
    private static string BuildWelcomeHtml(string displayName, string email) => $"""
        <!DOCTYPE html>
        <html lang="vi">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
        <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px;">
            <tr><td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:520px;width:100%;">
                <tr><td style="background:#0a0a0a;padding:36px 40px 28px;text-align:center;">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 1152" width="72" height="40" style="display:block;margin:0 auto 16px;">
                    <path d="M1026,578.5 L808.5,578 L808.5,577 L808,576.5 L766.5,530 L767,529.5 L818,483.5 L829,473.5 L923,388.5 L1023,298.5 L1347,298.5 L1023,299 Z" fill="#fff"/>
                    <path d="M1025,747.5 L786,747.5 L785.5,747 L785.5,618 L786,617.5 L906.5,604.5 L906.5,627 L907,627.5 L978.5,627.5 L1070.5,558 L1070,557.5 L1000,511.5 L1000,510.5 L1047,462.5 L1166.5,462.5 L1261.5,559 L1189,437.5 L1188,437.5 Z" fill="#fff"/>
                  </svg>
                  <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">SocialSense</h1>
                  <p style="margin:6px 0 0;color:rgba(255,255,255,.5);font-size:12px;letter-spacing:2px;text-transform:uppercase;">AI Content Platform</p>
                </td></tr>
                <tr><td style="background:#1a1a1a;padding:14px 40px;text-align:center;">
                  <p style="margin:0;color:#fff;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:600;">Tài khoản đã được kích hoạt ✅</p>
                </td></tr>
                <tr><td style="padding:40px;">
                  <p style="margin:0 0 8px;color:#0a0a0a;font-size:22px;font-weight:700;">Chào mừng, {System.Net.WebUtility.HtmlEncode(displayName)}! 🥳</p>
                  <p style="margin:0 0 28px;color:#6b6b6b;font-size:15px;line-height:1.7;">Tài khoản của bạn đã được khởi tạo thành công. Cảm ơn bạn đã tham gia SocialSense!</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:10px;margin-bottom:28px;">
                    <tr><td style="padding:20px 24px;">
                      <p style="margin:0 0 12px;color:#9b9b9b;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;">Thông tin tài khoản</p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding:6px 0;border-bottom:1px solid #ebebeb;color:#6b6b6b;font-size:13px;">Tên đăng nhập</td>
                          <td style="padding:6px 0;border-bottom:1px solid #ebebeb;text-align:right;color:#0a0a0a;font-size:13px;font-weight:600;">{System.Net.WebUtility.HtmlEncode(email)}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;color:#6b6b6b;font-size:13px;">Gói hiện tại</td>
                          <td style="padding:6px 0;text-align:right;"><span style="background:#0a0a0a;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">FREE</span></td>
                        </tr>
                      </table>
                    </td></tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr><td align="center">
                      <a href="https://truthful-youth-production-d00b.up.railway.app/swagger" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:16px 40px;border-radius:50px;">KHÁM PHÁ NGAY →</a>
                    </td></tr>
                  </table>
                </td></tr>
                <tr><td style="padding:0 40px;"><div style="height:1px;background:#ebebeb;"></div></td></tr>
                <tr><td style="padding:24px 40px;text-align:center;">
                  <p style="margin:0 0 4px;color:#0a0a0a;font-size:13px;font-weight:600;">Đội ngũ SocialSense</p>
                  <p style="margin:0;color:#b0b0b0;font-size:12px;">© 2026 SocialSense.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
        """;

    private static string BuildOtpHtml(string otpCode, int expiryMinutes) => $"""
        <!DOCTYPE html>
        <html lang="vi">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
        <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px;">
            <tr><td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:520px;width:100%;">
                <tr><td style="background:#0a0a0a;padding:36px 40px 28px;text-align:center;">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 1152" width="72" height="40" style="display:block;margin:0 auto 16px;">
                    <path d="M1026,578.5 L808.5,578 L808.5,577 L808,576.5 L766.5,530 L767,529.5 L818,483.5 L829,473.5 L923,388.5 L1023,298.5 L1347,298.5 L1023,299 Z" fill="#fff"/>
                    <path d="M1025,747.5 L786,747.5 L785.5,747 L785.5,618 L786,617.5 L906.5,604.5 L906.5,627 L907,627.5 L978.5,627.5 L1070.5,558 L1070,557.5 L1000,511.5 L1000,510.5 L1047,462.5 L1166.5,462.5 L1261.5,559 L1189,437.5 L1188,437.5 Z" fill="#fff"/>
                  </svg>
                  <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">SocialSense</h1>
                </td></tr>
                <tr><td style="background:#1a1a1a;padding:14px 40px;text-align:center;">
                  <p style="margin:0;color:#fff;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:600;">Đặt lại mật khẩu</p>
                </td></tr>
                <tr><td style="padding:40px;">
                  <p style="margin:0 0 8px;color:#0a0a0a;font-size:22px;font-weight:700;">Mã xác nhận của bạn</p>
                  <p style="margin:0 0 32px;color:#6b6b6b;font-size:15px;line-height:1.7;">Dùng mã bên dưới để đặt lại mật khẩu.</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                    <tr><td align="center" style="background:#0a0a0a;border-radius:12px;padding:32px 24px;">
                      <p style="margin:0 0 12px;color:rgba(255,255,255,.5);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Mã xác nhận</p>
                      <p style="margin:0;color:#fff;font-size:48px;font-weight:800;letter-spacing:14px;font-family:'Courier New',monospace;line-height:1;">{otpCode}</p>
                      <p style="margin:14px 0 0;color:rgba(255,255,255,.4);font-size:12px;">Hiệu lực trong <strong style="color:rgba(255,255,255,.7);">{expiryMinutes} phút</strong></p>
                    </td></tr>
                  </table>
                </td></tr>
                <tr><td style="padding:0 40px;"><div style="height:1px;background:#ebebeb;"></div></td></tr>
                <tr><td style="padding:24px 40px;text-align:center;">
                  <p style="margin:0;color:#b0b0b0;font-size:12px;">© 2026 SocialSense.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
        """;
}
