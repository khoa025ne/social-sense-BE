using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SocialSense.Configuration;
using SocialSense.Data;
using SocialSense.DTOs.Payment;
using SocialSense.Models;
using SocialSense.Services;

namespace SocialSense.Controllers;

[ApiController]
[Route("payment")]
public class PaymentController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IPayOsService _payOs;
    private readonly PayOsOptions _options;
    private readonly ILogger<PaymentController> _logger;

    public PaymentController(
        AppDbContext db,
        IPayOsService payOs,
        IOptions<PayOsOptions> options,
        ILogger<PaymentController> logger)
    {
        _db = db;
        _payOs = payOs;
        _options = options.Value;
        _logger = logger;
    }

    // ── Bảng giá ─────────────────────────────────────────────────────────────

    /// <summary>
    /// GET /payment/plans — Danh sách gói và giá (public, không cần auth).
    /// FE dùng để render trang pricing.
    /// </summary>
    [HttpGet("plans")]
    public IActionResult GetPlans()
    {
        return Ok(new
        {
            plans = new[]
            {
                new
                {
                    tier = "Free",
                    price = 0,
                    currency = "VND",
                    billingCycle = "forever",
                    features = new[]
                    {
                        "5 lượt tạo content/ngày",
                        "TrendBased & PersonaDriven mode",
                        "Knowledge Base (upload tài liệu)",
                        "Brand Alignment Check",
                        "Lịch sử nội dung"
                    }
                },
                new
                {
                    tier = "Pro",
                    price = _options.ProMonthlyPrice,
                    currency = "VND",
                    billingCycle = "monthly",
                    features = new[]
                    {
                        "50 lượt tạo content/ngày",
                        "Tất cả tính năng Free",
                        "Ưu tiên xử lý AI",
                        "Hỗ trợ qua email"
                    }
                },
                new
                {
                    tier = "Enterprise",
                    price = _options.EnterpriseMonthlyPrice,
                    currency = "VND",
                    billingCycle = "monthly",
                    features = new[]
                    {
                        "500 lượt tạo content/ngày",
                        "Tất cả tính năng Pro",
                        "Hỗ trợ ưu tiên 24/7",
                        "Custom quota theo yêu cầu"
                    }
                }
            }
        });
    }

    // ── Tạo đơn thanh toán ────────────────────────────────────────────────────

    /// <summary>
    /// POST /payment/create — Tạo link thanh toán payOS.
    /// Trả về QR code URL, checkout URL và thông tin chuyển khoản thủ công.
    /// </summary>
    [HttpPost("create")]
    [Authorize]
    public async Task<IActionResult> CreatePayment(
        [FromBody] CreatePaymentRequest request, CancellationToken ct)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out var userId))
            return Unauthorized(new { code = "AUTH_INVALID_TOKEN" });

        // Validate tier
        if (!Enum.TryParse<UserTier>(request.Tier, ignoreCase: true, out var tier)
            || tier == UserTier.Free)
        {
            return BadRequest(new
            {
                code = "INVALID_TIER",
                message = "Tier phải là 'Pro' hoặc 'Enterprise'."
            });
        }

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null) return NotFound(new { code = "USER_NOT_FOUND" });

        // Kiểm tra đã có subscription active chưa
        var activeSub = await _db.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId
                && s.Status == SubscriptionStatus.Active
                && s.ExpiresAt > DateTime.UtcNow, ct);

        if (activeSub != null && activeSub.Tier == tier)
        {
            return BadRequest(new
            {
                code = "ALREADY_SUBSCRIBED",
                message = $"Bạn đang có gói {tier} active đến {activeSub.ExpiresAt:dd/MM/yyyy}."
            });
        }

        // Xác định giá
        var amount = tier == UserTier.Pro
            ? _options.ProMonthlyPrice
            : _options.EnterpriseMonthlyPrice;

        // Tạo orderCode unique = timestamp milliseconds (payOS yêu cầu số nguyên dương)
        var orderCode = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        // Nội dung chuyển khoản: tối đa 25 ký tự, không dấu, không ký tự đặc biệt
        var description = $"SS{tier.ToString().ToUpper()[..2]}{userId}";
        if (description.Length > 25) description = description[..25];

        // Tạo signature cho request
        var signature = _payOs.BuildSignatureForCreate(
            orderCode, amount, description, _options.CancelUrl, _options.ReturnUrl);

        var expiredAt = DateTimeOffset.UtcNow.AddSeconds(_options.ExpiredAfterSeconds).ToUnixTimeSeconds();

        var payOsRequest = new PayOsCreateLinkRequest
        {
            OrderCode   = orderCode,
            Amount      = amount,
            Description = description,
            BuyerName   = user.DisplayName ?? user.Email,
            BuyerEmail  = user.Email,
            Items = new List<PayOsItem>
            {
                new()
                {
                    Name     = $"SocialSense {tier} - 1 tháng",
                    Quantity = 1,
                    Price    = amount
                }
            },
            CancelUrl  = _options.CancelUrl,
            ReturnUrl  = _options.ReturnUrl,
            ExpiredAt  = expiredAt,
            Signature  = signature
        };

        // Gọi payOS API
        var payOsResponse = await _payOs.CreatePaymentLinkAsync(payOsRequest, ct);

        if (payOsResponse?.Code != "00" || payOsResponse.Data == null)
        {
            _logger.LogWarning("payOS CreatePaymentLink failed for user {UserId}: {Code} — {Desc}",
                userId, payOsResponse?.Code, payOsResponse?.Desc);
            return StatusCode(502, new
            {
                code = "PAYMENT_GATEWAY_ERROR",
                message = "Không thể tạo link thanh toán. Vui lòng thử lại sau."
            });
        }

        var linkData = payOsResponse.Data;

        // Lưu đơn hàng vào DB
        var order = new PaymentOrder
        {
            UserId        = userId,
            OrderCode     = orderCode,
            TargetTier    = tier,
            Amount        = amount,
            Description   = description,
            Status        = PaymentOrderStatus.Pending,
            CheckoutUrl   = linkData.CheckoutUrl,
            QrCodeUrl     = $"https://img.vietqr.io/image/{linkData.Bin}-{linkData.AccountNumber}-compact2.png?amount={amount}&addInfo={Uri.EscapeDataString(description)}&accountName={Uri.EscapeDataString(linkData.AccountName)}",
            PaymentLinkId = linkData.PaymentLinkId,
            CreatedAt     = DateTime.UtcNow,
            UpdatedAt     = DateTime.UtcNow
        };

        _db.PaymentOrders.Add(order);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Payment order {OrderCode} created for user {UserId}, tier={Tier}, amount={Amount}",
            orderCode, userId, tier, amount);

        return Ok(new CreatePaymentResponse
        {
            OrderId     = order.Id,
            OrderCode   = orderCode,
            Tier        = tier.ToString(),
            Amount      = amount,
            Description = description,
            CheckoutUrl = linkData.CheckoutUrl,
            QrCodeUrl   = order.QrCodeUrl ?? string.Empty,
            BankTransfer = new BankTransferInfo
            {
                BankName      = "MB Bank (hoặc ngân hàng liên kết payOS)",
                AccountNumber = linkData.AccountNumber,
                AccountName   = linkData.AccountName,
                Amount        = amount,
                Description   = description
            },
            ExpiresAt = DateTime.UtcNow.AddSeconds(_options.ExpiredAfterSeconds)
        });
    }

    // ── Webhook từ payOS ──────────────────────────────────────────────────────

    /// <summary>
    /// GET /payment/webhook — payOS dùng để kiểm tra endpoint còn sống không.
    /// Phải trả về 200.
    /// </summary>
    [HttpGet("webhook")]
    public IActionResult WebhookPing()
    {
        return Ok(new { code = "00", message = "webhook endpoint is alive" });
    }

    /// <summary>
    /// GET /payment/success — payOS redirect user về đây sau khi thanh toán xong.
    /// </summary>
    [HttpGet("success")]
    public IActionResult PaymentSuccess([FromQuery] long? orderCode)
    {
        return Ok(new
        {
            message = "Thanh toán thành công! Tier của bạn đã được nâng cấp.",
            orderCode
        });
    }

    /// <summary>
    /// GET /payment/cancel — payOS redirect user về đây khi huỷ thanh toán.
    /// </summary>
    [HttpGet("cancel")]
    public IActionResult PaymentCancel([FromQuery] long? orderCode)
    {
        return Ok(new
        {
            message = "Bạn đã huỷ thanh toán.",
            orderCode
        });
    }

    /// <summary>
    /// POST /payment/webhook — payOS gọi endpoint này khi có giao dịch.
    /// KHÔNG cần auth — payOS gọi từ server của họ.
    /// </summary>
    [HttpPost("webhook")]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> Webhook(
        [FromBody] System.Text.Json.JsonElement rawBody,
        CancellationToken ct)
    {
        // Log raw body để debug
        var rawJson = rawBody.GetRawText();
        _logger.LogInformation("payOS webhook received: {Body}", rawJson);

        PayOsWebhookPayload? payload;
        try
        {
            payload = System.Text.Json.JsonSerializer.Deserialize<PayOsWebhookPayload>(rawJson,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "payOS webhook: failed to deserialize body");
            return Ok(new { code = "00", message = "acknowledged" });
        }

        if (payload == null)
            return Ok(new { code = "00", message = "acknowledged" });

        // payOS gửi request test khi đăng ký webhook — orderCode=123 là dấu hiệu test
        // Phải trả về 200 để payOS xác nhận endpoint hoạt động
        if (payload.Data?.OrderCode == 123)
        {
            _logger.LogInformation("payOS webhook test request — responding 200 OK");
            return Ok(new { code = "00", message = "webhook test acknowledged" });
        }

        // Verify signature cho request thật
        if (!_payOs.VerifyWebhookSignature(payload))
        {
            _logger.LogWarning("payOS webhook: invalid signature. OrderCode={OrderCode}",
                payload.Data?.OrderCode);
            return BadRequest(new { code = "INVALID_SIGNATURE" });
        }

        // Chỉ xử lý khi success = true và code = "00"
        if (!payload.Success || payload.Code != "00" || payload.Data == null)
        {
            _logger.LogInformation("payOS webhook: non-success event code={Code}", payload.Code);
            return Ok(new { code = "00", message = "acknowledged" });
        }

        var orderCode = payload.Data.OrderCode;

        // 3. Tìm đơn hàng
        var order = await _db.PaymentOrders
            .FirstOrDefaultAsync(o => o.OrderCode == orderCode, ct);

        if (order == null)
        {
            _logger.LogWarning("payOS webhook: order not found for orderCode={OrderCode}", orderCode);
            return Ok(new { code = "00", message = "order not found, acknowledged" });
        }

        // 4. Idempotency — bỏ qua nếu đã xử lý
        if (order.Status == PaymentOrderStatus.Paid)
        {
            return Ok(new { code = "00", message = "already processed" });
        }

        // 5. Cập nhật đơn hàng
        order.Status      = PaymentOrderStatus.Paid;
        order.PaidAt      = DateTime.UtcNow;
        order.WebhookData = JsonSerializer.Serialize(payload);
        order.UpdatedAt   = DateTime.UtcNow;

        // 6. Cập nhật subscription
        var now = DateTime.UtcNow;
        var existingSub = await _db.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == order.UserId, ct);

        if (existingSub != null)
        {
            // Gia hạn hoặc nâng cấp
            var startFrom = existingSub.ExpiresAt.HasValue && existingSub.ExpiresAt > now
                ? existingSub.ExpiresAt.Value  // gia hạn từ ngày hết hạn cũ
                : now;

            existingSub.Tier              = order.TargetTier;
            existingSub.Status            = SubscriptionStatus.Active;
            existingSub.StartedAt         = now;
            existingSub.ExpiresAt         = startFrom.AddDays(30);
            existingSub.AmountPaid        = order.Amount;
            existingSub.PaymentOrderCode  = orderCode;
            existingSub.UpdatedAt         = now;
        }
        else
        {
            _db.Subscriptions.Add(new Subscription
            {
                UserId           = order.UserId,
                Tier             = order.TargetTier,
                Status           = SubscriptionStatus.Active,
                StartedAt        = now,
                ExpiresAt        = now.AddDays(30),
                AmountPaid       = order.Amount,
                PaymentOrderCode = orderCode,
                CreatedAt        = now,
                UpdatedAt        = now
            });
        }

        // 7. Nâng tier và quota cho user
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == order.UserId, ct);
        if (user != null)
        {
            user.Tier             = order.TargetTier;
            user.DailyQuotaLimit  = Models.User.GetDefaultQuota(order.TargetTier);
            user.RemainingQuota   = user.DailyQuotaLimit;
            user.LastQuotaReset   = now;
            user.UpdatedAt        = now;
        }

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "✅ Payment confirmed: orderCode={OrderCode}, user={UserId}, tier={Tier}, amount={Amount}",
            orderCode, order.UserId, order.TargetTier, order.Amount);

        // payOS yêu cầu trả về 2xx để xác nhận đã nhận webhook
        return Ok(new { code = "00", message = "success" });
    }

    // ── Kiểm tra trạng thái đơn hàng ─────────────────────────────────────────

    /// <summary>
    /// GET /payment/orders/{orderCode}/status — Kiểm tra trạng thái đơn hàng.
    /// FE polling sau khi user quét QR để biết đã thanh toán chưa.
    /// </summary>
    [HttpGet("orders/{orderCode:long}/status")]
    [Authorize]
    public async Task<IActionResult> GetOrderStatus(long orderCode, CancellationToken ct)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out var userId))
            return Unauthorized(new { code = "AUTH_INVALID_TOKEN" });

        var order = await _db.PaymentOrders.AsNoTracking()
            .FirstOrDefaultAsync(o => o.OrderCode == orderCode && o.UserId == userId, ct);

        if (order == null)
            return NotFound(new { code = "ORDER_NOT_FOUND" });

        return Ok(new PaymentStatusResponse
        {
            OrderId   = order.Id,
            OrderCode = order.OrderCode,
            Status    = order.Status.ToString(),
            Tier      = order.TargetTier.ToString(),
            Amount    = order.Amount,
            PaidAt    = order.PaidAt,
            CreatedAt = order.CreatedAt
        });
    }

    // ── Subscription hiện tại ─────────────────────────────────────────────────

    /// <summary>
    /// GET /payment/subscription — Thông tin subscription hiện tại của user.
    /// </summary>
    [HttpGet("subscription")]
    [Authorize]
    public async Task<IActionResult> GetSubscription(CancellationToken ct)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out var userId))
            return Unauthorized(new { code = "AUTH_INVALID_TOKEN" });

        var sub = await _db.Subscriptions.AsNoTracking()
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (sub == null)
        {
            return Ok(new SubscriptionResponse
            {
                UserId   = userId,
                Tier     = "Free",
                Status   = "NoSubscription",
                IsActive = false
            });
        }

        var now = DateTime.UtcNow;
        var isActive = sub.Status == SubscriptionStatus.Active && sub.ExpiresAt > now;
        var daysRemaining = isActive && sub.ExpiresAt.HasValue
            ? Math.Max(0, (int)(sub.ExpiresAt.Value - now).TotalDays)
            : 0;

        return Ok(new SubscriptionResponse
        {
            UserId       = userId,
            Tier         = sub.Tier.ToString(),
            Status       = sub.Status.ToString(),
            StartedAt    = sub.StartedAt,
            ExpiresAt    = sub.ExpiresAt,
            DaysRemaining = daysRemaining,
            IsActive     = isActive
        });
    }

    // ── Lịch sử thanh toán ────────────────────────────────────────────────────

    /// <summary>
    /// GET /payment/history — Lịch sử các đơn hàng của user.
    /// </summary>
    [HttpGet("history")]
    [Authorize]
    public async Task<IActionResult> GetPaymentHistory(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out var userId))
            return Unauthorized(new { code = "AUTH_INVALID_TOKEN" });

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.PaymentOrders.AsNoTracking()
            .Where(o => o.UserId == userId)
            .OrderByDescending(o => o.CreatedAt);

        var total = await query.CountAsync(ct);
        var orders = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        return Ok(new
        {
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling((double)total / pageSize),
            data = orders.Select(o => new PaymentStatusResponse
            {
                OrderId   = o.Id,
                OrderCode = o.OrderCode,
                Status    = o.Status.ToString(),
                Tier      = o.TargetTier.ToString(),
                Amount    = o.Amount,
                PaidAt    = o.PaidAt,
                CreatedAt = o.CreatedAt
            })
        });
    }
}
