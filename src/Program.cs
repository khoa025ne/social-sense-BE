using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using SocialSense.Configuration;
using SocialSense.Data;
using SocialSense.Services;
using SocialSense.Services.Parsers;
using SocialSense.Services.Scrapers;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Cho phép deserialize enum từ string (vd: "PersonaDriven" thay vì 1)
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();

// Configure CORS to allow interface test calls
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Configure JWT Authentication inside Swagger
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo { Title = "SocialSense API", Version = "v1" });
    
    var securityScheme = new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "JWT Authentication",
        Description = "Enter JWT Bearer token **_only_**",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Reference = new Microsoft.OpenApi.Models.OpenApiReference
        {
            Id = JwtBearerDefaults.AuthenticationScheme,
            Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme
        }
    };
    c.AddSecurityDefinition(securityScheme.Reference.Id, securityScheme);
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        { securityScheme, Array.Empty<string>() }
    });
});

// Configure JWT Bearer Authentication Services
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "SocialSenseSuperSecretSecurityKey2026!!!";
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
    };
});

// Authorization policy — chỉ user có role "Admin" mới vào được /admin/*
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
        policy.RequireRole("Admin"));
});
var connectionString = builder.Configuration.GetConnectionString("Default");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("Connection string 'Default' not found.");
}

var serverVersion = new MySqlServerVersion(new Version(8, 0, 36));
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, serverVersion));

builder.Services.AddSingleton<ApiKeyEncryptionService>();
builder.Services.AddSingleton<GeminiApiKeyPool>();
builder.Services.AddScoped<SeedDataService>();
builder.Services.AddScoped<IContextService, ContextService>();
builder.Services.AddSingleton<IContextAiExtractor, GeminiContextAiExtractor>();

builder.Services.AddScoped<ITrendQueryService, TrendQueryService>();
builder.Services.AddScoped<IContentHistoryService, ContentHistoryService>();
builder.Services.AddSingleton<ITagTaxonomyService, TagTaxonomyService>();
builder.Services.AddHttpClient<IImageGenerationService, ImageGenerationService>()
    .ConfigureHttpClient((sp, client) =>
    {
        client.Timeout = TimeSpan.FromSeconds(60);
    })
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddHttpClient<IContentGeneratorService, ContentGeneratorService>()
    .ConfigureHttpClient((sp, client) =>
    {
        var options = sp.GetRequiredService<IOptions<ContentGeneratorOptions>>().Value;
        var timeoutSeconds = Math.Max(options.TimeoutSeconds, 10);
        client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
    })
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
    {
        // Không auto-redirect để tránh Authorization header bị strip khi redirect
        AllowAutoRedirect = false
    });

builder.Services.Configure<TrendAggregatorOptions>(builder.Configuration.GetSection("TrendAggregator"));
builder.Services.Configure<GeminiOptions>(builder.Configuration.GetSection("Gemini"));
builder.Services.Configure<TagTaxonomyOptions>(builder.Configuration.GetSection("TagTaxonomy"));
builder.Services.Configure<ContentGeneratorOptions>(builder.Configuration.GetSection("ContentGenerator"));
builder.Services.Configure<ImageGeneratorOptions>(builder.Configuration.GetSection("ImageGenerator"));
builder.Services.Configure<KnowledgeOptions>(builder.Configuration.GetSection("KnowledgeOptions"));
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<PayOsOptions>(builder.Configuration.GetSection("PayOs"));
builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Smtp"));
builder.Services.AddHttpClient("Brevo").ConfigureHttpClient(c => c.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddScoped<IEmailService, SmtpEmailService>();

// PayOS HTTP client
builder.Services.AddHttpClient<IPayOsService, PayOsService>()
    .ConfigureHttpClient((sp, client) =>
    {
        var opts = sp.GetRequiredService<IOptions<PayOsOptions>>().Value;
        client.BaseAddress = new Uri(opts.BaseUrl.TrimEnd('/') + "/");
        client.Timeout = TimeSpan.FromSeconds(30);
    });

builder.Services.AddSingleton<FileParserFactory>();
builder.Services.AddHttpClient<IWebScraperClient, WebScraperClient>();
builder.Services.AddScoped<IKnowledgeIngestionService, KnowledgeIngestionService>();
builder.Services.AddHttpClient<IAnalyticsService, AnalyticsService>()
    .ConfigureHttpClient((sp, client) =>
    {
        client.Timeout = TimeSpan.FromSeconds(60);
    });
builder.Services.AddHttpClient<IKnowledgeExtractor, GeminiKnowledgeExtractor>()
    .ConfigureHttpClient((sp, client) =>
    {
        var options = sp.GetRequiredService<IOptions<GeminiOptions>>().Value;
        var timeoutSeconds = Math.Max(options.TimeoutSeconds, 10);
        client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
    })
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
    {
        AllowAutoRedirect = false
    });

builder.Services.AddHttpClient<OpenAiDalleClient>()
    .ConfigureHttpClient((sp, client) =>
    {
        var options = sp.GetRequiredService<IOptions<ImageGeneratorOptions>>().Value;
        var timeoutSeconds = Math.Max(options.TimeoutSeconds, 60);
        client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
    });
builder.Services.AddSingleton<DummyImageGenerationClient>();
builder.Services.AddTransient<IImageGenerationClient>(sp =>
{
    var options = sp.GetRequiredService<IOptions<ImageGeneratorOptions>>().Value;
    if (options.Enabled && string.Equals(options.Provider, "DALLE3", StringComparison.OrdinalIgnoreCase))
    {
        return sp.GetRequiredService<OpenAiDalleClient>();
    }
    return sp.GetRequiredService<DummyImageGenerationClient>();
});


builder.Services.AddHttpClient<GeminiContextAiExtractor>()
    .ConfigureHttpClient((sp, client) =>
    {
        var options = sp.GetRequiredService<IOptions<GeminiOptions>>().Value;
        var timeoutSeconds = Math.Max(options.TimeoutSeconds, 10);
        client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
    })
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
    {
        AllowAutoRedirect = false
    });

var app = builder.Build();

// ── Auto-migrate + Seed khi startup ──────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db     = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    var seeder = scope.ServiceProvider.GetRequiredService<SeedDataService>();

    try
    {
        // Tự động tạo DB và chạy migration nếu chưa có
        logger.LogInformation("🔄 Applying database migrations...");
        await db.Database.MigrateAsync();
        logger.LogInformation("✅ Database migrations applied.");

        // Seed dữ liệu mẫu nếu DB trống
        await seeder.SeedAsync();

        // Tự động thêm bài xu hướng mới mỗi lần khởi động
        // (bỏ qua những bài đã có, không ảnh hưởng data cũ)
        await seeder.SeedMoreTrendsAsync();
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "❌ Failed to migrate/seed database on startup.");
    }
}

// Reload API keys từ DB vào pool (sau khi DB đã sẵn sàng)
var keyPool = app.Services.GetRequiredService<GeminiApiKeyPool>();
await keyPool.ReloadFromDatabaseAsync();

// Swagger bật trên tất cả môi trường để tiện test
app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("AllowAll");

// Bypass ngrok browser warning cho webhook (ngrok free plan)
app.Use(async (context, next) =>
{
    context.Response.Headers["ngrok-skip-browser-warning"] = "true";
    await next();
});

// Render và các reverse proxy đã xử lý SSL ở load balancer
// Không dùng UseHttpsRedirection để tránh redirect loop
// if (!app.Environment.IsDevelopment())
// {
//     app.UseHttpsRedirection();
// }

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// POST /admin/seed — Admin only, seed dữ liệu mẫu
app.MapPost("/admin/seed", async (SeedDataService seeder, CancellationToken ct) =>
{
    await seeder.SeedAsync(ct);
    return Results.Ok(new { message = "Seed completed." });
}).RequireAuthorization("AdminOnly");

// POST /admin/trends/bulk — Admin only, thêm nhiều trend mới vào DB
app.MapPost("/admin/trends/bulk", async (
    BulkTrendRequest req,
    AppDbContext db,
    CancellationToken ct) =>
{
    if (req.Trends == null || req.Trends.Count == 0)
        return Results.BadRequest(new { message = "Danh sách trend không được để trống." });

    // Load toàn bộ tags để map theo slug
    var allTags = await db.Tags.AsNoTracking().ToListAsync(ct);
    var tagBySlug = allTags.ToDictionary(t => t.Slug, t => t);
    var tagByName = allTags.ToDictionary(t => t.Name.ToLower(), t => t);

    var inserted = new List<object>();

    foreach (var item in req.Trends)
    {
        var trend = new SocialSense.Models.Trend
        {
            Title     = item.Title.Length > 200 ? item.Title[..197] + "..." : item.Title,
            Summary   = item.Summary.Length > 1000 ? item.Summary[..997] + "..." : item.Summary,
            SourceUrl = item.SourceUrl ?? "internal",
            HotLevel  = Math.Clamp(item.HotLevel, 1, 10),
            Sentiment = item.HotLevel >= 8 ? "positive" : item.HotLevel >= 5 ? "neutral" : "negative",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Trends.Add(trend);
        await db.SaveChangesAsync(ct); // cần Id trước khi gán tags

        // Gán tags
        var trendTags = new List<SocialSense.Models.TrendTag>();
        foreach (var tagRef in item.Tags ?? new())
        {
            SocialSense.Models.Tag? tag = null;
            // tìm theo slug trước, fallback theo tên
            tagBySlug.TryGetValue(tagRef.ToLower().Replace(" ", "-"), out tag);
            if (tag == null) tagByName.TryGetValue(tagRef.ToLower(), out tag);
            if (tag == null)
            {
                // tạo tag mới nếu chưa có
                var slug = System.Text.RegularExpressions.Regex.Replace(
                    tagRef.ToLower().Trim(), @"\s+", "-");
                tag = new SocialSense.Models.Tag { Name = tagRef, Slug = slug };
                db.Tags.Add(tag);
                await db.SaveChangesAsync(ct);
                tagBySlug[slug] = tag;
                tagByName[tagRef.ToLower()] = tag;
            }
            if (!trendTags.Any(tt => tt.TagId == tag.Id))
                trendTags.Add(new SocialSense.Models.TrendTag { TrendId = trend.Id, TagId = tag.Id });
        }
        db.TrendTags.AddRange(trendTags);
        await db.SaveChangesAsync(ct);

        inserted.Add(new { id = trend.Id, title = trend.Title, tags = item.Tags });
    }

    return Results.Ok(new { inserted = inserted.Count, trends = inserted });
}).RequireAuthorization("AdminOnly");

app.MapControllers();

app.Run();

// ── Request DTOs for bulk trend endpoint ──────────────────────────────────────
record BulkTrendRequest(List<BulkTrendItem> Trends);
record BulkTrendItem(
    string Title,
    string Summary,
    string? SourceUrl,
    int HotLevel,
    List<string>? Tags
);
