using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using SocialSense.Data;
using SocialSense.DTOs.Content;
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
            if (request == null || string.IsNullOrWhiteSpace(request.UserId))
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

            var now = DateTime.UtcNow;
            if (user.LastQuotaReset.Date < now.Date)
            {
                user.RemainingQuota = user.DailyQuotaLimit;
                user.LastQuotaReset = now;
                await _db.SaveChangesAsync();
            }

            if (user.RemainingQuota <= 0)
            {
                context.Result = new ObjectResult(new
                {
                    code = "QUOTA_EXCEEDED",
                    message = "Bạn đã sử dụng hết lượt tạo nội dung trong ngày hôm nay. Vui lòng nâng cấp tài khoản hoặc quay lại vào ngày mai."
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
