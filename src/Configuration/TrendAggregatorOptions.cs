namespace SocialSense.Configuration;

public class TrendAggregatorOptions
{
    public bool Enabled { get; set; }

    public string QueueName { get; set; } = "trend.raw";

    public int CrawlIntervalHours { get; set; } = 12;

    public int BatchSize { get; set; } = 10;

    public int MaxItemsPerSource { get; set; } = 50;

    public int RequestTimeoutSeconds { get; set; } = 15;

    public bool DeduplicationEnabled { get; set; } = true;

    public List<TrendSourceOptions> Sources { get; set; } = new();
}
