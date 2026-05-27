using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace SocialSense.Data;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var basePath = Directory.GetCurrentDirectory();
        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("Default")
            ?? "Server=localhost;Port=3306;Database=socialsense;User=root;Password=change-me;";

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        var serverVersion = new MySqlServerVersion(new Version(8, 0, 36));
        optionsBuilder.UseMySql(connectionString, serverVersion);

        return new AppDbContext(optionsBuilder.Options);
    }
}
