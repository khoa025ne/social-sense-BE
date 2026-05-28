using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SocialSense.Models;

public enum PaymentOrderStatus
{
    Pending = 0,
    Paid = 1,
    Cancelled = 2,
    Expired = 3
}

/// <summary>
/// Lưu từng đơn hàng thanh toán qua payOS.
/// orderCode là số nguyên dương, unique, dùng làm mã đơn hàng payOS.
/// </summary>
public class PaymentOrder
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    public int UserId { get; set; }

    /// <summary>
    /// Mã đơn hàng gửi lên payOS — phải là số nguyên dương, unique.
    /// Format: timestamp milliseconds để đảm bảo unique.
    /// </summary>
    public long OrderCode { get; set; }

    /// <summary>Tier muốn mua: Pro hoặc Enterprise</summary>
    public UserTier TargetTier { get; set; }

    /// <summary>Số tiền (VND): Pro=50000, Enterprise=79000</summary>
    public int Amount { get; set; }

    /// <summary>Nội dung chuyển khoản hiển thị trên QR</summary>
    [MaxLength(25)]
    public string Description { get; set; } = string.Empty;

    public PaymentOrderStatus Status { get; set; } = PaymentOrderStatus.Pending;

    /// <summary>URL trang thanh toán payOS (chứa QR code)</summary>
    [MaxLength(500)]
    public string? CheckoutUrl { get; set; }

    /// <summary>URL QR code image trực tiếp</summary>
    [MaxLength(500)]
    public string? QrCodeUrl { get; set; }

    /// <summary>paymentLinkId từ payOS response</summary>
    [MaxLength(100)]
    public string? PaymentLinkId { get; set; }

    /// <summary>Thời điểm payOS xác nhận thanh toán thành công</summary>
    public DateTime? PaidAt { get; set; }

    /// <summary>Raw webhook data từ payOS (để debug)</summary>
    public string? WebhookData { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
