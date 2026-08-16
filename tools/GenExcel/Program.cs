using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;

static void CreateFile(string path, string platform,
    string labelA, (string key, string val)[] dataA,
    string labelB, (string key, string val)[] dataB)
{
    Directory.CreateDirectory(Path.GetDirectoryName(path)!);
    using var ms = new MemoryStream();
    using (var doc = SpreadsheetDocument.Create(ms, SpreadsheetDocumentType.Workbook))
    {
        var wbPart = doc.AddWorkbookPart();
        wbPart.Workbook = new Workbook();
        var sheets = wbPart.Workbook.AppendChild(new Sheets());

        void AddSheet(string name, uint id, string lbl, (string, string)[] rows)
        {
            var wsPart = wbPart.AddNewPart<WorksheetPart>();
            var sd = new SheetData();
            wsPart.Worksheet = new Worksheet(sd);
            var allRows = new List<(string, string)>
            {
                ("Chỉ số", "Giá trị"),
                ("Platform", platform),
                ("Kỳ báo cáo", lbl),
            };
            allRows.AddRange(rows);
            uint ri = 1;
            foreach (var (c1, c2) in allRows)
            {
                var row = new Row { RowIndex = ri++ };
                row.Append(
                    new Cell { DataType = CellValues.String, CellValue = new CellValue(c1) },
                    new Cell { DataType = CellValues.String, CellValue = new CellValue(c2) });
                sd.Append(row);
            }
            sheets.Append(new Sheet { Id = wbPart.GetIdOfPart(wsPart), SheetId = id, Name = name });
        }

        AddSheet("Kỳ này",   1, labelA, dataA);
        AddSheet("Kỳ trước", 2, labelB, dataB);
        wbPart.Workbook.Save();
    }
    File.WriteAllBytes(path, ms.ToArray());
    Console.WriteLine($"✅ {path} ({new FileInfo(path).Length} bytes)");
}

// TikTok
CreateFile(@"C:\Temp\analytics_tiktok_test.xlsx", "TikTok",
    "Thang6_2026", new (string, string)[]
    {
        ("Tổng tiếp cận","482300"), ("Lượt hiển thị","610000"),
        ("Tổng tương tác","89700"), ("Lượt thích","71760"),
        ("Bình luận","8970"), ("Lượt chia sẻ","4485"),
        ("Lượt click","14352"), ("Người theo dõi mới","2340"),
        ("Lượt xem trang cá nhân","9646"), ("Tỉ lệ tương tác (%)","18.6"),
        ("Tỷ lệ hoàn thành (%)","72.4"), ("Thời gian xem TB (giây)","108"),
        ("Tỷ lệ chuyển đổi (%)","3.2"), ("CTR (%)","2.9"), ("Số bài đăng","28"),
    },
    "Thang5_2026", new (string, string)[]
    {
        ("Tổng tiếp cận","419000"), ("Lượt hiển thị","530000"),
        ("Tổng tương tác","82500"), ("Lượt thích","66000"),
        ("Bình luận","8250"), ("Lượt chia sẻ","4125"),
        ("Lượt click","12570"), ("Người theo dõi mới","1910"),
        ("Lượt xem trang cá nhân","8200"), ("Tỉ lệ tương tác (%)","18.9"),
        ("Tỷ lệ hoàn thành (%)","69.4"), ("Thời gian xem TB (giây)","96"),
        ("Tỷ lệ chuyển đổi (%)","3.5"), ("CTR (%)","2.6"), ("Số bài đăng","25"),
    });

// Facebook
CreateFile(@"C:\Temp\analytics_facebook_test.xlsx", "Facebook",
    "Thang6_2026", new (string, string)[]
    {
        ("Tổng tiếp cận","95400"), ("Lượt hiển thị","142000"),
        ("Tổng tương tác","2862"), ("Lượt thích","2100"),
        ("Bình luận","480"), ("Lượt chia sẻ","282"),
        ("Lượt click","1430"), ("Người theo dõi mới","320"),
        ("Tỉ lệ tương tác (%)","3.0"), ("Tỷ lệ chuyển đổi (%)","1.8"),
        ("CTR (%)","1.5"), ("Số bài đăng","18"),
    },
    "Thang5_2026", new (string, string)[]
    {
        ("Tổng tiếp cận","78200"), ("Lượt hiển thị","115000"),
        ("Tổng tương tác","2190"), ("Lượt thích","1650"),
        ("Bình luận","380"), ("Lượt chia sẻ","160"),
        ("Lượt click","1100"), ("Người theo dõi mới","245"),
        ("Tỉ lệ tương tác (%)","2.8"), ("Tỷ lệ chuyển đổi (%)","2.1"),
        ("CTR (%)","1.4"), ("Số bài đăng","15"),
    });

Console.WriteLine("Done!");
