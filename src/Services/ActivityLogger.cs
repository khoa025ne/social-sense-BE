using System;
using System.Threading;
using System.Threading.Tasks;
using SocialSense.Data;
using SocialSense.Models;

namespace SocialSense.Services;

public class ActivityLogger : IActivityLogger
{
    private readonly AppDbContext _db;

    public ActivityLogger(AppDbContext db)
    {
        _db = db;
    }

    public async Task LogAsync(int userId, string actionType, string actionLabel, string detail, CancellationToken ct = default)
    {
        try
        {
            var activity = new UserActivity
            {
                UserId = userId,
                ActionType = actionType,
                ActionLabel = actionLabel,
                Detail = detail,
                CreatedAt = DateTime.UtcNow
            };

            _db.UserActivities.Add(activity);
            await _db.SaveChangesAsync(ct);
        }
        catch
        {
            // Fail-safe: do not disrupt primary application flow
        }
    }
}
