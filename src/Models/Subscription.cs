using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SocialSense.Models;

/// <summary>
/// Trạng thái subscription của user.
/// </summary>
public enum SubscriptionStatus
{
    Active = 0,
    Expired = 1,
    Cancelled = 2,
    PendingPayment = 3
}

/// <summary>
/// Lưu thông tin gói đăng ký hiện tại của user.
/// Mỗi user chỉ có 1 subscription active tại 1 thời điểm.
/// </summary>
public class Subscription
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    public int UserId { get; set; }

    /// <summary>Tier đang đăng ký: Pro hoặc Enterprise</summary>
    public UserTier Tier { get; set; } = UserTier.Pro;

    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.PendingPayment;

    /// <summary>Ngày bắt đầu subscription (sau khi thanh toán thành công)</summary>
    public DateTime? StartedAt { get; set; }

    /// <summary>Ngày hết hạn (StartedAt + 30 ngày)</summary>
    public DateTime? ExpiresAt { get; set; }

    /// <summary>Số tiền đã thanh toán (VND)</summary>
    public int AmountPaid { get; set; }

    /// <summary>Mã đơn hàng payOS liên kết</summary>
    public long? PaymentOrderCode { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
