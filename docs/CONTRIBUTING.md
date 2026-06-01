# SocialSense BE — Hướng dẫn cho thành viên đội BE

---

## 1. Yêu cầu môi trường

| Tool | Version | Link |
|------|---------|------|
| .NET SDK | **8.0+** | https://dotnet.microsoft.com/download |
| Git | Bất kỳ | https://git-scm.com |
| IDE | VS Code hoặc Visual Studio 2022 | |
| MySQL (local, tùy chọn) | 8.0+ | Hoặc dùng thẳng TiDB Cloud |

Kiểm tra đã cài đúng:
```bash
dotnet --version   # phải ra 8.x.x
git --version
```

---

## 2. Clone và setup lần đầu

```bash
# 1. Clone repo
git clone https://github.com/khoa025ne/social-sense-BE.git
cd social-sense-BE

# 2. Tạo file secrets local (KHÔNG commit file này)
# Copy nội dung bên dưới vào src/appsettings.Development.json
```

Tạo file `src/appsettings.Development.json` với nội dung sau
(xin thông tin từ team lead để điền vào):

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "SocialSense.Services.ContentGeneratorService": "Debug"
    }
  },
  "ConnectionStrings": {
    "Default": "<<XIN TỪ TEAM LEAD>>"
  },
  "AiProviderKeys": [
    {
      "label": "OpenRouter-Key1",
      "keyValue": "<<XIN TỪ TEAM LEAD>>",
      "provider": "openrouter",
      "modelOverride": "meta-llama/llama-4-scout"
    }
  ],
  "Jwt": {
    "Secret": "<<XIN TỪ TEAM LEAD>>"
  },
  "ApiKeyEncryption": {
    "Secret": "<<XIN TỪ TEAM LEAD>>"
  },
  "PayOs": {
    "ClientId":    "<<XIN TỪ TEAM LEAD>>",
    "ApiKey":      "<<XIN TỪ TEAM LEAD>>",
    "ChecksumKey": "<<XIN TỪ TEAM LEAD>>"
  },
  "Smtp": {
    "Password": "<<XIN TỪ TEAM LEAD>>"
  }
}
```

```bash
# 3. Restore packages
cd src
dotnet restore

# 4. Chạy app
dotnet run
# → App chạy tại http://localhost:5280
# → Swagger UI: http://localhost:5280/swagger
# → Migration và seed tự động khi startup
```

---

## 3. Quy trình làm việc (Git Flow)

```
master (production)
    │
    └── feature/ten-tinh-nang    ← mỗi người làm 1 branch
    └── fix/ten-bug
    └── hotfix/ten-loi-khan-cap
```

### Bắt đầu task mới

```bash
# Luôn pull master mới nhất trước
git checkout master
git pull origin master

# Tạo branch mới từ master
git checkout -b feature/ten-tinh-nang
# Ví dụ: feature/add-content-schedule
#         fix/image-prompt-encoding
#         hotfix/quota-reset-bug
```

### Trong lúc làm

```bash
# Commit thường xuyên, message rõ ràng
git add src/Controllers/NewController.cs src/Services/NewService.cs
git commit -m "feat: add content schedule endpoint"

# Push branch lên remote
git push -u origin feature/ten-tinh-nang
```

### Hoàn thành — tạo Pull Request

```bash
# Đảm bảo build pass trước khi tạo PR
dotnet build

# Push lần cuối
git push

# Vào GitHub → tạo Pull Request từ branch của bạn → master
# Assign cho team lead review
```

> ⚠️ **KHÔNG push thẳng lên `master`** — phải qua Pull Request

---

## 4. Cấu trúc project

```
src/
├── Controllers/        ← API endpoints (HTTP layer)
├── Services/           ← Business logic
├── Models/             ← Database entities (EF Core)
├── DTOs/               ← Request/Response objects
├── Data/               ← DbContext, migrations
├── Configuration/      ← Options classes (bind từ appsettings)
├── Filters/            ← Action filters (QuotaCheckFilter)
├── Migrations/         ← EF Core migrations (auto-generated)
├── appsettings.json    ← Config mặc định (không có secrets)
└── Program.cs          ← App startup, DI registration

docs/
├── API_REFERENCE.md    ← Tài liệu API đầy đủ cho FE
├── CONTRIBUTING.md     ← File này
├── plan_deploy_BE.md   ← Hướng dẫn deploy
└── info_FE.md          ← Thông tin cho đội FE
```

---

## 5. Thêm tính năng mới — checklist

### Thêm endpoint mới

- [ ] Tạo DTO trong `src/DTOs/`
- [ ] Thêm method vào Controller hoặc tạo Controller mới
- [ ] Thêm Service interface + implementation nếu cần
- [ ] Đăng ký Service trong `Program.cs` nếu mới
- [ ] Build và test local
- [ ] Cập nhật `docs/API_REFERENCE.md`

### Thêm bảng DB mới

```bash
# 1. Tạo Model trong src/Models/
# 2. Thêm DbSet vào src/Data/AppDbContext.cs
# 3. Tạo migration
dotnet ef migrations add TenMigration

# 4. Apply migration local
dotnet ef database update

# 5. Commit cả file migration
git add src/Migrations/
```

> Migration sẽ tự chạy trên production khi deploy (MigrateAsync trong Program.cs)

---

## 6. Conventions

### Naming

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Controller | PascalCase + Controller | `ContentController` |
| Service interface | I + PascalCase + Service | `IEmailService` |
| Service class | PascalCase + Service | `SmtpEmailService` |
| DTO Request | PascalCase + Request | `GenerateContentRequest` |
| DTO Response | PascalCase + Response | `GenerateContentResponse` |
| Model | PascalCase | `ContentHistory` |
| Migration | PascalCase mô tả | `AddPasswordResetOtp` |

### Commit message format

```
feat: thêm tính năng mới
fix: sửa bug
chore: thay đổi config, deps, không ảnh hưởng logic
docs: cập nhật tài liệu
refactor: refactor code, không thêm tính năng
```

---

## 7. Môi trường và URLs

| Môi trường | URL | Ghi chú |
|-----------|-----|---------|
| Local | `http://localhost:5280` | `dotnet run` |
| Local Swagger | `http://localhost:5280/swagger` | |
| Production | `https://social-sense-be.onrender.com` | Auto-deploy khi push master |
| Production Swagger | `https://social-sense-be.onrender.com/swagger` | |

---

## 8. Tài khoản test

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@socialsense.vn` | `Password123!` |
| User Pro | `user1@socialsense.vn` | `Password123!` |
| User Free | `user3@socialsense.vn` | `Password123!` |

---

## 9. Lưu ý quan trọng

### ❌ KHÔNG làm

- Push thẳng lên `master`
- Commit `appsettings.Development.json` hoặc `secrets.json`
- Hardcode secrets trong code
- Xóa hoặc sửa migration đã chạy trên production

### ✅ NÊN làm

- Tạo branch riêng cho mỗi task
- Build pass trước khi tạo PR
- Viết commit message rõ ràng
- Cập nhật `API_REFERENCE.md` khi thêm/sửa endpoint
- Test trên Swagger local trước khi push

### Khi cần thêm secret mới

1. Thêm vào `appsettings.Development.json` local (không commit)
2. Thêm vào `docs/render.env` (không commit)
3. Set trên Render Dashboard → Environment Variables
4. Thông báo cho team lead để update

---

## 10. Liên hệ & hỗ trợ

- **Repo:** https://github.com/khoa025ne/social-sense-BE
- **API Docs:** `docs/API_REFERENCE.md`
- **Deploy Guide:** `docs/plan_deploy_BE.md`
