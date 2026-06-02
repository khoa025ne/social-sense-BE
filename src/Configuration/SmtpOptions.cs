namespace SocialSense.Configuration;

public class SmtpOptions
{
    public string Host { get; set; } = "smtp.gmail.com";
    public int Port { get; set; } = 465;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromName { get; set; } = "SocialSense";
    public int OtpExpiryMinutes { get; set; } = 10;
}
