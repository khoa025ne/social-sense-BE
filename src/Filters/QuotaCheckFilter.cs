using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using SocialSense.Data;
using SocialSense.DTOs.Content;
using SocialSense.Models;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace SocialSense.Filters
{
    public class QuotaCheckFilter : IAsyncActionFilter
    {
        private readonly AppDbContext _db;

        public QuotaCheckFilter(AppDbContext db)
        {
            _db = db;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var request = context.ActionArguments.Values.OfType<GenerateContentRequest>().FirstOrDefault();
            if (request == null || request.UserId == 0)
            {
                await next();
                return;
            }

            var userId = request.UserId;
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
            {
                context.Result = new BadRequestObjectResult(new
                {
                    code = "USER_NOT_FOUND",
                    message = $"User with ID '{userId}' not found."
                });
                return;
            }

            // Reset quota hàng ngày nếu sang ngày mới
            var now = DateTime.UtcNow;
            if (user.LastQuotaReset.Date < now.Date)
            {
                user.RemainingQuota = user.DailyQuotaLimit == -1
                    ? int.MaxValue
                    : user.DailyQuotaLimit;
                user.LastQuotaReset = now;
                await _db.SaveChangesAsync();
            }

            // DailyQuotaLimit = -1 → Enterprise unlimited, bỏ qua kiểm tra
            if (user.DailyQuotaLimit == -1)
            {
                await next();
                return;
            }

            if (user.RemainingQuota <= 0)
            {
                var tierName = user.Tier.ToString();
                context.Result = new ObjectResult(new
                {
                    code = "QUOTA_EXCEEDED",
                    tier = tierName,
                    remainingQuota = 0,
                    dailyLimit = user.DailyQuotaLimit,
                    message = $"Bạn đã dùng hết {user.DailyQuotaLimit} lượt/ngày của gói {tierName}. " +
                              "Nâng cấp lên Pro/Enterprise để có thêm lượt hoặc quay lại vào ngày mai."
                })
                {
                    StatusCode = 429
                };
                return;
            }

            await next();
        }
    }
}
