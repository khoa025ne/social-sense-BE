using System.Threading;
using System.Threading.Tasks;

namespace SocialSense.Services;

public interface IActivityLogger
{
    Task LogAsync(int userId, string actionType, string actionLabel, string detail, CancellationToken ct = default);
}
