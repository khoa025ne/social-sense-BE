using System;
using System.Security.Cryptography;
using System.Text;

namespace SocialSense.Services;

public static class PasswordHelper
{
    public static string HashPassword(string password)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(16);
        byte[] hash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            iterations: 100000,
            HashAlgorithmName.SHA256,
            outputLength: 32);

        return $"{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public static bool VerifyPassword(string password, string hashedPassword)
    {
        if (string.IsNullOrWhiteSpace(hashedPassword))
        {
            return false;
        }

        var parts = hashedPassword.Split('.');
        if (parts.Length != 2)
        {
            return false;
        }

        try
        {
            byte[] salt = Convert.FromBase64String(parts[0]);
            byte[] hash = Convert.FromBase64String(parts[1]);

            byte[] testHash = Rfc2898DeriveBytes.Pbkdf2(
                password,
                salt,
                iterations: 100000,
                HashAlgorithmName.SHA256,
                outputLength: 32);

            return CryptographicOperations.FixedTimeEquals(hash, testHash);
        }
        catch
        {
            return false;
        }
    }
}
