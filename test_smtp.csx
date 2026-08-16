#!/usr/bin/env dotnet-script
#r "nuget: MailKit, 4.10.0"

using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

var from = "khoaai2009@gmail.com";
var to   = "khoamap920@gmail.com";
var pass = "pmit gtxx vxci xhot";

var msg = new MimeMessage();
msg.From.Add(new MailboxAddress("SocialSense", from));
msg.To.Add(MailboxAddress.Parse(to));
msg.Subject = "✅ Test Gmail SMTP - SocialSense";
msg.Body = new TextPart("plain") { Text = "Email test thành công từ SocialSense!" };

using var client = new SmtpClient();
try
{
    Console.WriteLine("Connecting port 465...");
    await client.ConnectAsync("smtp.gmail.com", 465, SecureSocketOptions.SslOnConnect);
    Console.WriteLine("Authenticating...");
    await client.AuthenticateAsync(from, pass);
    Console.WriteLine("Sending...");
    await client.SendAsync(msg);
    Console.WriteLine($"✅ SUCCESS: Email sent to {to}");
}
catch (Exception ex)
{
    Console.WriteLine($"❌ FAILED: {ex.Message}");
}
finally
{
    await client.DisconnectAsync(true);
}
