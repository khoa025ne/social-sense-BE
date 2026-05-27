namespace SocialSense.Configuration;

public class ContextQueueOptions
{
    public bool Enabled { get; set; }

    public string QueueName { get; set; } = "context.onboarding";

    public int MaxRetries { get; set; } = 3;
}
