using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace SocialSense.Services;

/// <summary>
/// Mã hóa/giải mã API key bằng AES-256-CBC.
/// Encryption key lấy từ config "ApiKeyEncryption:Secret" (32 bytes / 256 bits).
/// </summary>
public class ApiKeyEncryptionService
{
    private readonly byte[] _key;
    private const string ConfigKey = "ApiKeyEncryption:Secret";

    public ApiKeyEncryptionService(IConfiguration configuration)
    {
        var secret = configuration[ConfigKey];
        if (string.IsNullOrWhiteSpace(secret))
            throw new InvalidOperationException(
                $"Missing config '{ConfigKey}'. Add a 32-char secret to appsettings.json or User Secrets.");

        // Derive 32-byte key từ secret bằng SHA-256
        using var sha = SHA256.Create();
        _key = sha.ComputeHash(Encoding.UTF8.GetBytes(secret));
    }

    /// <summary>Mã hóa plaintext key → Base64 ciphertext (IV prepended)</summary>
    public string Encrypt(string plaintext)
    {
        using var aes = Aes.Create();
        aes.Key = _key;
        aes.GenerateIV();

        using var encryptor = aes.CreateEncryptor();
        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var cipherBytes = encryptor.TransformFinalBlock(plaintextBytes, 0, plaintextBytes.Length);

        // Prepend IV (16 bytes) vào ciphertext
        var result = new byte[aes.IV.Length + cipherBytes.Length];
        Buffer.BlockCopy(aes.IV, 0, result, 0, aes.IV.Length);
        Buffer.BlockCopy(cipherBytes, 0, result, aes.IV.Length, cipherBytes.Length);

        return Convert.ToBase64String(result);
    }

    /// <summary>Giải mã Base64 ciphertext → plaintext key</summary>
    public string Decrypt(string ciphertext)
    {
        var fullBytes = Convert.FromBase64String(ciphertext);

        using var aes = Aes.Create();
        aes.Key = _key;

        // Extract IV (16 bytes đầu)
        var iv = new byte[16];
        var cipher = new byte[fullBytes.Length - 16];
        Buffer.BlockCopy(fullBytes, 0, iv, 0, 16);
        Buffer.BlockCopy(fullBytes, 16, cipher, 0, cipher.Length);
        aes.IV = iv;

        using var decryptor = aes.CreateDecryptor();
        var plainBytes = decryptor.TransformFinalBlock(cipher, 0, cipher.Length);
        return Encoding.UTF8.GetString(plainBytes);
    }

    /// <summary>Kiểm tra chuỗi có phải ciphertext hợp lệ không (Base64 + đủ độ dài)</summary>
    public bool IsEncrypted(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        try
        {
            var bytes = Convert.FromBase64String(value);
            return bytes.Length > 16; // ít nhất IV (16) + 1 block
        }
        catch { return false; }
    }
}
