namespace SocialSense.Configuration;

/// <summary>
/// Cấu hình payOS — điền từ my.payos.vn > Kênh thanh toán > Chi tiết.
/// Lưu trong appsettings.Secrets.json hoặc biến môi trường, KHÔNG commit lên git.
/// </summary>
public class PayOsOptions
{
    /// <summary>Client ID từ trang kênh thanh toán payOS</summary>
    public string ClientId { get; set; } = "FILL_YOUR_CLIENT_ID";

    /// <summary>API Key từ trang kênh thanh toán payOS</summary>
    public string ApiKey { get; set; } = "FILL_YOUR_API_KEY";

    /// <summary>Checksum Key dùng để verify webhook signature</summary>
    public string ChecksumKey { get; set; } = "FILL_YOUR_CHECKSUM_KEY";

    /// <summary>
    /// URL payOS redirect sau khi thanh toán thành công.
    /// VD: https://yourdomain.com/payment/success
    /// </summary>
    public string ReturnUrl { get; set; } = "https://yourdomain.com/payment/success";

    /// <summary>
    /// URL payOS redirect khi user huỷ thanh toán.
    /// VD: https://yourdomain.com/payment/cancel
    /// </summary>
    public string CancelUrl { get; set; } = "https://yourdomain.com/payment/cancel";

    /// <summary>Base URL của payOS API (production)</summary>
    public string BaseUrl { get; set; } = "https://api-merchant.payos.vn";

    /// <summary>Thời gian hết hạn link thanh toán (giây). Mặc định 15 phút.</summary>
    public int ExpiredAfterSeconds { get; set; } = 900;

    // ── Giá gói (VND) ────────────────────────────────────────────────────────
    public int ProMonthlyPrice { get; set; } = 50000;
    public int EnterpriseMonthlyPrice { get; set; } = 79000;
}
