using Microsoft.EntityFrameworkCore;
using SocialSense.Models;

namespace SocialSense.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();

    public DbSet<Role> Roles => Set<Role>();

    public DbSet<UserRole> UserRoles => Set<UserRole>();

    public DbSet<UserToken> UserTokens => Set<UserToken>();

    public DbSet<ExternalLogin> ExternalLogins => Set<ExternalLogin>();

    public DbSet<UserContext> UserContexts => Set<UserContext>();

    public DbSet<Trend> Trends => Set<Trend>();

    public DbSet<Tag> Tags => Set<Tag>();

    public DbSet<TrendTag> TrendTags => Set<TrendTag>();

    public DbSet<ContentHistory> ContentHistories => Set<ContentHistory>();

    public DbSet<KnowledgeItem> KnowledgeItems => Set<KnowledgeItem>();

    public DbSet<KnowledgeChunk> KnowledgeChunks => Set<KnowledgeChunk>();

    public DbSet<ApiKeyConfig> ApiKeyConfigs => Set<ApiKeyConfig>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(x => x.Email).IsUnique();
            entity.Property(x => x.DailyQuotaLimit).HasDefaultValue(10);
            entity.Property(x => x.RemainingQuota).HasDefaultValue(10);
            
            var isSqlite = Database.ProviderName == "Microsoft.EntityFrameworkCore.Sqlite";
            entity.Property(x => x.LastQuotaReset).HasDefaultValueSql(isSqlite ? "CURRENT_TIMESTAMP" : "CURRENT_TIMESTAMP(6)");
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasIndex(x => x.Name).IsUnique();
        });

        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.HasKey(x => new { x.UserId, x.RoleId });
            entity.HasIndex(x => x.RoleId);
        });

        modelBuilder.Entity<UserToken>(entity =>
        {
            entity.HasIndex(x => x.UserId);
            entity.HasIndex(x => x.RefreshToken).IsUnique();
        });

        modelBuilder.Entity<ExternalLogin>(entity =>
        {
            entity.HasIndex(x => x.UserId);
            entity.HasIndex(x => new { x.Provider, x.ProviderKey }).IsUnique();
        });

        modelBuilder.Entity<UserContext>(entity =>
        {
            entity.HasIndex(x => x.UserId);
            entity.HasIndex(x => new { x.UserId, x.Version });
        });

        modelBuilder.Entity<Trend>(entity =>
        {
            entity.HasIndex(x => x.CreatedAt);
        });

        modelBuilder.Entity<Tag>(entity =>
        {
            entity.HasIndex(x => x.Slug).IsUnique();
        });

        modelBuilder.Entity<TrendTag>(entity =>
        {
            entity.HasKey(x => new { x.TrendId, x.TagId });
            entity.HasIndex(x => x.TagId);
        });

        modelBuilder.Entity<ContentHistory>(entity =>
        {
            entity.HasIndex(x => x.UserId);
            entity.HasIndex(x => x.CreatedAt);

            entity.HasOne<Trend>()
                .WithMany()
                .HasForeignKey(x => x.OriginalTrendId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<KnowledgeItem>(entity =>
        {
            entity.HasIndex(x => x.ContentHash).IsUnique();
        });

        modelBuilder.Entity<KnowledgeChunk>(entity =>
        {
            entity.HasIndex(x => x.ItemId);
            entity.HasOne<KnowledgeItem>()
                .WithMany()
                .HasForeignKey(x => x.ItemId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ApiKeyConfig>(entity =>
        {
            entity.HasIndex(x => x.IsActive);
        });
    }
}
