using System.Threading;
using System.Threading.Tasks;

namespace SocialSense.Services;

public interface IImageGenerationClient
{
    Task<string?> GenerateImageAsync(string prompt, CancellationToken ct = default);
}
