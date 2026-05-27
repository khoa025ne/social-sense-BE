using System.Threading;
using System.Threading.Tasks;

namespace SocialSense.Services;

public class DummyImageGenerationClient : IImageGenerationClient
{
    public Task<string?> GenerateImageAsync(string prompt, CancellationToken ct = default)
    {
        // Trả về ảnh placeholder chất lượng cao từ Unsplash
        return Task.FromResult<string?>("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop");
    }
}
