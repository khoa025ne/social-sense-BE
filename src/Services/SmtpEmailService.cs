using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using SocialSense.Configuration;

namespace SocialSense.Services;

public class SmtpEmailService : IEmailService
{
    private readonly SmtpOptions _opts;
    private readonly ILogger<SmtpEmailService> _logger;

    // Logo SVG được encode thành base64 để nhúng trực tiếp vào email (tránh bị block bởi email client)
    // SVG gốc: docs/logo_SocialSence.svg — 2 path hình icon SocialSense
    private const string LogoSvgBase64 = "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDQ4IDExNTIiPjxwYXRoIGQ9Ik0xMDI2LjAsNTc4LjUgTDgwOC41LDU3OC4wIEw4MDguNSw1NzcuMCBMODA4LjAsNTc2LjUgTDc2Ni41LDUzMC4wIEw3NjcuMCw1MjkuNSBMODE4LjAsNDgzLjUgTDgyOS4wLDQ3My41IEw5MjMuMCwzODguNSBMMTAyMy4wLDI5OC41IEwxMzQ3LjAsMjk4LjUgTDEzNDcuNSwyOTkuMCBMMTAyMi41LDI5OS4wIEwxMDIzLjAsMjk4LjUgWiIgZmlsbD0iYmxhY2siLz48cGF0aCBkPSJNMTAyNS4wLDc0Ny41IEw3ODYuMCw3NDcuNSBMNzg1LjUsNzQ3LjAgTDc4NS41LDYxOC4wIEw3ODYuMCw2MTcuNSBMOTA2LjUsNjA0LjUgTDkwNi41LDYyNy4wIEw5MDcuMCw2MjcuNSBMOTc4LjUsNjI3LjUgTDEwNzAuNSw1NTguMCBMMTA3MC4wLDU1Ny41IEwxMDAwLjAsNTExLjUgTDEwMDAuMCw1MTAuNSBMMTA0Ny4wLDQ2Mi41IEwxMTY2LjUsNDYyLjUgTDExNjYuNSw0NjMuMCBMMTI2MS41LDU1OS4wIEwxMjYxLjUsNTU4LjAgTDExODkuMCw0MzcuNSBMMTE4OC4wLDQzNy41IEwxMDI1LjAsNzQ3LjUgWiIgZmlsbD0iYmxhY2siLz48L3N2Zz4=";

    public SmtpEmailService(IOptions<SmtpOptions> opts, ILogger<SmtpEmailService> logger)
    {
        _opts = opts.Value;
        _logger = logger;
    }

    // ── Gửi email chào mừng sau khi đăng ký ─────────────────────────────────
    public async Task SendWelcomeAsync(string toEmail, string displayName, CancellationToken ct = default)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_opts.FromName, _opts.Username));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Chào mừng bạn đến với SocialSense! 🥳";

        var bodyBuilder = new BodyBuilder
        {
            HtmlBody = BuildWelcomeHtml(displayName, toEmail),
            TextBody = $"Chào {displayName},\n\nTài khoản của bạn đã được khởi tạo thành công trên SocialSense.\nTên đăng nhập: {toEmail}\n\nTrân trọng,\nĐội ngũ SocialSense"
        };
        message.Body = bodyBuilder.ToMessageBody();

        await SendAsync(message, toEmail, "Welcome", ct);
    }

    // ── Gửi OTP đặt lại mật khẩu ────────────────────────────────────────────
    public async Task SendPasswordResetOtpAsync(string toEmail, string otpCode, int expiryMinutes, CancellationToken ct = default)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_opts.FromName, _opts.Username));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Mã xác nhận đặt lại mật khẩu — SocialSense";

        var bodyBuilder = new BodyBuilder
        {
            HtmlBody = BuildOtpHtml(otpCode, expiryMinutes),
            TextBody = $"Mã OTP của bạn là: {otpCode}\nMã có hiệu lực trong {expiryMinutes} phút.\nNếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này."
        };
        message.Body = bodyBuilder.ToMessageBody();

        await SendAsync(message, toEmail, "OTP", ct);
    }

    // ── Helper gửi mail ──────────────────────────────────────────────────────
    private async Task SendAsync(MimeMessage message, string toEmail, string type, CancellationToken ct)
    {
        // Dùng timeout riêng 30s — không dùng request CT vì request có thể cancel sớm
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromSeconds(30));

        using var client = new SmtpClient();
        try
        {
            // Thử port 587 (STARTTLS) trước, fallback sang 465 (SSL) nếu fail
            // Render thường block 587 nhưng cho phép 465
            try
            {
                await client.ConnectAsync(_opts.Host, _opts.Port, SecureSocketOptions.StartTls, cts.Token);
            }
            catch (Exception ex) when (ex is OperationCanceledException or System.Net.Sockets.SocketException or MailKit.Security.SslHandshakeException)
            {
                _logger.LogWarning("SMTP port {Port} failed ({Msg}), retrying with port 465 SSL...", _opts.Port, ex.Message);
                if (client.IsConnected) await client.DisconnectAsync(true, CancellationToken.None);
                // Fallback: port 465 với SslOnConnect
                await client.ConnectAsync(_opts.Host, 465, SecureSocketOptions.SslOnConnect, cts.Token);
            }

            await client.AuthenticateAsync(_opts.Username, _opts.Password, cts.Token);
            await client.SendAsync(message, cts.Token);
            _logger.LogInformation("{Type} email sent to {Email}", type, toEmail);
        }
        finally
        {
            if (client.IsConnected)
                await client.DisconnectAsync(true, CancellationToken.None);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // TEMPLATE: Welcome Email
    // Phong cách: tối giản Spotify-inspired, tone trắng-đen, logo SVG inline
    // ════════════════════════════════════════════════════════════════════════
    private static string BuildWelcomeHtml(string displayName, string email) => $"""
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width,initial-scale=1.0">
          <meta name="color-scheme" content="light">
          <title>Chào mừng đến với SocialSense</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:48px 16px;">
            <tr><td align="center">

              <!-- Card -->
              <table role="presentation" width="520" cellpadding="0" cellspacing="0"
                style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 8px 32px rgba(0,0,0,0.06);max-width:520px;width:100%;">

                <!-- ── HEADER ── -->
                <tr>
                  <td style="background:#0a0a0a;padding:36px 40px 28px;text-align:center;">
                    <!-- Logo SVG inline — scale xuống 80px chiều cao -->
                    <div style="display:inline-block;margin-bottom:16px;">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 1152" width="72" height="40" style="display:block;">
                        <path d="M1026.0,578.5 L808.5,578.0 L808.5,577.0 L808.0,576.5 L766.5,530.0 L767.0,529.5 L818.0,483.5 L829.0,473.5 L923.0,388.5 L1023.0,298.5 L1347.0,298.5 L1347.5,299.0 L1022.5,299.0 L1023.0,298.5 Z" fill="#ffffff"/>
                        <path d="M1025.0,747.5 L786.0,747.5 L785.5,747.0 L785.5,618.0 L786.0,617.5 L906.5,604.5 L906.5,627.0 L907.0,627.5 L978.5,627.5 L1070.5,558.0 L1070.0,557.5 L1000.0,511.5 L1000.0,510.5 L1047.0,462.5 L1166.5,462.5 L1166.5,463.0 L1261.5,559.0 L1261.5,558.0 L1189.0,437.5 L1188.0,437.5 L1025.0,747.5 Z" fill="#ffffff"/>
                      </svg>
                    </div>
                    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;line-height:1.2;">SocialSense</h1>
                    <p style="margin:6px 0 0;color:rgba(255,255,255,0.5);font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:500;">AI Content Platform</p>
                  </td>
                </tr>

                <!-- ── HERO BAND ── -->
                <tr>
                  <td style="background:#1a1a1a;padding:20px 40px;text-align:center;">
                    <p style="margin:0;color:#ffffff;font-size:13px;letter-spacing:3px;text-transform:uppercase;font-weight:600;">Tài khoản đã được kích hoạt</p>
                  </td>
                </tr>

                <!-- ── BODY ── -->
                <tr>
                  <td style="padding:40px 40px 32px;">

                    <p style="margin:0 0 8px;color:#0a0a0a;font-size:22px;font-weight:700;line-height:1.3;">
                      Chào mừng, {System.Net.WebUtility.HtmlEncode(displayName)}! 🥳
                    </p>
                    <p style="margin:0 0 28px;color:#6b6b6b;font-size:15px;line-height:1.7;">
                      Tài khoản của bạn đã được khởi tạo thành công. Cảm ơn bạn đã lựa chọn tham gia cùng cộng đồng của chúng tôi!
                    </p>

                    <!-- Account info box -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                      style="background:#f7f7f7;border-radius:10px;margin-bottom:28px;overflow:hidden;">
                      <tr>
                        <td style="padding:20px 24px;">
                          <p style="margin:0 0 4px;color:#9b9b9b;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;">Thông tin tài khoản</p>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                            <tr>
                              <td style="padding:6px 0;border-bottom:1px solid #ebebeb;">
                                <span style="color:#6b6b6b;font-size:13px;">Tên đăng nhập</span>
                              </td>
                              <td style="padding:6px 0;border-bottom:1px solid #ebebeb;text-align:right;">
                                <span style="color:#0a0a0a;font-size:13px;font-weight:600;">{System.Net.WebUtility.HtmlEncode(email)}</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:6px 0;">
                                <span style="color:#6b6b6b;font-size:13px;">Gói hiện tại</span>
                              </td>
                              <td style="padding:6px 0;text-align:right;">
                                <span style="background:#0a0a0a;color:#ffffff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.5px;">FREE</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA Button -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="https://socialsense.app/login"
                            style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:16px 40px;border-radius:50px;min-width:200px;text-align:center;">
                            KHÁM PHÁ NGAY →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:28px 0 0;color:#9b9b9b;font-size:13px;line-height:1.6;text-align:center;">
                      Nếu bạn có bất kỳ câu hỏi nào, đừng ngần ngại phản hồi lại email này để gặp đội ngũ hỗ trợ nhé.
                    </p>

                  </td>
                </tr>

                <!-- ── DIVIDER ── -->
                <tr>
                  <td style="padding:0 40px;">
                    <div style="height:1px;background:#ebebeb;"></div>
                  </td>
                </tr>

                <!-- ── FOOTER ── -->
                <tr>
                  <td style="padding:24px 40px;text-align:center;">
                    <p style="margin:0 0 4px;color:#0a0a0a;font-size:13px;font-weight:600;">Đội ngũ SocialSense</p>
                    <p style="margin:0;color:#b0b0b0;font-size:12px;">© 2026 SocialSense. Tất cả quyền được bảo lưu.</p>
                  </td>
                </tr>

              </table>
              <!-- /Card -->

            </td></tr>
          </table>
        </body>
        </html>
        """;

    // ════════════════════════════════════════════════════════════════════════
    // TEMPLATE: OTP / Forgot Password Email
    // Phong cách: tối giản Spotify-inspired, tone trắng-đen, logo SVG inline
    // ════════════════════════════════════════════════════════════════════════
    private static string BuildOtpHtml(string otpCode, int expiryMinutes) => $"""
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width,initial-scale=1.0">
          <meta name="color-scheme" content="light">
          <title>Đặt lại mật khẩu — SocialSense</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:48px 16px;">
            <tr><td align="center">

              <!-- Card -->
              <table role="presentation" width="520" cellpadding="0" cellspacing="0"
                style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 8px 32px rgba(0,0,0,0.06);max-width:520px;width:100%;">

                <!-- ── HEADER ── -->
                <tr>
                  <td style="background:#0a0a0a;padding:36px 40px 28px;text-align:center;">
                    <div style="display:inline-block;margin-bottom:16px;">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 1152" width="72" height="40" style="display:block;">
                        <path d="M1026.0,578.5 L808.5,578.0 L808.5,577.0 L808.0,576.5 L766.5,530.0 L767.0,529.5 L818.0,483.5 L829.0,473.5 L923.0,388.5 L1023.0,298.5 L1347.0,298.5 L1347.5,299.0 L1022.5,299.0 L1023.0,298.5 Z" fill="#ffffff"/>
                        <path d="M1025.0,747.5 L786.0,747.5 L785.5,747.0 L785.5,618.0 L786.0,617.5 L906.5,604.5 L906.5,627.0 L907.0,627.5 L978.5,627.5 L1070.5,558.0 L1070.0,557.5 L1000.0,511.5 L1000.0,510.5 L1047.0,462.5 L1166.5,462.5 L1166.5,463.0 L1261.5,559.0 L1261.5,558.0 L1189.0,437.5 L1188.0,437.5 L1025.0,747.5 Z" fill="#ffffff"/>
                      </svg>
                    </div>
                    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;line-height:1.2;">SocialSense</h1>
                    <p style="margin:6px 0 0;color:rgba(255,255,255,0.5);font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:500;">AI Content Platform</p>
                  </td>
                </tr>

                <!-- ── HERO BAND ── -->
                <tr>
                  <td style="background:#1a1a1a;padding:20px 40px;text-align:center;">
                    <p style="margin:0;color:#ffffff;font-size:13px;letter-spacing:3px;text-transform:uppercase;font-weight:600;">Đặt lại mật khẩu</p>
                  </td>
                </tr>

                <!-- ── BODY ── -->
                <tr>
                  <td style="padding:40px 40px 32px;">

                    <p style="margin:0 0 8px;color:#0a0a0a;font-size:22px;font-weight:700;line-height:1.3;">
                      Mã xác nhận của bạn
                    </p>
                    <p style="margin:0 0 32px;color:#6b6b6b;font-size:15px;line-height:1.7;">
                      Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Sử dụng mã bên dưới để tiếp tục.
                    </p>

                    <!-- OTP Box -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                      <tr>
                        <td align="center" style="background:#0a0a0a;border-radius:12px;padding:32px 24px;">
                          <p style="margin:0 0 12px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:2.5px;text-transform:uppercase;font-weight:600;">Mã xác nhận</p>
                          <p style="margin:0;color:#ffffff;font-size:48px;font-weight:800;letter-spacing:14px;font-family:'Courier New',Courier,monospace;line-height:1;">{otpCode}</p>
                          <p style="margin:16px 0 0;color:rgba(255,255,255,0.4);font-size:12px;">
                            Hiệu lực trong <strong style="color:rgba(255,255,255,0.7);">{expiryMinutes} phút</strong>
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Warning box -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
                      <tr>
                        <td style="background:#f7f7f7;border-left:3px solid #0a0a0a;border-radius:0 8px 8px 0;padding:14px 18px;">
                          <p style="margin:0;color:#6b6b6b;font-size:13px;line-height:1.6;">
                            Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Tài khoản của bạn vẫn an toàn.
                          </p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <!-- ── DIVIDER ── -->
                <tr>
                  <td style="padding:0 40px;">
                    <div style="height:1px;background:#ebebeb;"></div>
                  </td>
                </tr>

                <!-- ── FOOTER ── -->
                <tr>
                  <td style="padding:24px 40px;text-align:center;">
                    <p style="margin:0 0 4px;color:#0a0a0a;font-size:13px;font-weight:600;">Đội ngũ SocialSense</p>
                    <p style="margin:0;color:#b0b0b0;font-size:12px;">© 2026 SocialSense. Tất cả quyền được bảo lưu.</p>
                  </td>
                </tr>

              </table>
              <!-- /Card -->

            </td></tr>
          </table>
        </body>
        </html>
        """;
}
