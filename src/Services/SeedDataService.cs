using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SocialSense.Data;
using SocialSense.Models;

namespace SocialSense.Services;

/// <summary>
/// Seed đầy đủ dữ liệu mẫu: 2 roles, 10 users, 50 trends, 20 tags,
/// TrendTags, 10 UserContexts, 50 ContentHistories, 10 KnowledgeItems,
/// 50 KnowledgeChunks, 2 ApiKeyConfigs.
/// Chỉ chạy khi DB trống (Users.Any() == false).
/// </summary>
public class SeedDataService
{
    private readonly AppDbContext _db;
    private readonly ILogger<SeedDataService> _logger;

    public SeedDataService(AppDbContext db, ILogger<SeedDataService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task SeedAsync(CancellationToken ct = default)
    {
        if (await _db.Users.AnyAsync(ct))
        {
            _logger.LogInformation("⏭ SeedData skipped — DB already has data.");
            return;
        }

        _logger.LogInformation("🌱 Starting SeedData...");

        var roles   = await SeedRolesAsync(ct);
        var users   = await SeedUsersAsync(roles, ct);
        var tags    = await SeedTagsAsync(ct);
        var trends  = await SeedTrendsAsync(tags, ct);
                      await SeedUserContextsAsync(users, ct);
                      await SeedContentHistoriesAsync(users, trends, ct);
                      await SeedKnowledgeAsync(ct);
                      await SeedApiKeysAsync(ct);

        _logger.LogInformation("✅ SeedData completed.");
    }

    /// <summary>
    /// Xoá toàn bộ TrendTags cũ (bị nhiễu tag ngẫu nhiên) và seed lại
    /// chỉ với primary tag đúng cho từng trend.
    /// An toàn — không đụng Users, ContentHistories hay data khác.
    /// </summary>
    public async Task ReseedTrendTagsAsync(CancellationToken ct = default)
    {
        _logger.LogInformation("🔄 ReseedTrendTags: bắt đầu xoá TrendTags cũ...");

        // Xoá hết TrendTags hiện tại
        var existing = await _db.TrendTags.ToListAsync(ct);
        _db.TrendTags.RemoveRange(existing);
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("🗑 Đã xoá {Count} TrendTag cũ.", existing.Count);

        // Load lại tags và trends từ DB
        var tags   = await _db.Tags.AsNoTracking().ToListAsync(ct);
        var trends = await _db.Trends.AsNoTracking().ToListAsync(ct);

        if (tags.Count == 0 || trends.Count == 0)
        {
            _logger.LogWarning("⚠ Không có tags hoặc trends trong DB — bỏ qua ReseedTrendTags.");
            return;
        }

        var tagBySlug = tags.ToDictionary(t => t.Slug, t => t, StringComparer.OrdinalIgnoreCase);
        var tagByName = tags.ToDictionary(t => t.Name.ToLower(), t => t);

        var newTrendTags = new List<TrendTag>();

        foreach (var trend in trends)
        {
            // Tìm tag phù hợp nhất dựa trên title của trend
            Tag? matchedTag = null;

            // Thử khớp theo tên tag trong title
            foreach (var tag in tags)
            {
                if (trend.Title.Contains(tag.Name, StringComparison.OrdinalIgnoreCase))
                {
                    matchedTag = tag;
                    break;
                }
            }

            // Fallback: dùng tag đầu tiên tìm được theo slug trong summary
            if (matchedTag == null)
            {
                foreach (var tag in tags)
                {
                    if (trend.Summary != null && trend.Summary.Contains(tag.Name, StringComparison.OrdinalIgnoreCase))
                    {
                        matchedTag = tag;
                        break;
                    }
                }
            }

            if (matchedTag != null)
                newTrendTags.Add(new TrendTag { TrendId = trend.Id, TagId = matchedTag.Id });
        }

        _db.TrendTags.AddRange(newTrendTags);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("✅ ReseedTrendTags hoàn tất: đã thêm {Count} TrendTag mới.", newTrendTags.Count);
    }

    /// <summary>
    /// Thêm các bài xu hướng mới vào DB mỗi lần app khởi động.
    /// Chỉ insert trend chưa tồn tại (kiểm tra theo Title) — không đụng data cũ.
    /// Gọi method này sau SeedAsync() trong Program.cs.
    /// </summary>
    public async Task SeedMoreTrendsAsync(CancellationToken ct = default)
    {
        // Load tất cả title đã có để tránh duplicate
        var existingTitles = (await _db.Trends.AsNoTracking()
            .Select(t => t.Title)
            .ToListAsync(ct))
            .ToHashSet();

        // Đảm bảo tags cơ bản tồn tại
        var allTags = await _db.Tags.AsNoTracking().ToListAsync(ct);
        var tagBySlug = allTags.ToDictionary(t => t.Slug, t => t);
        var tagByName = allTags.ToDictionary(t => t.Name.ToLower(), t => t);

        // ── DANH SÁCH BÀI XU HƯỚNG MỚI ─────────────────────────────────────
        // Định dạng: (Title, Summary, SourceUrl, HotLevel, string[] tags)
        // Thêm bài mới vào đây — hệ thống tự bỏ qua nếu title đã tồn tại.
        var newTrends = new[]
        {
            // Marketing & Mạng xã hội
            ("Facebook Reels vượt TikTok về thời gian xem tại Việt Nam Q2/2026",
             "Dữ liệu nội bộ Meta cho thấy Facebook Reels đạt trung bình 45 phút xem/người/ngày tại Việt Nam, lần đầu vượt qua TikTok trong phân khúc 25-40 tuổi.",
             "https://techinsider.vn/facebook-reels-vuot-tiktok",
             8, new[]{"Marketing", "Mạng xã hội", "Giải trí"}),

            ("LinkedIn tại Việt Nam tăng 200% người dùng trong 12 tháng",
             "LinkedIn Việt Nam đạt 6 triệu thành viên, tăng trưởng mạnh nhất Đông Nam Á nhờ làn sóng personal branding và tuyển dụng IT.",
             "https://business.linkedin.com/vn",
             7, new[]{"Marketing", "Kinh doanh", "Khởi nghiệp"}),

            ("Podcast marketing bùng nổ — 30% doanh nghiệp Việt đầu tư kênh này",
             "Theo khảo sát của Nielsen Việt Nam, 30% doanh nghiệp vừa và nhỏ đã triển khai podcast như kênh marketing chính trong năm 2026.",
             "https://nielsen.com/vn/podcast-report",
             7, new[]{"Marketing", "Kinh doanh"}),

            // Công nghệ & AI
            ("Google ra mắt Gemini 2.5 Ultra — benchmark vượt GPT-5 trên toàn diện",
             "Gemini 2.5 Ultra lập kỷ lục mới trên MMLU và HumanEval, được tích hợp thẳng vào Google Workspace giúp tăng năng suất văn phòng 40%.",
             "https://blog.google/gemini-2-5-ultra",
             10, new[]{"Công nghệ", "AI", "Kinh doanh"}),

            ("Chip AI nội địa Việt Nam đầu tiên ra mắt — FPT Silicon",
             "FPT công bố chip AI FPT-S1 sản xuất tại Việt Nam, nhắm vào thị trường edge computing và IoT công nghiệp với giá thành thấp hơn 40% so với hàng nhập khẩu.",
             "https://fpt.com.vn/fpt-silicon",
             9, new[]{"Công nghệ", "Khởi nghiệp", "Đầu tư"}),

            ("Deepfake detection trở thành yêu cầu pháp lý tại Việt Nam 2026",
             "Bộ TT&TT ban hành nghị định bắt buộc các nền tảng mạng xã hội phải tích hợp công nghệ phát hiện deepfake từ tháng 9/2026.",
             "https://mic.gov.vn/deepfake-regulation",
             8, new[]{"Công nghệ", "Chính sách"}),

            // Kinh doanh & Tài chính
            ("Thanh toán QR Code chiếm 70% giao dịch bán lẻ tại Việt Nam",
             "Ngân hàng Nhà nước công bố QR Code chiếm 70% tổng giao dịch bán lẻ không dùng tiền mặt, VietQR ghi nhận 10 triệu lượt quét/ngày.",
             "https://sbv.gov.vn/qr-payment-report",
             8, new[]{"Tài chính", "Kinh doanh", "Công nghệ"}),

            ("Xuất khẩu sầu riêng Việt Nam vượt 3 tỷ USD lần đầu tiên",
             "Sầu riêng Việt Nam xuất khẩu đạt 3,2 tỷ USD trong năm 2025, trở thành mặt hàng nông sản xuất khẩu lớn nhất, vượt qua cả tôm và cà phê.",
             "https://mard.gov.vn/sau-rieng-3ty",
             8, new[]{"Kinh doanh", "Đầu tư"}),

            ("IPO làn sóng mới: 15 startup Việt lên sàn chứng khoán trong 2026",
             "Sau MoMo, thêm 15 startup công nghệ Việt Nam đang trong lộ trình IPO trên HoSE và HNX, hút dòng tiền đầu tư nội địa mạnh mẽ.",
             "https://vietstock.vn/ipo-startup-2026",
             9, new[]{"Tài chính", "Khởi nghiệp", "Đầu tư"}),

            // Thương mại điện tử
            ("Shopee và TikTok Shop đồng loạt thu phí hoa hồng mới từ tháng 7",
             "Shopee tăng phí hoa hồng từ 2% lên 4%, TikTok Shop điều chỉnh lên 3.5%, buộc nhiều nhà bán hàng phải tái tính chiến lược định giá.",
             "https://ecommercevietnam.net/phi-hoa-hong-moi",
             9, new[]{"Kinh doanh", "Marketing"}),

            ("Live commerce 'ngủ' phá kỷ lục: streamer bán 5 tỷ trong 8 tiếng",
             "Một phiên live TikTok Shop kéo dài 8 tiếng liên tục ghi nhận doanh thu 5 tỷ đồng, đánh dấu kỷ lục mới cho thị trường live commerce Việt Nam.",
             "https://cafebiz.vn/live-commerce-5-ty",
             8, new[]{"Marketing", "Kinh doanh"}),

            // Sức khỏe & Lifestyle
            ("GLP-1 — thuốc giảm cân thế hệ mới gây sốt tại Việt Nam",
             "Các loại thuốc GLP-1 như Ozempic và Wegovy đang tạo cơn sốt tại Việt Nam với nhu cầu tăng 500%, Bộ Y tế vào cuộc kiểm soát giá và nguồn cung.",
             "https://suckhoedoisong.vn/glp1-viet-nam",
             9, new[]{"Sức khỏe"}),

            ("Phong trào không điện thoại buổi sáng lan rộng ở giới trẻ Việt",
             "Thách thức '1 giờ không màn hình sau khi thức dậy' thu hút 2 triệu người Việt tham gia trên TikTok, thúc đẩy nhu cầu sổ tay, sách giấy tăng 40%.",
             "https://vnexpress.net/khong-dien-thoai-buoi-sang",
             7, new[]{"Sức khỏe", "Tâm lý", "Giải trí"}),

            // Du lịch
            ("Đà Lạt thu hút 1 triệu khách trong mùa hè 2026 — kỷ lục mới",
             "Đà Lạt đón 1,1 triệu lượt khách trong tháng 6-7/2026, cao nhất lịch sử, kéo theo làn sóng đầu tư homestay và resort tăng mạnh.",
             "https://dalattourist.com.vn/ky-luc-he-2026",
             8, new[]{"Du lịch", "Đầu tư", "Bất động sản"}),

            ("Vé tàu cao tốc Hà Nội – TP.HCM dự kiến bán vào cuối 2026",
             "Dự án đường sắt tốc độ cao Bắc-Nam tiến độ nhanh hơn kỳ vọng, Bộ GTVT xác nhận đoạn Hà Nội – Vinh có thể khai thác thử nghiệm cuối năm 2026.",
             "https://baochinhphu.vn/tau-cao-toc-bac-nam",
             9, new[]{"Du lịch", "Chính sách", "Đầu tư"}),

            // Giáo dục
            ("Chứng chỉ AI của Google và Meta được công nhận thay bằng cử nhân IT",
             "Nhiều tập đoàn công nghệ toàn cầu chính thức chấp nhận chứng chỉ Google AI Essentials và Meta AR/VR Developer thay thế bằng cử nhân 4 năm trong tuyển dụng.",
             "https://vnbusiness.vn/chung-chi-ai-thay-bang-dai-hoc",
             9, new[]{"Giáo dục", "Công nghệ", "Khởi nghiệp"}),

            // Bất động sản
            ("Hà Nội mở thêm 3 tuyến metro — BĐS vùng ven tăng nóng",
             "Ba tuyến metro số 2, 3 và 5 tại Hà Nội đồng loạt khởi công, giá nhà đất tại các ga dự kiến tăng 20-35% trong vòng 2 năm.",
             "https://cafef.vn/ha-noi-metro-bds",
             9, new[]{"Bất động sản", "Đầu tư", "Chính sách"}),

            // Môi trường & Năng lượng
            ("Điện gió ngoài khơi Việt Nam — dự án 12 tỷ USD khởi động",
             "Liên doanh Equinor-PetroVietnam chính thức khởi động dự án điện gió ngoài khơi 12 tỷ USD tại Bình Thuận, cung cấp 3.5GW cho lưới điện quốc gia.",
             "https://petrovietnam.petro.com.vn/dien-gio-ngoai-khoi",
             8, new[]{"Môi trường", "Đầu tư", "Chính sách"}),

            // Làm đẹp
            ("K-beauty vs V-beauty — thương hiệu làm đẹp Việt chiếm 25% thị phần nội địa",
             "Các thương hiệu mỹ phẩm thuần Việt như Cocoon, Beauty of Joseon VN đạt 25% thị phần nội địa, đẩy lùi sự thống trị của hàng Hàn Quốc.",
             "https://beautyvietnam.vn/v-beauty-thi-phan",
             7, new[]{"Làm đẹp", "Kinh doanh", "Thời trang"}),

            // Thể thao
            ("SEA Games 34 — Việt Nam đặt mục tiêu top 2 toàn đoàn",
             "Việt Nam đầu tư kỷ lục 500 tỷ đồng cho đoàn thể thao tham dự SEA Games 34 tại Philippines, đặt mục tiêu giành ít nhất 120 HCV.",
             "https://thethao.vnexpress.net/sea-games-34",
             8, new[]{"Thể thao", "Chính sách"}),
        };
        // ── KẾT THÚC DANH SÁCH BÀI MỚI ────────────────────────────────────────

        var rng = new Random();
        var addedCount = 0;

        foreach (var (title, summary, sourceUrl, hotLevel, tags) in newTrends)
        {
            // Bỏ qua nếu đã có
            if (existingTitles.Contains(title)) continue;

            var trend = new Trend
            {
                Title     = title,
                Summary   = summary,
                SourceUrl = sourceUrl,
                HotLevel  = hotLevel,
                Sentiment = hotLevel >= 8 ? "positive" : hotLevel >= 5 ? "neutral" : "negative",
                CreatedAt = DateTime.UtcNow.AddDays(-rng.Next(0, 7)),
                UpdatedAt = DateTime.UtcNow,
            };
            _db.Trends.Add(trend);
            await _db.SaveChangesAsync(ct);
            existingTitles.Add(title); // tránh trùng ngay trong vòng lặp

            // Gán tags
            var trendTags = new List<TrendTag>();
            foreach (var tagRef in tags)
            {
                Tag? tag = null;
                var slug = tagRef.ToLower().Trim()
                    .Replace(" ", "-")
                    .Replace("đ", "d");
                tagBySlug.TryGetValue(slug, out tag);
                if (tag == null) tagByName.TryGetValue(tagRef.ToLower(), out tag);

                if (tag == null)
                {
                    // Tạo tag mới nếu chưa có
                    tag = new Tag { Name = tagRef, Slug = slug };
                    _db.Tags.Add(tag);
                    await _db.SaveChangesAsync(ct);
                    tagBySlug[slug] = tag;
                    tagByName[tagRef.ToLower()] = tag;
                }

                if (!trendTags.Any(tt => tt.TagId == tag.Id))
                    trendTags.Add(new TrendTag { TrendId = trend.Id, TagId = tag.Id });
            }

            if (trendTags.Any())
            {
                _db.TrendTags.AddRange(trendTags);
                await _db.SaveChangesAsync(ct);
            }

            addedCount++;
        }

        if (addedCount > 0)
            _logger.LogInformation("🆕 SeedMoreTrends: đã thêm {Count} bài xu hướng mới.", addedCount);
        else
            _logger.LogInformation("⏭ SeedMoreTrends: không có bài xu hướng mới cần thêm.");
    }

    // ── ROLES ─────────────────────────────────────────────────────────────────
    private async Task<Dictionary<string, Role>> SeedRolesAsync(CancellationToken ct)
    {
        var roles = new List<Role>
        {
            new() { Name = "Admin", Description = "Quản trị viên hệ thống", CreatedAt = DateTime.UtcNow },
            new() { Name = "User",  Description = "Người dùng thông thường", CreatedAt = DateTime.UtcNow },
        };
        _db.Roles.AddRange(roles);
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("  ✓ Roles: {Count}", roles.Count);
        return roles.ToDictionary(r => r.Name);
    }

    // ── USERS ─────────────────────────────────────────────────────────────────
    private async Task<List<User>> SeedUsersAsync(Dictionary<string, Role> roles, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var users = new List<User>();

        var profiles = new[]
        {
            ("admin@socialsense.vn",   "Admin SocialSense",    true,  UserTier.Enterprise),
            ("user1@socialsense.vn",   "Nguyễn Văn An",        false, UserTier.Pro),
            ("user2@socialsense.vn",   "Trần Thị Bình",        false, UserTier.Pro),
            ("user3@socialsense.vn",   "Lê Minh Cường",        false, UserTier.Free),
            ("user4@socialsense.vn",   "Phạm Thu Dung",        false, UserTier.Free),
            ("user5@socialsense.vn",   "Hoàng Văn Em",         false, UserTier.Free),
            ("user6@socialsense.vn",   "Vũ Thị Phương",        false, UserTier.Pro),
            ("user7@socialsense.vn",   "Đặng Quốc Giang",      false, UserTier.Free),
            ("user8@socialsense.vn",   "Bùi Thị Hoa",          false, UserTier.Free),
            ("user9@socialsense.vn",   "Ngô Văn Inh",          false, UserTier.Free),
        };

        foreach (var (email, name, isAdmin, tier) in profiles)
        {
            var quota = User.GetDefaultQuota(tier);
            var user = new User
            {
                Email = email,
                DisplayName = name,
                PasswordHash = HashPassword("Password123!"),
                HasContext = true,
                IsActive = true,
                Tier = tier,
                DailyQuotaLimit = quota,
                RemainingQuota = quota,
                LastQuotaReset = now,
                CreatedAt = now.AddDays(-new Random().Next(1, 60)),
                UpdatedAt = now,
            };
            users.Add(user);
        }

        _db.Users.AddRange(users);
        await _db.SaveChangesAsync(ct);

        // Gán roles
        var userRoles = new List<UserRole>();
        for (int i = 0; i < users.Count; i++)
        {
            var (_, _, isAdmin, _) = profiles[i];
            if (isAdmin)
            {
                userRoles.Add(new UserRole { UserId = users[i].Id, RoleId = roles["Admin"].Id });
            }
            userRoles.Add(new UserRole { UserId = users[i].Id, RoleId = roles["User"].Id });
        }
        _db.UserRoles.AddRange(userRoles);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("  ✓ Users: {Count}", users.Count);
        return users;
    }

    // ── TAGS ──────────────────────────────────────────────────────────────────
    private async Task<List<Tag>> SeedTagsAsync(CancellationToken ct)
    {
        var tagData = new[]
        {
            ("Bất động sản",    "bat-dong-san"),
            ("Tài chính",       "tai-chinh"),
            ("Thời trang",      "thoi-trang"),
            ("Công nghệ",       "cong-nghe"),
            ("Ẩm thực",         "am-thuc"),
            ("Du lịch",         "du-lich"),
            ("Sức khỏe",        "suc-khoe"),
            ("Giáo dục",        "giao-duc"),
            ("Thể thao",        "the-thao"),
            ("Giải trí",        "giai-tri"),
            ("Kinh doanh",      "kinh-doanh"),
            ("Marketing",       "marketing"),
            ("Đầu tư",          "dau-tu"),
            ("Khởi nghiệp",     "khoi-nghiep"),
            ("Môi trường",      "moi-truong"),
            ("Chính sách",      "chinh-sach"),
            ("Xe cộ",           "xe-co"),
            ("Nội thất",        "noi-that"),
            ("Làm đẹp",         "lam-dep"),
            ("Tâm lý",          "tam-ly"),
        };

        var tags = tagData.Select(t => new Tag { Name = t.Item1, Slug = t.Item2 }).ToList();
        _db.Tags.AddRange(tags);
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("  ✓ Tags: {Count}", tags.Count);
        return tags;
    }

    // ── TRENDS ────────────────────────────────────────────────────────────────
    private async Task<List<Trend>> SeedTrendsAsync(List<Tag> tags, CancellationToken ct)
    {
        var rng = new Random(42);
        var now = DateTime.UtcNow;

        var trendData = new[]
        {
            // BĐS
            ("Căn hộ mini dưới 1 tỷ đang hot tại TP.HCM 2026",
             "Phân khúc căn hộ mini diện tích 25-35m² giá dưới 1 tỷ đang thu hút mạnh nhà đầu tư trẻ tại TP.HCM nhờ lợi suất cho thuê cao 8-10%/năm.",
             "bat-dong-san", 9),
            ("Đất nền ven đô tăng giá 30% sau quy hoạch vành đai 4",
             "Các lô đất nền tại Bình Dương, Long An, Đồng Nai tăng mạnh sau khi quy hoạch vành đai 4 được phê duyệt, nhiều nhà đầu tư chốt lời nhanh.",
             "bat-dong-san", 8),
            ("Condotel Đà Nẵng phục hồi mạnh sau 3 năm trầm lắng",
             "Thị trường condotel Đà Nẵng ghi nhận tỷ lệ lấp đầy 85% trong quý 1/2026, giá bán tăng 15% so với cùng kỳ năm ngoái.",
             "bat-dong-san", 7),
            ("Nhà phố thương mại khu vực Thủ Đức lên cơn sốt",
             "Shophouse tại TP Thủ Đức đang được săn đón mạnh với giá từ 8-15 tỷ/căn, thanh khoản tốt nhờ hạ tầng hoàn thiện.",
             "bat-dong-san", 8),
            ("Bất động sản nghỉ dưỡng Phú Quốc bứt phá 2026",
             "Phú Quốc đón 5 triệu khách quốc tế trong năm 2025, kéo theo nhu cầu đầu tư BĐS nghỉ dưỡng tăng vọt với nhiều dự án mới ra mắt.",
             "bat-dong-san", 9),

            // Tài chính
            ("Lãi suất ngân hàng giảm về mức thấp nhất 5 năm",
             "NHNN điều chỉnh lãi suất điều hành xuống 4%/năm, các ngân hàng thương mại đồng loạt giảm lãi suất cho vay mua nhà còn 7-8%/năm.",
             "tai-chinh", 10),
            ("Chứng khoán Việt Nam vượt mốc 1.500 điểm lần đầu",
             "VN-Index lần đầu tiên trong lịch sử vượt ngưỡng 1.500 điểm, dòng tiền ngoại mua ròng 2.000 tỷ trong tuần qua.",
             "tai-chinh", 9),
            ("Bitcoin chạm 120.000 USD, nhà đầu tư Việt ồ ạt tham gia",
             "Giá Bitcoin lập đỉnh mới 120.000 USD, lượng giao dịch crypto tại Việt Nam tăng 300% so với tháng trước.",
             "tai-chinh", 8),
            ("Quỹ ETF nội địa hút 5.000 tỷ trong tháng 5/2026",
             "Các quỹ ETF nội địa ghi nhận dòng tiền vào kỷ lục, phản ánh xu hướng đầu tư thụ động ngày càng phổ biến tại Việt Nam.",
             "tai-chinh", 7),
            ("Vàng SJC tăng vọt lên 120 triệu/lượng",
             "Giá vàng SJC lập đỉnh mới 120 triệu đồng/lượng trong bối cảnh căng thẳng địa chính trị toàn cầu leo thang.",
             "tai-chinh", 9),

            // Công nghệ
            ("AI tạo sinh thay đổi hoàn toàn ngành marketing 2026",
             "Các công cụ AI như GPT-5, Gemini 2.5 đang được 70% doanh nghiệp Việt Nam ứng dụng vào marketing, giảm chi phí sản xuất nội dung 60%.",
             "cong-nghe", 10),
            ("Smartphone gập giá dưới 10 triệu xuất hiện tại Việt Nam",
             "Samsung và Xiaomi ra mắt dòng điện thoại gập giá phổ thông dưới 10 triệu đồng, mở ra phân khúc mới tại thị trường Việt Nam.",
             "cong-nghe", 8),
            ("5G phủ sóng 63 tỉnh thành, tốc độ download đạt 2Gbps",
             "Viettel và VNPT hoàn thành phủ sóng 5G toàn quốc, mở ra kỷ nguyên mới cho IoT và smart city tại Việt Nam.",
             "cong-nghe", 7),
            ("Xe điện VinFast chiếm 40% thị phần xe mới tại Việt Nam",
             "VinFast VF3 và VF5 dẫn đầu doanh số xe điện, chiếm 40% tổng xe mới bán ra trong quý 1/2026 nhờ giá cạnh tranh và hạ tầng sạc mở rộng.",
             "cong-nghe", 9),
            ("ChatGPT-5 ra mắt với khả năng lý luận vượt trội",
             "OpenAI ra mắt ChatGPT-5 với benchmark vượt qua kỳ thi y khoa và luật sư, tạo làn sóng ứng dụng AI mới trong các ngành chuyên môn.",
             "cong-nghe", 10),

            // Thời trang
            ("Thời trang bền vững lên ngôi tại Việt Nam 2026",
             "Xu hướng slow fashion và thời trang tái chế bùng nổ, 60% người tiêu dùng Gen Z ưu tiên thương hiệu có cam kết môi trường.",
             "thoi-trang", 7),
            ("Streetwear Việt Nam xuất khẩu sang thị trường Đông Nam Á",
             "Các thương hiệu streetwear nội địa như Dirty Coins, Routine đang mở rộng sang Singapore, Thái Lan với doanh thu tăng 200%.",
             "thoi-trang", 6),
            ("Áo dài hiện đại trở thành xu hướng thời trang toàn cầu",
             "Áo dài cách tân Việt Nam xuất hiện trên sàn diễn Paris Fashion Week, thu hút sự chú ý của giới thời trang quốc tế.",
             "thoi-trang", 8),

            // Ẩm thực
            ("Ẩm thực đường phố Việt Nam lọt top 10 thế giới",
             "CNN Travel xếp ẩm thực đường phố Việt Nam vào top 10 thế giới, kéo theo làn sóng du khách quốc tế tìm đến trải nghiệm.",
             "am-thuc", 8),
            ("Cà phê specialty Việt Nam chinh phục thị trường Nhật Bản",
             "Cà phê đặc sản từ Đà Lạt, Cầu Đất đang được xuất khẩu sang Nhật với giá 500.000 đồng/100g, tạo ra làn sóng cà phê Việt mới.",
             "am-thuc", 7),
            ("Nhà hàng Việt Nam đầu tiên đạt 3 sao Michelin",
             "Một nhà hàng tại Hà Nội trở thành nhà hàng Việt Nam đầu tiên đạt 3 sao Michelin, đánh dấu bước ngoặt cho ẩm thực fine dining Việt.",
             "am-thuc", 9),

            // Du lịch
            ("Việt Nam đón 25 triệu khách quốc tế năm 2026",
             "Du lịch Việt Nam phục hồi mạnh mẽ với 25 triệu lượt khách quốc tế, doanh thu đạt 45 tỷ USD, vượt mục tiêu đề ra.",
             "du-lich", 8),
            ("Phú Quốc United Center trở thành điểm đến hàng đầu Đông Nam Á",
             "Khu vui chơi giải trí lớn nhất Đông Nam Á tại Phú Quốc đón 10 triệu lượt khách trong năm đầu hoạt động.",
             "du-lich", 7),
            ("Visa điện tử 90 ngày mở cửa cho 60 quốc gia",
             "Việt Nam mở rộng chính sách visa điện tử 90 ngày cho công dân 60 quốc gia, kỳ vọng tăng 30% lượng khách quốc tế.",
             "du-lich", 8),

            // Sức khỏe
            ("Xu hướng chạy bộ marathon bùng nổ tại Việt Nam",
             "Số người tham gia marathon tại Việt Nam tăng 400% trong 3 năm qua, thị trường đồ thể thao và dinh dưỡng thể thao tăng trưởng mạnh.",
             "suc-khoe", 7),
            ("Thực phẩm chức năng nội địa chiếm 60% thị phần",
             "Các thương hiệu thực phẩm chức năng Việt Nam như Traphaco, OPC đang chiếm ưu thế trước hàng ngoại nhập nhờ giá cạnh tranh và chất lượng cải thiện.",
             "suc-khoe", 6),

            // Giáo dục
            ("Học online vượt học truyền thống về số lượng học viên",
             "Nền tảng học trực tuyến Việt Nam ghi nhận 15 triệu học viên đăng ký trong năm 2025, vượt qua số học sinh học truyền thống lần đầu tiên.",
             "giao-duc", 7),
            ("Lập trình AI trở thành kỹ năng bắt buộc trong trường đại học",
             "Bộ GD&ĐT yêu cầu tất cả sinh viên đại học phải học ít nhất 1 môn về AI và lập trình từ năm học 2026-2027.",
             "giao-duc", 8),

            // Thể thao
            ("Đội tuyển Việt Nam lần đầu vào vòng 16 đội World Cup",
             "Đội tuyển bóng đá Việt Nam tạo kỳ tích lịch sử khi lần đầu tiên vượt qua vòng bảng World Cup 2026, cả nước vỡ òa.",
             "the-thao", 10),
            ("VPF ra mắt giải V.League phiên bản mới với 16 đội",
             "V.League 2026 nâng cấp lên 16 đội với sự tham gia của nhiều cầu thủ ngoại chất lượng cao, thu hút hàng triệu khán giả.",
             "the-thao", 7),

            // Kinh doanh
            ("Startup Việt Nam huy động 500 triệu USD trong Q1/2026",
             "Hệ sinh thái startup Việt Nam ghi nhận kỷ lục huy động vốn 500 triệu USD trong quý đầu năm 2026, dẫn đầu là fintech và edtech.",
             "kinh-doanh", 8),
            ("Thương mại điện tử Việt Nam đạt 30 tỷ USD",
             "Doanh thu TMĐT Việt Nam đạt 30 tỷ USD năm 2025, tăng 25% so với năm trước, Shopee và TikTok Shop dẫn đầu thị phần.",
             "kinh-doanh", 9),
            ("Xuất khẩu phần mềm Việt Nam vượt 10 tỷ USD",
             "Ngành công nghiệp phần mềm Việt Nam xuất khẩu đạt 10 tỷ USD, đứng thứ 2 Đông Nam Á sau Singapore.",
             "kinh-doanh", 8),

            // Marketing
            ("TikTok Shop chiếm 35% thị phần TMĐT Việt Nam",
             "TikTok Shop vượt Lazada trở thành nền tảng TMĐT lớn thứ 2 Việt Nam với 35% thị phần, livestream bán hàng tăng 500%.",
             "marketing", 9),
            ("Influencer marketing B2B bùng nổ tại Việt Nam",
             "Xu hướng sử dụng KOL/KOC trong lĩnh vực B2B tăng mạnh, đặc biệt trong ngành tài chính, bất động sản và công nghệ.",
             "marketing", 7),
            ("Video ngắn dưới 30 giây chiếm 80% lượt xem mạng xã hội",
             "Theo báo cáo mới nhất, video dưới 30 giây chiếm 80% tổng lượt xem trên các nền tảng mạng xã hội tại Việt Nam.",
             "marketing", 8),

            // Đầu tư
            ("Quỹ đầu tư mạo hiểm rót 200 triệu USD vào AI Việt Nam",
             "Các quỹ VC lớn như Sequoia, Softbank đang tích cực đầu tư vào startup AI Việt Nam, tập trung vào fintech và healthtech.",
             "dau-tu", 8),
            ("Trái phiếu doanh nghiệp phục hồi mạnh sau khủng hoảng",
             "Thị trường trái phiếu doanh nghiệp Việt Nam phục hồi với lãi suất ổn định 9-11%/năm, nhà đầu tư dần lấy lại niềm tin.",
             "dau-tu", 7),

            // Khởi nghiệp
            ("Unicorn thứ 5 của Việt Nam ra đời trong lĩnh vực fintech",
             "Startup fintech MoMo đạt định giá 2 tỷ USD sau vòng gọi vốn Series F, trở thành unicorn thứ 5 của Việt Nam.",
             "khoi-nghiep", 9),
            ("Chương trình hỗ trợ startup của Chính phủ tăng gấp đôi ngân sách",
             "Chính phủ tăng ngân sách hỗ trợ startup lên 2.000 tỷ đồng/năm, tập trung vào AI, bán dẫn và công nghệ xanh.",
             "khoi-nghiep", 7),

            // Môi trường
            ("Năng lượng mặt trời áp mái bùng nổ tại Việt Nam",
             "Hơn 500.000 hộ gia đình lắp đặt điện mặt trời áp mái trong năm 2025, tiết kiệm trung bình 2 triệu đồng/tháng tiền điện.",
             "moi-truong", 7),
            ("Xe điện giảm 50% lượng khí thải tại các đô thị lớn",
             "Báo cáo môi trường cho thấy tỷ lệ xe điện tăng cao đã giúp giảm 50% lượng khí thải CO2 tại Hà Nội và TP.HCM.",
             "moi-truong", 6),

            // Xe cộ
            ("VinFast ra mắt xe tải điện đầu tiên tại Việt Nam",
             "VinFast giới thiệu dòng xe tải điện VF Truck với tải trọng 3.5 tấn, phạm vi hoạt động 300km, giá 800 triệu đồng.",
             "xe-co", 7),
            ("Grab ra mắt dịch vụ xe điện GrabElectric tại 5 thành phố",
             "Grab triển khai 10.000 xe điện tại Hà Nội, TP.HCM, Đà Nẵng, Cần Thơ và Hải Phòng, cam kết 100% xe điện vào 2028.",
             "xe-co", 8),

            // Nội thất
            ("Nội thất thông minh tích hợp AI bùng nổ tại Việt Nam",
             "Thị trường nội thất thông minh Việt Nam tăng trưởng 40%/năm, các sản phẩm tích hợp AI như giường thông minh, bàn làm việc tự điều chỉnh được ưa chuộng.",
             "noi-that", 6),

            // Làm đẹp
            ("Skincare Việt Nam xuất khẩu sang Hàn Quốc",
             "Thương hiệu mỹ phẩm Việt Nam Cocoon và Innisfree Việt Nam đang xuất khẩu sang Hàn Quốc — thị trường khó tính nhất thế giới về làm đẹp.",
             "lam-dep", 7),
            ("Xu hướng glass skin lan rộng tại Việt Nam 2026",
             "Phong trào chăm sóc da theo phong cách Hàn Quốc glass skin thu hút 5 triệu người Việt tham gia, thị trường skincare tăng 35%.",
             "lam-dep", 8),

            // Tâm lý
            ("Sức khỏe tâm thần trở thành ưu tiên hàng đầu của Gen Z",
             "Khảo sát cho thấy 70% Gen Z Việt Nam sẵn sàng chi tiền cho liệu pháp tâm lý, thị trường mental health app tăng trưởng 200%.",
             "tam-ly", 7),
            ("Thiền định và mindfulness bùng nổ tại doanh nghiệp",
             "Hơn 500 doanh nghiệp lớn tại Việt Nam triển khai chương trình mindfulness cho nhân viên, giảm 30% tỷ lệ burnout.",
             "tam-ly", 6),
        };

        var tagBySlug = tags.ToDictionary(t => t.Slug);
        var trendList = new List<Trend>();

        for (int i = 0; i < trendData.Length; i++)
        {
            var (title, summary, tagSlug, hotLevel) = trendData[i];
            trendList.Add(new Trend
            {
                Title     = title,
                Summary   = summary,
                SourceUrl = $"https://vnexpress.net/trend-{i + 1}",
                HotLevel  = hotLevel,
                Sentiment = hotLevel >= 8 ? "positive" : hotLevel >= 5 ? "neutral" : "negative",
                CreatedAt = DateTime.UtcNow.AddDays(-rng.Next(0, 30)),
                UpdatedAt = DateTime.UtcNow,
            });
        }

        _db.Trends.AddRange(trendList);
        await _db.SaveChangesAsync(ct);

        // TrendTags — chỉ gán primary tag, không random tag phụ
        // (tag phụ ngẫu nhiên gây nhiễu khi user filter theo category)
        var trendTags = new List<TrendTag>();
        for (int i = 0; i < trendList.Count; i++)
        {
            var (_, _, primarySlug, _) = trendData[i];
            var primaryTag = tagBySlug.GetValueOrDefault(primarySlug);
            if (primaryTag != null)
                trendTags.Add(new TrendTag { TrendId = trendList[i].Id, TagId = primaryTag.Id });
        }
        _db.TrendTags.AddRange(trendTags);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("  ✓ Trends: {Count}, TrendTags: {TagCount}", trendList.Count, trendTags.Count);
        return trendList;
    }

    // ── USER CONTEXTS ─────────────────────────────────────────────────────────
    private async Task SeedUserContextsAsync(List<User> users, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var personas = new[]
        {
            // (jobTitle, tone, platforms, audience, formats, negatives, language)
            ("Môi giới Bất động sản cao cấp",
             "Chuyên nghiệp, tin cậy, gần gũi",
             new[]{"Facebook","Zalo","Instagram"},
             new[]{"Nhà đầu tư 35-55 tuổi","Thu nhập cao","Quan tâm BĐS TP.HCM"},
             new[]{"Phân tích thị trường","Review dự án","Câu chuyện thành công"},
             new[]{"Không đề cập dự án tranh chấp","Không cam kết lợi nhuận cụ thể"},
             "vi"),
            ("Chuyên gia Tài chính & Đầu tư",
             "Phân tích sâu, dữ liệu thực tế, thuyết phục",
             new[]{"LinkedIn","Facebook","YouTube"},
             new[]{"Nhà đầu tư cá nhân","Doanh nhân 30-50 tuổi","Quan tâm chứng khoán và crypto"},
             new[]{"Phân tích kỹ thuật","Báo cáo thị trường","Video giải thích"},
             new[]{"Không đưa ra lời khuyên đầu tư cụ thể","Không hứa hẹn lợi nhuận"},
             "vi"),
            ("Nhà thiết kế thời trang",
             "Sáng tạo, trẻ trung, cá tính",
             new[]{"Instagram","TikTok","Pinterest"},
             new[]{"Phụ nữ 18-35 tuổi","Yêu thời trang","Thu nhập trung bình khá"},
             new[]{"Lookbook","Behind the scenes","Styling tips"},
             new[]{"Không dùng hình ảnh phản cảm","Không so sánh với đối thủ"},
             "vi"),
            ("Chủ nhà hàng & Food Blogger",
             "Nhiệt tình, cởi mở, kích thích vị giác",
             new[]{"Facebook","Instagram","TikTok"},
             new[]{"Người yêu ẩm thực","Gia đình trẻ","Du khách"},
             new[]{"Review món ăn","Video nấu ăn","Khuyến mãi đặc biệt"},
             new[]{"Không đề cập đến đối thủ cạnh tranh"},
             "vi"),
            ("Hướng dẫn viên du lịch",
             "Vui vẻ, nhiệt huyết, truyền cảm hứng",
             new[]{"Facebook","Instagram","YouTube"},
             new[]{"Người yêu du lịch","Gia đình","Cặp đôi trẻ"},
             new[]{"Vlog du lịch","Tips tiết kiệm","Review địa điểm"},
             new[]{"Không quảng cáo tour giá rẻ kém chất lượng"},
             "vi"),
            ("Huấn luyện viên thể hình & Sức khỏe",
             "Năng động, khích lệ, khoa học",
             new[]{"Instagram","TikTok","YouTube"},
             new[]{"Người muốn giảm cân","Gym goers","Người quan tâm sức khỏe"},
             new[]{"Workout videos","Nutrition tips","Transformation stories"},
             new[]{"Không quảng cáo thực phẩm chức năng không rõ nguồn gốc"},
             "vi"),
            ("Giáo viên & Gia sư Online",
             "Thân thiện, kiên nhẫn, dễ hiểu",
             new[]{"Facebook","YouTube","Zalo"},
             new[]{"Học sinh THPT","Phụ huynh","Sinh viên đại học"},
             new[]{"Bài giảng ngắn","Tips học tập","Giải đề thi"},
             new[]{"Không hứa hẹn điểm số cụ thể"},
             "vi"),
            ("Chuyên gia Marketing Digital",
             "Sắc bén, dữ liệu, thực chiến",
             new[]{"LinkedIn","Facebook","Twitter"},
             new[]{"Doanh nghiệp vừa và nhỏ","Marketing manager","Startup founder"},
             new[]{"Case study","Hướng dẫn thực hành","Phân tích chiến dịch"},
             new[]{"Không dùng thuật ngữ quá kỹ thuật"},
             "vi"),
            ("Nhà sáng lập Startup Công nghệ",
             "Đổi mới, táo bạo, tầm nhìn xa",
             new[]{"LinkedIn","Twitter","Facebook"},
             new[]{"Nhà đầu tư","Kỹ sư phần mềm","Doanh nhân trẻ"},
             new[]{"Thought leadership","Product updates","Behind the scenes"},
             new[]{"Không tiết lộ thông tin nhạy cảm về sản phẩm"},
             "en"),
            ("Chuyên gia Tâm lý & Life Coach",
             "Đồng cảm, ấm áp, truyền cảm hứng",
             new[]{"Facebook","Instagram","YouTube"},
             new[]{"Người đang gặp khó khăn tâm lý","Gen Z","Người muốn phát triển bản thân"},
             new[]{"Chia sẻ kiến thức","Câu chuyện thực tế","Bài tập mindfulness"},
             new[]{"Không đưa ra chẩn đoán y tế","Không thay thế liệu pháp chuyên nghiệp"},
             "vi"),
        };

        var contexts = new List<UserContext>();
        for (int i = 0; i < users.Count; i++)
        {
            var p = personas[i % personas.Length];
            contexts.Add(new UserContext
            {
                UserId = users[i].Id,
                Language = p.Item7,
                RawAnswersJson = JsonSerializer.Serialize(new[] { p.Item1, p.Item2, string.Join(", ", p.Item3) }),
                JobTitle = p.Item1,
                ToneOfVoice = p.Item2,
                PlatformPreferencesJson = JsonSerializer.Serialize(p.Item3),
                TargetAudienceJson = JsonSerializer.Serialize(p.Item4),
                ContentFormatsJson = JsonSerializer.Serialize(p.Item5),
                NegativeConstraintsJson = JsonSerializer.Serialize(p.Item6),
                Version = 1,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now,
            });
        }

        _db.UserContexts.AddRange(contexts);
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("  ✓ UserContexts: {Count}", contexts.Count);
    }

    // ── CONTENT HISTORIES ─────────────────────────────────────────────────────
    private async Task SeedContentHistoriesAsync(List<User> users, List<Trend> trends, CancellationToken ct)
    {
        var rng = new Random(42);
        var histories = new List<ContentHistory>();

        var sampleItems = new[]
        {
            new { platform = "Facebook", hook = "Cơ hội đầu tư không thể bỏ lỡ!", body = "Thị trường bất động sản đang có những biến động tích cực. Đây là thời điểm vàng để đầu tư.", cta = "Liên hệ ngay để được tư vấn miễn phí!", hashtags = new[]{"BatDongSan","DauTu","2026"} },
            new { platform = "Instagram", hook = "Xu hướng mới nhất bạn cần biết 🔥", body = "Thị trường đang thay đổi nhanh chóng. Hãy cập nhật ngay để không bị bỏ lại phía sau.", cta = "Follow để không bỏ lỡ thông tin!", hashtags = new[]{"Trending","Update","Hot"} },
            new { platform = "TikTok", hook = "Bí quyết thành công mà ít ai biết!", body = "Sau 10 năm kinh nghiệm, tôi đúc kết được những bí quyết quan trọng nhất.", cta = "Like và share nếu thấy hữu ích!", hashtags = new[]{"BíQuyết","ThànhCông","Tips"} },
            new { platform = "Zalo", hook = "Thông tin quan trọng cho bạn!", body = "Chúng tôi vừa cập nhật thông tin mới nhất về thị trường. Đừng bỏ lỡ cơ hội này.", cta = "Nhắn tin để biết thêm chi tiết!", hashtags = new[]{"ThongTin","CapNhat","QuanTrong"} },
            new { platform = "LinkedIn", hook = "Insights từ chuyên gia hàng đầu", body = "Dựa trên phân tích dữ liệu thực tế, đây là những xu hướng quan trọng nhất năm 2026.", cta = "Connect để cùng thảo luận!", hashtags = new[]{"Insights","Expert","2026"} },
        };

        foreach (var user in users)
        {
            for (int j = 0; j < 5; j++)
            {
                var sample = sampleItems[j % sampleItems.Length];
                var trend = trends[rng.Next(trends.Count)];
                var contentJson = JsonSerializer.Serialize(new[]
                {
                    new
                    {
                        platform = sample.platform,
                        hook = sample.hook,
                        body = sample.body,
                        cta = sample.cta,
                        hashtags = sample.hashtags,
                        language = "vi",
                        mediaUrl = (string?)null,
                        bannerImagePrompt = "A professional social media banner, clean design, 4k",
                        bestTimeToPost = "Thứ Ba lúc 19:30 - Khung giờ vàng tương tác cao"
                    }
                });

                histories.Add(new ContentHistory
                {
                    UserId = user.Id,
                    OriginalTrendId = trend.Id,
                    GeneratedContent = contentJson,
                    IsEdited = rng.Next(2) == 0,
                    CreatedAt = DateTime.UtcNow.AddDays(-rng.Next(0, 30)).AddHours(-rng.Next(0, 24)),
                });
            }
        }

        _db.ContentHistories.AddRange(histories);
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("  ✓ ContentHistories: {Count}", histories.Count);
    }

    // ── KNOWLEDGE ─────────────────────────────────────────────────────────────
    private async Task SeedKnowledgeAsync(CancellationToken ct)
    {
        var knowledgeData = new[]
        {
            ("Hướng dẫn đầu tư BĐS cho người mới bắt đầu",
             "manual",
             "Đầu tư bất động sản là kênh đầu tư an toàn và sinh lời bền vững. Các loại hình phổ biến: căn hộ, đất nền, nhà phố, condotel. Nguyên tắc vàng: vị trí, vị trí, vị trí. Luôn kiểm tra pháp lý trước khi mua. Tỷ suất lợi nhuận kỳ vọng 8-12%/năm."),
            ("Chiến lược marketing trên mạng xã hội 2026",
             "manual",
             "Marketing mạng xã hội hiệu quả cần: nội dung chất lượng cao, đăng đúng giờ vàng, tương tác với followers, sử dụng hashtag phù hợp. Video ngắn dưới 60 giây có tỷ lệ tiếp cận cao nhất. TikTok và Instagram Reels đang dẫn đầu về organic reach."),
            ("Phân tích thị trường chứng khoán Việt Nam Q2/2026",
             "manual",
             "VN-Index đang trong xu hướng tăng dài hạn. Các ngành dẫn đầu: ngân hàng, bất động sản, công nghệ. P/E thị trường ở mức 15x, hấp dẫn so với khu vực. Dòng tiền ngoại mua ròng liên tục 3 tháng. Khuyến nghị: tích lũy cổ phiếu blue-chip."),
            ("Xu hướng thời trang bền vững và slow fashion",
             "manual",
             "Slow fashion đang thay thế fast fashion trong tâm trí người tiêu dùng trẻ. Các thương hiệu bền vững tăng trưởng 40%/năm. Người tiêu dùng sẵn sàng trả thêm 20-30% cho sản phẩm thân thiện môi trường. Vải tái chế và organic cotton đang là xu hướng chủ đạo."),
            ("Bí quyết kinh doanh nhà hàng thành công",
             "manual",
             "Thành công trong kinh doanh F&B cần: vị trí đắc địa, menu đặc trưng, dịch vụ xuất sắc, marketing hiệu quả. Chi phí thực phẩm nên dưới 30% doanh thu. Đánh giá trực tuyến ảnh hưởng 70% quyết định của khách hàng. Loyalty program giúp tăng 25% doanh thu tái mua."),
            ("Hướng dẫn du lịch tiết kiệm tại Đông Nam Á",
             "manual",
             "Du lịch Đông Nam Á với ngân sách 500 USD/tuần hoàn toàn khả thi. Các điểm đến hot: Bali, Bangkok, Hội An, Luang Prabang. Đặt vé máy bay trước 3 tháng tiết kiệm 40%. Ở hostel hoặc guesthouse địa phương để trải nghiệm văn hóa thực sự."),
            ("Chương trình tập luyện 12 tuần cho người mới bắt đầu",
             "manual",
             "Chương trình 12 tuần bao gồm: 4 tuần xây nền tảng, 4 tuần tăng cường độ, 4 tuần đỉnh cao. Tập 4 buổi/tuần, mỗi buổi 45-60 phút. Kết hợp cardio và strength training. Dinh dưỡng: protein 2g/kg cân nặng, carb phức hợp, chất béo lành mạnh."),
            ("Phương pháp học tiếng Anh hiệu quả trong 6 tháng",
             "manual",
             "Học tiếng Anh hiệu quả cần: immersion hàng ngày, học từ vựng theo ngữ cảnh, luyện nghe với native speakers, viết nhật ký bằng tiếng Anh. Ứng dụng hữu ích: Duolingo, Anki, HelloTalk. Mục tiêu thực tế: B2 sau 6 tháng học nghiêm túc 2 giờ/ngày."),
            ("Chiến lược xây dựng thương hiệu cá nhân trên LinkedIn",
             "manual",
             "Personal branding trên LinkedIn: tối ưu profile với ảnh chuyên nghiệp, headline ấn tượng, summary compelling. Đăng bài 3-5 lần/tuần về chuyên môn. Tương tác với thought leaders trong ngành. Kết nối có chọn lọc, chất lượng hơn số lượng."),
            ("Kỹ thuật thiền định và mindfulness cho người bận rộn",
             "manual",
             "Thiền định 10 phút/ngày giảm 40% stress theo nghiên cứu khoa học. Kỹ thuật cơ bản: tập trung vào hơi thở, body scan, loving-kindness meditation. Ứng dụng hỗ trợ: Headspace, Calm, Insight Timer. Thực hành đều đặn quan trọng hơn thời gian dài."),
        };

        var items = knowledgeData.Select((k, i) => new KnowledgeItem
        {
            Title = k.Item1,
            SourceType = k.Item2,
            ContentHash = ComputeHash(k.Item3),
            RawContent = k.Item3,
            CreatedAt = DateTime.UtcNow.AddDays(-i),
        }).ToList();

        _db.KnowledgeItems.AddRange(items);
        await _db.SaveChangesAsync(ct);

        // 5 chunks per item
        var chunks = new List<KnowledgeChunk>();
        foreach (var item in items)
        {
            var words = item.RawContent.Split(' ');
            var chunkSize = Math.Max(1, words.Length / 5);
            for (int c = 0; c < 5; c++)
            {
                var chunkWords = words.Skip(c * chunkSize).Take(chunkSize);
                var chunkText = string.Join(" ", chunkWords);
                chunks.Add(new KnowledgeChunk
                {
                    ItemId = item.Id,
                    ChunkText = chunkText,
                    AiSummary = $"Tóm tắt phần {c + 1}: {chunkText[..Math.Min(50, chunkText.Length)]}...",
                    AiInsightsJson = JsonSerializer.Serialize(new[] { "insight1", "insight2" }),
                    Category = item.Title.Split(' ')[0],
                    KeywordsJson = JsonSerializer.Serialize(item.Title.Split(' ').Take(3).ToArray()),
                });
            }
        }

        _db.KnowledgeChunks.AddRange(chunks);
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("  ✓ KnowledgeItems: {Count}, KnowledgeChunks: {ChunkCount}", items.Count, chunks.Count);
    }

    // ── API KEYS ──────────────────────────────────────────────────────────────
    private async Task SeedApiKeysAsync(CancellationToken ct)
    {
        var keys = new List<ApiKeyConfig>
        {
            new() { Label = "OpenRouter-Key1", KeyValue = "sk-or-v1-placeholder-add-real-key", IsActive = false, Notes = "openrouter", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
            new() { Label = "Groq-Key1",       KeyValue = "gsk_placeholder-add-real-key",      IsActive = false, Notes = "groq",        CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
        };
        _db.ApiKeyConfigs.AddRange(keys);
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("  ✓ ApiKeyConfigs: {Count}", keys.Count);
    }

    // ── HELPERS ───────────────────────────────────────────────────────────────
    private static string HashPassword(string password)
        => PasswordHelper.HashPassword(password);

    private static string ComputeHash(string content)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(content));
        return Convert.ToHexString(bytes)[..64];
    }
}
