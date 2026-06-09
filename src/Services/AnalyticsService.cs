using System.Text;
using System.Text.Json;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using Microsoft.EntityFrameworkCore;
using SocialSense.Configuration;
using SocialSense.Data;
using SocialSense.DTOs.Analytics;
using SocialSense.Models;

namespace SocialSense.Services;

public interface IAnalyticsService
{
    Task<AnalyticsReportResponse> AnalyzeSingleAsync(int userId, AnalyzeSingleRequest request, CancellationToken ct);
    Task<AnalyticsReportResponse> AnalyzeCompareAsync(int userId, AnalyzeCompareRequest request, CancellationToken ct);
    Task<AnalyzeCompareRequest> ParseExcelAsync(Stream fileStream, CancellationToken ct);
    byte[] GenerateTemplate();
    Task<List<AnalyticsHistoryItem>> GetHistoryAsync(int userId, int page, int pageSize, CancellationToken ct);
    Task<AnalyticsReportResponse?> GetReportAsync(int userId, int reportId, CancellationToken ct);
}

public class AnalyticsService : IAnalyticsService
{
    private readonly AppDbContext _db;
    private readonly GeminiApiKeyPool _keyPool;
    private readonly HttpClient _client;
    private readonly ContentGeneratorOptions _options;
    private readonly ILogger<AnalyticsService> _logger;

    private static readonly JsonSerializerOptions _jsonOpts = new() { PropertyNameCaseInsensitive = true };

    // Tên metrics hiển thị tiếng Việt
    private static readonly Dictionary<string, (string Name, bool HigherIsBetter)> MetricMeta = new()
    {
        ["reach"]                  = ("Tổng tiếp cận", true),
        ["impressions"]            = ("Lượt hiển thị", true),
        ["totalEngagement"]        = ("Tổng tương tác", true),
        ["likes"]                  = ("Lượt thích", true),
        ["comments"]               = ("Bình luận", true),
        ["shares"]                 = ("Lượt chia sẻ", true),
        ["clicks"]                 = ("Lượt click", true),
        ["newFollowers"]           = ("Người theo dõi mới", true),
        ["profileVisits"]          = ("Lượt xem trang cá nhân", true),
        ["engagementRate"]         = ("Tỉ lệ tương tác (%)", true),
        ["completionRate"]         = ("Tỷ lệ hoàn thành (%)", true),
        ["avgViewDurationSeconds"] = ("Thời gian xem TB (giây)", true),
        ["conversionRate"]         = ("Tỷ lệ chuyển đổi (%)", true),
        ["clickThroughRate"]       = ("Tỷ lệ click (CTR %)", true),
        ["postsCount"]             = ("Số bài đăng", true),
    };

    public AnalyticsService(
        AppDbContext db,
        GeminiApiKeyPool keyPool,
        HttpClient client,
        Microsoft.Extensions.Options.IOptions<ContentGeneratorOptions> options,
        ILogger<AnalyticsService> logger)
    {
        _db = db;
        _keyPool = keyPool;
        _client = client;
        _options = options.Value;
        _logger = logger;
    }

    // ── Single period analysis ────────────────────────────────────────────────
    public async Task<AnalyticsReportResponse> AnalyzeSingleAsync(
        int userId, AnalyzeSingleRequest request, CancellationToken ct)
    {
        var result = await CallAiSingleAsync(request.Metrics, ct);

        var report = new AnalyticsReport
        {
            UserId = userId,
            Platform = request.Metrics.Platform,
            ReportType = "single",
            PeriodALabel = request.Metrics.PeriodLabel,
            MetricsAJson = JsonSerializer.Serialize(request.Metrics),
            ResultJson = JsonSerializer.Serialize(result),
            OverallScore = result.Summary.OverallScore,
            CreatedAt = DateTime.UtcNow
        };

        _db.AnalyticsReports.Add(report);
        await _db.SaveChangesAsync(ct);
        await DeductQuotaAsync(userId, ct);

        return MapToResponse(report, result);
    }

    // ── Compare two periods ───────────────────────────────────────────────────
    public async Task<AnalyticsReportResponse> AnalyzeCompareAsync(
        int userId, AnalyzeCompareRequest request, CancellationToken ct)
    {
        var result = await CallAiCompareAsync(request.PeriodA, request.PeriodB, ct);

        var report = new AnalyticsReport
        {
            UserId = userId,
            Platform = request.PeriodA.Platform,
            ReportType = "compare",
            PeriodALabel = request.PeriodA.PeriodLabel,
            PeriodBLabel = request.PeriodB.PeriodLabel,
            MetricsAJson = JsonSerializer.Serialize(request.PeriodA),
            MetricsBJson = JsonSerializer.Serialize(request.PeriodB),
            ResultJson = JsonSerializer.Serialize(result),
            OverallScore = result.Summary.OverallScore,
            CreatedAt = DateTime.UtcNow
        };

        _db.AnalyticsReports.Add(report);
        await _db.SaveChangesAsync(ct);
        await DeductQuotaAsync(userId, ct);

        return MapToResponse(report, result);
    }

    // ── Parse Excel ───────────────────────────────────────────────────────────
    public async Task<AnalyzeCompareRequest> ParseExcelAsync(Stream fileStream, CancellationToken ct)
    {
        return await Task.Run(() =>
        {
            using var ms = new MemoryStream();
            fileStream.CopyTo(ms);
            ms.Position = 0;

            using var doc = SpreadsheetDocument.Open(ms, false);
            var wb = doc.WorkbookPart ?? throw new InvalidOperationException("Invalid Excel file.");

            var periodA = ParseSheet(wb, 0);
            var periodB = ParseSheet(wb, 1);

            return new AnalyzeCompareRequest { PeriodA = periodA, PeriodB = periodB };
        }, ct);
    }

    private static AnalyticsMetrics ParseSheet(WorkbookPart wb, int sheetIndex)
    {
        var sheets = wb.Workbook.Sheets?.Elements<Sheet>().ToList()
                     ?? throw new InvalidOperationException("No sheets found.");

        if (sheetIndex >= sheets.Count)
            throw new InvalidOperationException($"Sheet index {sheetIndex} not found.");

        var sheetId = sheets[sheetIndex].Id?.Value
                      ?? throw new InvalidOperationException("Sheet ID missing.");
        var wsPart = (WorksheetPart)wb.GetPartById(sheetId);
        var sharedStrings = wb.SharedStringTablePart?.SharedStringTable;

        var rows = wsPart.Worksheet.Descendants<Row>().ToList();
        var data = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in rows.Skip(1)) // skip header row
        {
            var cells = row.Elements<Cell>().ToList();
            if (cells.Count < 2) continue;

            var key = GetCellValue(cells[0], sharedStrings)?.Trim() ?? "";
            var val = GetCellValue(cells[1], sharedStrings)?.Trim() ?? "";
            if (!string.IsNullOrEmpty(key))
                data[key] = val;
        }

        var m = new AnalyticsMetrics
        {
            Platform    = Get(data, "Platform", "platform"),
            PeriodLabel = Get(data, "Kỳ báo cáo", "period_label"),
        };

        if (long.TryParse(Clean(Get(data, "Tổng tiếp cận", "reach")), out var reach)) m.Reach = reach;
        if (long.TryParse(Clean(Get(data, "Lượt hiển thị", "impressions")), out var imp)) m.Impressions = imp;
        if (long.TryParse(Clean(Get(data, "Tổng tương tác", "total_engagement")), out var eng)) m.TotalEngagement = eng;
        if (long.TryParse(Clean(Get(data, "Lượt thích", "likes")), out var lk)) m.Likes = lk;
        if (long.TryParse(Clean(Get(data, "Bình luận", "comments")), out var cm)) m.Comments = cm;
        if (long.TryParse(Clean(Get(data, "Lượt chia sẻ", "shares")), out var sh)) m.Shares = sh;
        if (long.TryParse(Clean(Get(data, "Lượt click", "clicks")), out var cl)) m.Clicks = cl;
        if (long.TryParse(Clean(Get(data, "Người theo dõi mới", "new_followers")), out var nf)) m.NewFollowers = nf;
        if (long.TryParse(Clean(Get(data, "Lượt xem trang cá nhân", "profile_visits")), out var pv)) m.ProfileVisits = pv;
        if (double.TryParse(Clean(Get(data, "Tỉ lệ tương tác (%)", "engagement_rate")), out var er)) m.EngagementRate = er;
        if (double.TryParse(Clean(Get(data, "Tỷ lệ hoàn thành (%)", "completion_rate")), out var cr)) m.CompletionRate = cr;
        if (double.TryParse(Clean(Get(data, "Thời gian xem TB (giây)", "avg_view_duration_seconds")), out var avd)) m.AvgViewDurationSeconds = avd;
        if (double.TryParse(Clean(Get(data, "Tỷ lệ chuyển đổi (%)", "conversion_rate")), out var cvr)) m.ConversionRate = cvr;
        if (double.TryParse(Clean(Get(data, "CTR (%)", "ctr")), out var ctr)) m.ClickThroughRate = ctr;
        if (int.TryParse(Clean(Get(data, "Số bài đăng", "posts_count")), out var pc)) m.PostsCount = pc;

        return m;
    }

    private static string Get(Dictionary<string, string> d, params string[] keys)
    {
        foreach (var k in keys)
            if (d.TryGetValue(k, out var v) && !string.IsNullOrEmpty(v))
                return v;
        return "";
    }

    private static string Clean(string s) => s.Replace(",", "").Replace("%", "").Trim();

    private static string? GetCellValue(Cell cell, SharedStringTable? sst)
    {
        var val = cell.CellValue?.Text;
        if (cell.DataType?.Value == CellValues.SharedString && sst != null && int.TryParse(val, out var idx))
            val = sst.ElementAt(idx).InnerText;
        return val;
    }

    // ── Generate Excel template ───────────────────────────────────────────────
    public byte[] GenerateTemplate()
    {
        using var ms = new MemoryStream();
        using var doc = SpreadsheetDocument.Create(ms, DocumentFormat.OpenXml.SpreadsheetDocumentType.Workbook);

        var wbPart = doc.AddWorkbookPart();
        wbPart.Workbook = new DocumentFormat.OpenXml.Spreadsheet.Workbook();
        var sheets = wbPart.Workbook.AppendChild(new Sheets());

        void AddSheet(string name, string periodHint, uint sheetId)
        {
            var wsPart = wbPart.AddNewPart<WorksheetPart>();
            var sd = new SheetData();
            wsPart.Worksheet = new Worksheet(sd);

            var rows = new[]
            {
                ("Chỉ số", "Giá trị"),                              // header
                ("Platform", "TikTok"),                             // VD: TikTok / Facebook / Instagram / YouTube
                ("Kỳ báo cáo", periodHint),
                ("Tổng tiếp cận", ""),
                ("Lượt hiển thị", ""),
                ("Tổng tương tác", ""),
                ("Lượt thích", ""),
                ("Bình luận", ""),
                ("Lượt chia sẻ", ""),
                ("Lượt click", ""),
                ("Người theo dõi mới", ""),
                ("Lượt xem trang cá nhân", ""),
                ("Tỉ lệ tương tác (%)", ""),
                ("Tỷ lệ hoàn thành (%)", ""),
                ("Thời gian xem TB (giây)", ""),
                ("Tỷ lệ chuyển đổi (%)", ""),
                ("CTR (%)", ""),
                ("Số bài đăng", ""),
            };

            uint rowIdx = 1;
            foreach (var (col1, col2) in rows)
            {
                var row = new Row { RowIndex = rowIdx++ };
                row.Append(CreateCell(col1), CreateCell(col2));
                sd.Append(row);
            }

            var rel = wbPart.GetIdOfPart(wsPart);
            sheets.Append(new Sheet { Id = rel, SheetId = sheetId, Name = name });
        }

        AddSheet("Kỳ này", "VD: Tháng 6/2026", 1);
        AddSheet("Kỳ trước", "VD: Tháng 5/2026", 2);

        wbPart.Workbook.Save();
        doc.Dispose();
        return ms.ToArray();
    }

    private static Cell CreateCell(string value) => new()
    {
        DataType = CellValues.String,
        CellValue = new CellValue(value)
    };

    // ── AI: single ────────────────────────────────────────────────────────────
    private async Task<AnalyticsResult> CallAiSingleAsync(
        AnalyticsMetrics m, CancellationToken ct)
    {
        var prompt = BuildSinglePrompt(m);
        var raw = await SendPromptAsync(prompt, ct);
        var parsed = ParseAiResult(raw, m.Platform, "single", m.PeriodLabel, null);
        if (parsed == null)
        {
            throw new InvalidOperationException("Không thể kết nối AI để phân tích. Vui lòng kiểm tra kết nối và thử lại.");
        }
        return parsed;
    }

    // ── AI: compare ───────────────────────────────────────────────────────────
    private async Task<AnalyticsResult> CallAiCompareAsync(
        AnalyticsMetrics a, AnalyticsMetrics b, CancellationToken ct)
    {
        var prompt = BuildComparePrompt(a, b);
        var raw = await SendPromptAsync(prompt, ct);
        var parsed = ParseAiResult(raw, a.Platform, "compare", a.PeriodLabel, b.PeriodLabel);
        if (parsed == null)
        {
            throw new InvalidOperationException("Không thể kết nối AI để so sánh phân tích. Vui lòng kiểm tra kết nối và thử lại.");
        }
        return parsed;
    }

    private static string GetAnalyticsBaseUrl(string? provider) =>
        provider?.ToLowerInvariant() switch
        {
            "openrouter" => "https://openrouter.ai/api/v1",
            "openai"     => "https://api.openai.com/v1",
            _            => "https://api.groq.com/openai/v1"   // groq + default
        };

    private async Task<string> SendPromptAsync(string prompt, CancellationToken ct)
    {
        if (!_keyPool.HasKeys) return string.Empty;
        var maxAttempts = Math.Max(2, _keyPool.KeyCount);
        int delayMs = 1000;
        for (int attempt = 1; attempt <= maxAttempts; attempt++)
        {
            if (_keyPool.AllKeysInCooldown)
            {
                _logger.LogWarning("Analytics: all keys in cooldown, waiting 3s before retry...");
                // Chờ thêm 3s rồi thử lại 1 lần thay vì bỏ cuộc ngay
                await Task.Delay(3000, ct);
                if (_keyPool.AllKeysInCooldown) return string.Empty;
            }
            try
            {
                var slot = _keyPool.GetNextSlot();
                var baseUrl = GetAnalyticsBaseUrl(slot.Provider);
                var model = slot.ModelOverride ?? _options.Model;

                var body = new
                {
                    model,
                    messages = new[] { new { role = "user", content = prompt } },
                    temperature = 0.4,
                    max_tokens = 3000
                };

                var req = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/chat/completions")
                {
                    Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
                };
                req.Headers.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", slot.Key);

                // OpenRouter yêu cầu thêm header này
                if (slot.Provider?.ToLowerInvariant() == "openrouter")
                {
                    req.Headers.TryAddWithoutValidation("HTTP-Referer", "https://socialsense.app");
                    req.Headers.TryAddWithoutValidation("X-Title", "SocialSense");
                }

                using var resp = await _client.SendAsync(req, ct);

                if (resp.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    _keyPool.MarkRateLimited(slot.Key, TimeSpan.FromMinutes(5));
                    _logger.LogWarning("Analytics: key 401, rotating. Attempt {A}/{M}", attempt, maxAttempts);
                    if (attempt < maxAttempts) { await Task.Delay(500, ct); continue; }
                    return string.Empty;
                }

                if ((int)resp.StatusCode == 429)
                {
                    // Giảm cooldown xuống 20s — free tier thường reset nhanh
                    _keyPool.MarkRateLimited(slot.Key, TimeSpan.FromSeconds(20));
                    _logger.LogWarning("Analytics: key 429, cooldown 20s. Attempt {A}/{M}", attempt, maxAttempts);
                    if (attempt < maxAttempts) { await Task.Delay(delayMs, ct); delayMs = Math.Min(delayMs * 2, 5000); continue; }
                    return string.Empty;
                }

                if (!resp.IsSuccessStatusCode)
                {
                    var err = await resp.Content.ReadAsStringAsync(ct);
                    _logger.LogWarning("Analytics AI failed: {Status} — {Body}. Key: {Label}. Rotating...", resp.StatusCode, err, slot.Label);
                    if (attempt < maxAttempts) { await Task.Delay(200, ct); continue; }
                    return string.Empty;
                }

                await using var stream = await resp.Content.ReadAsStreamAsync(ct);
                using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
                if (doc.RootElement.TryGetProperty("choices", out var choices) &&
                    choices.GetArrayLength() > 0 &&
                    choices[0].TryGetProperty("message", out var msg) &&
                    msg.TryGetProperty("content", out var content))
                    return content.GetString() ?? string.Empty;

                return string.Empty;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Analytics AI call error attempt {A}", attempt);
                if (attempt < maxAttempts) { await Task.Delay(delayMs, ct); delayMs = Math.Min(delayMs * 2, 5000); }
            }
        }
        return string.Empty;
    }

    private static string BuildSinglePrompt(AnalyticsMetrics m)
    {
        var metricsStr = FormatMetrics(m);
        return $@"Bạn là chuyên gia phân tích mạng xã hội. Phân tích số liệu analytics sau và giải thích dễ hiểu cho người mới bắt đầu làm content.
Return ONLY raw JSON — no markdown, no explanation.

Platform: {m.Platform}
Kỳ báo cáo: {m.PeriodLabel}

Số liệu:
{metricsStr}

QUAN TRỌNG về simpleExplain — phải viết theo nguyên tắc sau:
- Dùng ngôn ngữ đời thường, TRÁNH thuật ngữ kỹ thuật
- Giải thích CHỈ SỐ ĐÓ LÀ GÌ trước (1-2 từ), rồi mới nói ý nghĩa con số
- Với chỉ số %: luôn dùng ví dụ cụ thể để so sánh
  VD engagementRate 5%: Cứ 100 người xem bài, có 5 người thích/bình luận/chia sẻ — tỉ lệ này được gọi là tương tác
  VD completionRate 70%: 70 trên 100 người xem video của bạn đến hết — con số này cho thấy nội dung đủ hấp dẫn giữ người xem
  VD CTR 3%: Cứ 100 người thấy bài, có 3 người bấm vào link — đây là tỉ lệ nhấp vào nội dung của bạn
  VD conversionRate 2%: Cứ 100 người xem, có 2 người thực hiện hành động bạn muốn (mua hàng, đăng ký...)
- Với chỉ số số lượng: nói đơn giản con số đó nghĩa là gì
  VD reach 50000: 50.000 người đã thấy bài đăng của bạn xuất hiện trên feed của họ

Trả về JSON theo đúng schema sau:
{{
  ""metrics"": [
    {{
      ""metricKey"": ""reach"",
      ""metricName"": ""Tổng tiếp cận"",
      ""valueAFormatted"": ""482,300"",
      ""valueBFormatted"": null,
      ""changePercent"": null,
      ""status"": ""good"",
      ""simpleExplain"": ""Giải thích theo nguyên tắc trên — bắt buộc dùng ngôn ngữ đời thường"",
      ""detail"": ""Phân tích chuyên sâu 2-3 câu, so sánh với benchmark ngành"",
      ""higherIsBetter"": true
    }}
  ],
  ""summary"": {{
    ""highlights"": [""Điểm tốt 1"", ""Điểm tốt 2""],
    ""warnings"": [""Điểm cần cải thiện 1""],
    ""overallScore"": 75,
    ""overallTrend"": ""growing"",
    ""topRecommendation"": ""Gợi ý hành động cụ thể nhất""
  }},
  ""aiNarrative"": ""Đoạn văn tổng kết tự nhiên tiếng Việt 3-4 câu, dùng ngôn ngữ đơn giản như đang nói chuyện với người mới""
}}

Quy tắc status: good (số tốt), warning (cần chú ý), critical (đáng lo ngại), neutral (không đánh giá được).
Với single report: changePercent = null, valueBFormatted = null.
Chỉ phân tích các metrics có dữ liệu (giá trị != null/0).
overallScore từ 0-100 dựa trên benchmark ngành {m.Platform}.
overallTrend: growing / declining / stable.";
    }

    private static string BuildComparePrompt(AnalyticsMetrics a, AnalyticsMetrics b)
    {
        var metricsA = FormatMetrics(a);
        var metricsB = FormatMetrics(b);
        return $@"Bạn là chuyên gia phân tích mạng xã hội. So sánh 2 kỳ analytics và giải thích dễ hiểu cho người mới làm content.
Return ONLY raw JSON — no markdown, no explanation.

Platform: {a.Platform}
Kỳ A (kỳ này): {a.PeriodLabel}
Kỳ B (kỳ trước): {b.PeriodLabel}

Số liệu Kỳ A:
{metricsA}

Số liệu Kỳ B:
{metricsB}

QUAN TRỌNG về simpleExplain — phải viết theo nguyên tắc sau:
- Dùng ngôn ngữ đời thường, TRÁNH thuật ngữ kỹ thuật
- Giải thích CHỈ SỐ ĐÓ LÀ GÌ (rất ngắn), rồi nói kết quả so sánh bằng con số cụ thể
- Với chỉ số %: giải thích ý nghĩa bằng ví dụ cứ 100 người...
  VD engagementRate tăng từ 3% lên 5%: Tỉ lệ người xem có tương tác tăng từ 3 lên 5 người trên 100 — tức là nội dung hấp dẫn hơn kỳ trước
  VD completionRate giảm: Tỉ lệ xem hết video giảm — nghĩa là người xem đang bỏ video sớm hơn kỳ trước
  VD CTR: Tỉ lệ người bấm vào link trong bài tăng/giảm X% — nghĩa là CTA của bạn đang hiệu quả hơn/kém hơn
- Với chỉ số số lượng: dùng con số thực để so sánh
  VD reach tăng: Số người thấy bài tăng thêm X người (+Y%) so với kỳ trước
- LUÔN kết thúc bằng hàm ý: tốt hay chưa tốt, cần làm gì

Trả về JSON theo đúng schema sau:
{{
  ""metrics"": [
    {{
      ""metricKey"": ""reach"",
      ""metricName"": ""Tổng tiếp cận"",
      ""valueAFormatted"": ""482,300"",
      ""valueBFormatted"": ""419,000"",
      ""changePercent"": 15.2,
      ""status"": ""good"",
      ""simpleExplain"": ""Giải thích theo nguyên tắc trên — bắt buộc dùng ngôn ngữ đời thường"",
      ""detail"": ""Phân tích chuyên sâu 2-3 câu tại sao tăng/giảm và ảnh hưởng thế nào, so với benchmark ngành"",
      ""higherIsBetter"": true
    }}
  ],
  ""summary"": {{
    ""highlights"": [""Điểm sáng 1"", ""Điểm sáng 2""],
    ""warnings"": [""Điểm cần chú ý 1""],
    ""overallScore"": 78,
    ""overallTrend"": ""growing"",
    ""topRecommendation"": ""Gợi ý hành động ưu tiên nhất dựa trên số liệu, viết như đang tư vấn cho người mới""
  }},
  ""aiNarrative"": ""Đoạn tường thuật 4-5 câu tiếng Việt đơn giản, như đang kể chuyện cho người mới: kỳ này như thế nào, so với kỳ trước ra sao, điều gì đáng mừng, điều gì cần chú ý""
}}

Quy tắc:
- status: good (cải thiện tốt), warning (giảm nhẹ/cần chú ý), critical (giảm mạnh), neutral (không đổi/không đánh giá được)
- Tính changePercent chính xác: ((A - B) / B) * 100
- So sánh với benchmark ngành {a.Platform}: Engagement Rate trung bình TikTok ~5-10%, Facebook ~1-3%, Instagram ~3-6%, YouTube ~2-5%
- Completion Rate trung bình TikTok ~60-70%, YouTube ~40-50%
- overallScore 0-100 đánh giá tổng thể kỳ A so với kỳ B và benchmark ngành
- Chỉ đưa vào metrics array các chỉ số có đủ dữ liệu cả 2 kỳ";
    }

    private static string FormatMetrics(AnalyticsMetrics m)
    {
        var sb = new StringBuilder();
        if (m.Reach.HasValue) sb.AppendLine($"Tổng tiếp cận: {m.Reach:N0}");
        if (m.Impressions.HasValue) sb.AppendLine($"Lượt hiển thị: {m.Impressions:N0}");
        if (m.TotalEngagement.HasValue) sb.AppendLine($"Tổng tương tác: {m.TotalEngagement:N0}");
        if (m.Likes.HasValue) sb.AppendLine($"Lượt thích: {m.Likes:N0}");
        if (m.Comments.HasValue) sb.AppendLine($"Bình luận: {m.Comments:N0}");
        if (m.Shares.HasValue) sb.AppendLine($"Lượt chia sẻ: {m.Shares:N0}");
        if (m.Clicks.HasValue) sb.AppendLine($"Lượt click: {m.Clicks:N0}");
        if (m.NewFollowers.HasValue) sb.AppendLine($"Người theo dõi mới: {m.NewFollowers:N0}");
        if (m.ProfileVisits.HasValue) sb.AppendLine($"Lượt xem trang cá nhân: {m.ProfileVisits:N0}");
        if (m.EngagementRate.HasValue) sb.AppendLine($"Tỉ lệ tương tác: {m.EngagementRate}%");
        if (m.CompletionRate.HasValue) sb.AppendLine($"Tỷ lệ hoàn thành: {m.CompletionRate}%");
        if (m.AvgViewDurationSeconds.HasValue) sb.AppendLine($"Thời gian xem TB: {m.AvgViewDurationSeconds}s");
        if (m.ConversionRate.HasValue) sb.AppendLine($"Tỷ lệ chuyển đổi: {m.ConversionRate}%");
        if (m.ClickThroughRate.HasValue) sb.AppendLine($"CTR: {m.ClickThroughRate}%");
        if (m.PostsCount.HasValue) sb.AppendLine($"Số bài đăng: {m.PostsCount}");
        return sb.ToString();
    }

    private AnalyticsResult? ParseAiResult(
        string raw, string platform, string reportType,
        string periodALabel, string? periodBLabel)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        try
        {
            // Strip code fence
            var cleaned = raw.Trim();
            var fence = System.Text.RegularExpressions.Regex.Match(
                cleaned, @"```(?:json)?\s*(.*?)\s*```",
                System.Text.RegularExpressions.RegexOptions.Singleline);
            if (fence.Success) cleaned = fence.Groups[1].Value.Trim();
            var brace = cleaned.IndexOf('{');
            var lastBrace = cleaned.LastIndexOf('}');
            if (brace >= 0 && lastBrace > brace) cleaned = cleaned[brace..(lastBrace + 1)];

            using var doc = JsonDocument.Parse(cleaned);
            var root = doc.RootElement;

            var metrics = new List<MetricComparison>();
            if (root.TryGetProperty("metrics", out var metricsEl))
            {
                foreach (var m in metricsEl.EnumerateArray())
                {
                    metrics.Add(new MetricComparison
                    {
                        MetricKey      = m.TryGetProperty("metricKey", out var mk) ? mk.GetString() ?? "" : "",
                        MetricName     = m.TryGetProperty("metricName", out var mn) ? mn.GetString() ?? "" : "",
                        ValueAFormatted= m.TryGetProperty("valueAFormatted", out var va) ? va.GetString() : null,
                        ValueBFormatted= m.TryGetProperty("valueBFormatted", out var vb) ? vb.GetString() : null,
                        ChangePercent  = m.TryGetProperty("changePercent", out var cp) && cp.ValueKind != JsonValueKind.Null
                                          ? cp.GetDouble() : null,
                        Status         = m.TryGetProperty("status", out var st) ? st.GetString() ?? "neutral" : "neutral",
                        SimpleExplain  = m.TryGetProperty("simpleExplain", out var se) ? se.GetString() ?? "" : "",
                        Detail         = m.TryGetProperty("detail", out var dt) ? dt.GetString() ?? "" : "",
                        HigherIsBetter = !m.TryGetProperty("higherIsBetter", out var hib) || hib.GetBoolean()
                    });
                }
            }

            AnalyticsSummary summary = new();
            if (root.TryGetProperty("summary", out var sumEl))
            {
                summary.Highlights = sumEl.TryGetProperty("highlights", out var hl)
                    ? hl.EnumerateArray().Select(x => x.GetString() ?? "").Where(s => s.Length > 0).ToList()
                    : new();
                summary.Warnings = sumEl.TryGetProperty("warnings", out var wn)
                    ? wn.EnumerateArray().Select(x => x.GetString() ?? "").Where(s => s.Length > 0).ToList()
                    : new();
                summary.OverallScore = sumEl.TryGetProperty("overallScore", out var os) ? os.GetInt32() : 50;
                summary.OverallTrend = sumEl.TryGetProperty("overallTrend", out var ot) ? ot.GetString() ?? "stable" : "stable";
                summary.TopRecommendation = sumEl.TryGetProperty("topRecommendation", out var tr) ? tr.GetString() ?? "" : "";
            }

            var narrative = root.TryGetProperty("aiNarrative", out var narEl) ? narEl.GetString() ?? "" : "";

            return new AnalyticsResult
            {
                Platform = platform,
                ReportType = reportType,
                PeriodALabel = periodALabel,
                PeriodBLabel = periodBLabel,
                Metrics = metrics,
                Summary = summary,
                AiNarrative = narrative
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse analytics AI result. Raw: {Raw}", raw.Length > 200 ? raw[..200] : raw);
            return null;
        }
    }

    // ── Fallbacks ─────────────────────────────────────────────────────────────
    private static AnalyticsResult BuildFallbackSingle(AnalyticsMetrics m) => new()
    {
        Platform = m.Platform,
        ReportType = "single",
        PeriodALabel = m.PeriodLabel,
        Metrics = new(),
        Summary = new() { OverallScore = 50, OverallTrend = "stable", TopRecommendation = "Không thể phân tích tự động. Vui lòng thử lại." },
        AiNarrative = "Không thể kết nối AI để phân tích. Vui lòng kiểm tra kết nối và thử lại."
    };

    private static AnalyticsResult BuildFallbackCompare(AnalyticsMetrics a, AnalyticsMetrics b)
    {
        var metrics = new List<MetricComparison>();

        // Map chi tiết giải thích cho từng chỉ số
        var detailMap = new Dictionary<string, string>
        {
            ["reach"]           = "Tổng tiếp cận là số người đã thấy bài của bạn xuất hiện trên feed. Con số này phụ thuộc nhiều vào thuật toán — đăng đúng giờ cao điểm và dùng hashtag phù hợp sẽ giúp tăng reach.",
            ["totalEngagement"] = "Tổng tương tác gồm: thích + bình luận + chia sẻ + lưu. Con số này cho thấy nội dung của bạn có khiến người xem hành động không — đây là chỉ số quan trọng để thuật toán đẩy bài.",
            ["newFollowers"]    = "Người theo dõi mới là số người chọn xem nội dung của bạn thường xuyên hơn. Follower tăng đều nghĩa là nội dung đủ hấp dẫn để giữ người xem quay lại.",
            ["engagementRate"]  = "Tỉ lệ tương tác = (tổng tương tác / tổng tiếp cận) × 100. Benchmark TikTok ~5-10%, Facebook ~1-3%, Instagram ~3-6%. Nếu thấp hơn benchmark, thử thêm câu hỏi hoặc CTA kêu gọi tương tác trong bài.",
            ["completionRate"]  = "Tỷ lệ hoàn thành là % người xem hết video. Benchmark TikTok ~60-70%, YouTube ~40-50%. Nếu thấp, thử rút ngắn video hoặc đặt hook mạnh hơn ở đầu 3 giây.",
            ["conversionRate"]  = "Tỷ lệ chuyển đổi là % người xem thực hiện hành động bạn muốn (click link, mua hàng, đăng ký). Nếu thấp, thử làm rõ CTA hơn hoặc đặt link dễ thấy hơn trong bio.",
        };

        void Add(string key, string name, double? va, double? vb, bool hib = true)
        {
            if (va == null || vb == null) return;
            var change = vb != 0 ? Math.Round((va.Value - vb.Value) / Math.Abs(vb.Value) * 100, 1) : 0;
            var good = hib ? change >= 0 : change <= 0;
            var simpleExplain = good
                ? $"{name} tăng thêm {Math.Abs(change):F1}% so với kỳ trước — kết quả tốt, tiếp tục duy trì"
                : $"{name} giảm {Math.Abs(change):F1}% so với kỳ trước — cần xem lại chiến lược nội dung";

            metrics.Add(new MetricComparison
            {
                MetricKey = key, MetricName = name,
                ValueAFormatted = FormatVal(va.Value, key),
                ValueBFormatted = FormatVal(vb.Value, key),
                ChangePercent = change,
                Status = good ? "good" : "warning",
                SimpleExplain = simpleExplain,
                Detail = detailMap.TryGetValue(key, out var d) ? d : "",
                HigherIsBetter = hib
            });
        }

        Add("reach",           "Tổng tiếp cận",        a.Reach,           b.Reach);
        Add("totalEngagement", "Tổng tương tác",        a.TotalEngagement, b.TotalEngagement);
        Add("newFollowers",    "Người theo dõi mới",    a.NewFollowers,    b.NewFollowers);
        Add("engagementRate",  "Tỉ lệ tương tác (%)",  a.EngagementRate,  b.EngagementRate);
        Add("completionRate",  "Tỷ lệ hoàn thành (%)", a.CompletionRate,  b.CompletionRate);
        Add("conversionRate",  "Tỷ lệ chuyển đổi (%)", a.ConversionRate,  b.ConversionRate);

        var growCount = metrics.Count(m => m.Status == "good");
        var score = metrics.Count > 0 ? (int)(growCount * 100.0 / metrics.Count) : 50;
        return new AnalyticsResult
        {
            Platform = a.Platform, ReportType = "compare",
            PeriodALabel = a.PeriodLabel, PeriodBLabel = b.PeriodLabel,
            Metrics = metrics,
            Summary = new()
            {
                OverallScore = score,
                OverallTrend = score >= 60 ? "growing" : score >= 40 ? "stable" : "declining",
                Highlights = metrics.Where(m => m.Status == "good").Select(m => m.SimpleExplain).Take(3).ToList(),
                Warnings = metrics.Where(m => m.Status is "warning" or "critical").Select(m => m.SimpleExplain).Take(3).ToList(),
                TopRecommendation = "Xem chi tiết từng chỉ số (bấm vào mũi tên) để hiểu sâu hơn và có gợi ý cải thiện."
            },
            AiNarrative = "Phân tích cơ bản dựa trên số liệu. AI chi tiết không khả dụng lúc này — vui lòng thử lại sau."
        };
    }

    private static string FormatVal(double v, string key) =>
        key.EndsWith("Rate") || key == "completionRate" || key == "conversionRate" || key == "clickThroughRate"
            ? $"{v:F1}%"
            : key == "avgViewDurationSeconds"
                ? $"{(int)(v / 60)}:{(int)(v % 60):D2}"
                : $"{v:N0}";

    // ── History ───────────────────────────────────────────────────────────────
    public async Task<List<AnalyticsHistoryItem>> GetHistoryAsync(
        int userId, int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var items = await _db.AnalyticsReports
            .AsNoTracking()
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return items.Select(r =>
        {
            var trend = "stable";
            try
            {
                var res = JsonSerializer.Deserialize<AnalyticsResult>(r.ResultJson, _jsonOpts);
                trend = res?.Summary.OverallTrend ?? "stable";
            }
            catch { }
            return new AnalyticsHistoryItem
            {
                Id = r.Id, Platform = r.Platform, ReportType = r.ReportType,
                PeriodALabel = r.PeriodALabel, PeriodBLabel = r.PeriodBLabel,
                OverallScore = r.OverallScore, OverallTrend = trend,
                CreatedAt = r.CreatedAt
            };
        }).ToList();
    }

    public async Task<AnalyticsReportResponse?> GetReportAsync(int userId, int reportId, CancellationToken ct)
    {
        var report = await _db.AnalyticsReports.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == reportId && r.UserId == userId, ct);
        if (report == null) return null;
        var result = JsonSerializer.Deserialize<AnalyticsResult>(report.ResultJson, _jsonOpts);
        return result == null ? null : MapToResponse(report, result);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private static AnalyticsReportResponse MapToResponse(AnalyticsReport r, AnalyticsResult result) => new()
    {
        Id = r.Id, Platform = r.Platform, ReportType = r.ReportType,
        PeriodALabel = r.PeriodALabel, PeriodBLabel = r.PeriodBLabel,
        Result = result, CreatedAt = r.CreatedAt
    };

    private async Task DeductQuotaAsync(int userId, CancellationToken ct)
    {
        try
        {
            await _db.Database.ExecuteSqlRawAsync(
                "UPDATE Users SET RemainingQuota = RemainingQuota - 1 WHERE Id = {0} AND RemainingQuota > 0 AND DailyQuotaLimit != -1",
                new object[] { userId }, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deduct quota for user {UserId}", userId);
        }
    }
}
