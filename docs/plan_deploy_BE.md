# SocialSense BE — Kế hoạch Deploy lên Render

> **Target:** Render.com (Web Service + MySQL database)
> **Stack:** ASP.NET Core 8, MySQL 8, Entity Framework Core
> **Repo:** https://github.com/khoa025ne/social-sense-BE

---

## Mục lục

1. [Tổng quan kiến trúc deploy](#1-tổng-quan-kiến-trúc-deploy)
2. [Chuẩn bị trước khi deploy](#2-chuẩn-bị-trước-khi-deploy)
3. [Tạo MySQL database trên Render](#3-tạo-mysql-database-trên-render)
4. [Tạo Web Service trên Render](#4-tạo-web-service-trên-render)
5. [Cấu hình Environment Variables](#5-cấu-hình-environment-variables)
6. [Sửa code cho production](#6-sửa-code-cho-production)
7. [Kiểm tra sau deploy](#7-kiểm-tra-sau-deploy)
8. [Cập nhật PayOS webhook URL](#8-cập-nhật-payos-webhook-url)
9. [Lưu ý bảo mật](#9-lưu-ý-bảo-mật)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Tổng quan kiến trúc deploy

```
Internet
    │
    ▼
Render Web Service (ASP.NET Core 8)
    │  URL: https://socialsense-be.onrender.com
    │
    ├── Render MySQL (hoặc PlanetScale / Railway MySQL)
    │   Database: socialsense
    │
    ├── Gmail SMTP (email OTP + welcome)
    │
    ├── OpenRouter / Groq API (AI content)
    │
    ├── Pollinations.ai (image generation)
    │
    └── PayOS (payment webhook)
```

> ⚠️ **Render free tier:** Web Service ngủ sau 15 phút không có request → cold start ~30 giây.
> Render **không có MySQL free tier** — cần dùng PlanetScale (free) hoặc Railway MySQL ($5/tháng).

---

## 2. Chuẩn bị trước khi deploy

### 2.1 Fix .gitignore — appsettings.json đang bị ignore

Hiện tại `src/appsettings.json` bị gitignore nên Render không có file config.
Có 2 cách xử lý:

**Cách A (khuyến nghị): Dùng Environment Variables trên Render**
→ Giữ nguyên gitignore, tất cả secrets inject qua env vars.
→ Xem mục 5 để biết danh sách env vars cần set.

**Cách B: Tạo appsettings.Production.json**
→ Tạo file `src/appsettings.Production.json` với giá trị placeholder (không có secrets).
→ Secrets inject qua env vars override.

**→ Chọn Cách A** — an toàn hơn, không risk commit secrets.

### 2.2 Tạo Dockerfile (Render hỗ trợ Docker)

Tạo file `Dockerfile` ở root của repo:

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/SocialSense.csproj", "src/"]
RUN dotnet restore "src/SocialSense.csproj"
COPY src/ src/
WORKDIR "/src/src"
RUN dotnet build "SocialSense.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "SocialSense.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "SocialSense.dll"]
```

### 2.3 Tạo appsettings.Production.json (placeholder, không có secrets)

Tạo file `src/appsettings.Production.json`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Warning",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

Thêm vào `.gitignore` — **KHÔNG** ignore file này (nó chỉ có placeholder):
```
# Xóa dòng này nếu có trong .gitignore:
# src/appsettings.Production.json
```

### 2.4 Sửa Program.cs — load appsettings.json từ env var

Thêm đoạn này vào đầu `Program.cs` để load secrets từ environment:

```csharp
// Render inject secrets qua environment variables
// ASP.NET Core tự map ConnectionStrings__Default → ConnectionStrings:Default
// Không cần sửa gì thêm — chỉ cần set đúng env vars trên Render
```

ASP.NET Core tự động đọc environment variables với format:
- `ConnectionStrings__Default` → `ConnectionStrings:Default`
- `Jwt__Secret` → `Jwt:Secret`
- `Smtp__Password` → `Smtp:Password`

---

## 3. Tạo MySQL database trên Render

> Render không có MySQL free tier. Dùng **PlanetScale** (free) hoặc **Railway** ($5/tháng).

### Option A: PlanetScale (Khuyến nghị — Free)

1. Vào https://planetscale.com → Sign up
2. Create database → Chọn region **Singapore** (gần VN nhất)
3. Create branch `main`
4. Connect → chọn **Connect with: .NET** → copy connection string
5. Connection string format:
   ```
   Server=aws.connect.psdb.cloud;Port=3306;Database=socialsense;User=<user>;Password=<pass>;SslMode=Required;
   ```

### Option B: Railway MySQL ($5/tháng)

1. Vào https://railway.app → New Project → MySQL
2. Variables tab → copy `MYSQL_URL`
3. Convert sang format: `Server=...;Port=3306;Database=railway;User=root;Password=...;`

### Option C: Render MySQL ($7/tháng)

1. Render Dashboard → New → PostgreSQL (Render không có MySQL)
2. ⚠️ Render chỉ có **PostgreSQL**, không có MySQL
3. Nếu muốn dùng Render database → cần migrate sang PostgreSQL (thay Pomelo → Npgsql)
4. **Khuyến nghị: dùng PlanetScale thay vì đổi database**

---

## 4. Tạo Web Service trên Render

### Bước 1: Tạo Web Service

1. Vào https://render.com → Dashboard → **New** → **Web Service**
2. Connect GitHub → chọn repo `khoa025ne/social-sense-BE`
3. Cấu hình:

| Field | Giá trị |
|-------|---------|
| **Name** | `socialsense-be` |
| **Region** | Singapore |
| **Branch** | `master` |
| **Runtime** | **Docker** |
| **Dockerfile Path** | `./Dockerfile` |
| **Instance Type** | Free (hoặc Starter $7/tháng để không sleep) |

### Bước 2: Health Check

Render cần health check endpoint để biết app đã start:

- **Health Check Path:** `/health`
- App đã có sẵn `GET /health` → trả `{ "status": "ok" }`

### Bước 3: Auto-Deploy

- Bật **Auto-Deploy** → mỗi lần push `master` sẽ tự deploy lại

---

## 5. Cấu hình Environment Variables

Vào Render → Web Service → **Environment** → thêm từng biến:

### 5.1 Bắt buộc

| Variable | Giá trị |
|----------|---------|
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ASPNETCORE_URLS` | `http://+:8080` |
| `ConnectionStrings__Default` | `Server=...;Port=3306;Database=socialsense;User=...;Password=...;SslMode=Required;` |
| `Jwt__Secret` | *(chuỗi random 64+ ký tự — xem mục 9)* |
| `Jwt__Issuer` | `SocialSense-BE` |
| `Jwt__Audience` | `SocialSense-FE` |
| `Jwt__ExpiryMinutes` | `60` |
| `ApiKeyEncryption__Secret` | *(chuỗi random 32+ ký tự — xem mục 9)* |

### 5.2 Email (SMTP)

| Variable | Giá trị |
|----------|---------|
| `Smtp__Host` | `smtp.gmail.com` |
| `Smtp__Port` | `587` |
| `Smtp__Username` | `khoaai2009@gmail.com` |
| `Smtp__Password` | `pmit gtxx vxci xhot` |
| `Smtp__FromName` | `SocialSense` |
| `Smtp__OtpExpiryMinutes` | `10` |

### 5.3 PayOS

| Variable | Giá trị |
|----------|---------|
| `PayOs__ClientId` | *(từ PayOS dashboard)* |
| `PayOs__ApiKey` | *(từ PayOS dashboard)* |
| `PayOs__ChecksumKey` | *(từ PayOS dashboard)* |
| `PayOs__ReturnUrl` | `https://socialsense-be.onrender.com/payment/success` |
| `PayOs__CancelUrl` | `https://socialsense-be.onrender.com/payment/cancel` |
| `PayOs__BaseUrl` | `https://api-merchant.payos.vn` |
| `PayOs__ExpiredAfterSeconds` | `900` |
| `PayOs__ProMonthlyPrice` | `79000` |
| `PayOs__EnterpriseMonthlyPrice` | `99000` |

### 5.4 AI Keys (nếu muốn seed từ config thay vì DB)

| Variable | Giá trị |
|----------|---------|
| `AiProviderKeys__0__label` | `OpenRouter-Key1` |
| `AiProviderKeys__0__keyValue` | *(OpenRouter API key)* |
| `AiProviderKeys__0__provider` | `openrouter` |
| `AiProviderKeys__0__modelOverride` | `meta-llama/llama-4-scout` |

> **Lưu ý:** AI keys tốt nhất nên thêm qua Admin API sau khi deploy (`POST /admin/api-keys`) thay vì env vars — dễ quản lý hơn.

### 5.5 Logging (production)

| Variable | Giá trị |
|----------|---------|
| `Logging__LogLevel__Default` | `Warning` |
| `Logging__LogLevel__Microsoft.AspNetCore` | `Warning` |

---

## 6. Sửa code cho production

### 6.1 Tạo Dockerfile

Tạo file `Dockerfile` ở root repo (xem nội dung ở mục 2.2).

### 6.2 Sửa Program.cs — bật HTTPS redirect cho production

Hiện tại code đang tắt HTTPS redirect trong Development. Render dùng HTTP nội bộ (reverse proxy xử lý HTTPS) nên giữ nguyên là đúng:

```csharp
// Giữ nguyên đoạn này — Render reverse proxy xử lý HTTPS
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
```

Thực ra trên Render, nên **tắt hoàn toàn** `UseHttpsRedirection` vì Render đã handle SSL ở load balancer:

```csharp
// Xóa hoặc comment đoạn UseHttpsRedirection
// app.UseHttpsRedirection();
```

### 6.3 Sửa CORS cho production

Hiện tại CORS đang `AllowAnyOrigin` — OK cho development. Trên production nên restrict:

```csharp
// Trong Program.cs, thêm policy production
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());

    options.AddPolicy("Production", policy =>
        policy.WithOrigins(
            "https://your-fe-domain.vercel.app",  // FE domain
            "https://socialsense.app"              // custom domain nếu có
        )
        .AllowAnyMethod()
        .AllowAnyHeader());
});

// Dùng policy theo environment
var corsPolicy = app.Environment.IsDevelopment() ? "AllowAll" : "Production";
app.UseCors(corsPolicy);
```

> Tạm thời có thể giữ `AllowAll` để test, sau đó restrict khi FE đã có domain cố định.

### 6.4 Sửa MySQL connection string cho PlanetScale

PlanetScale yêu cầu SSL. Sửa `Program.cs`:

```csharp
var serverVersion = new MySqlServerVersion(new Version(8, 0, 36));
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, serverVersion, mySqlOptions =>
    {
        // PlanetScale yêu cầu SSL
        if (!app.Environment.IsDevelopment())
        {
            mySqlOptions.EnableRetryOnFailure(3);
        }
    }));
```

### 6.5 Tắt Swagger trên production (tùy chọn)

```csharp
// Chỉ bật Swagger trong Development
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
```

Hiện tại đã đúng — không cần sửa.

---

## 7. Kiểm tra sau deploy

### 7.1 Health check

```
GET https://socialsense-be.onrender.com/health
→ { "status": "ok" }
```

### 7.2 Test auth

```
POST https://socialsense-be.onrender.com/auth/login
{
  "email": "admin@socialsense.vn",
  "password": "Password123!"
}
```

### 7.3 Kiểm tra DB migration

Xem logs trên Render → tìm dòng:
```
✅ Database migrations applied.
🔄 ApiKeyPool reloaded from DB: X active key(s).
```

### 7.4 Test email

```
POST https://socialsense-be.onrender.com/auth/forgot-password
{ "email": "your-email@gmail.com" }
```

---

## 8. Cập nhật PayOS webhook URL

Sau khi deploy xong, vào PayOS Dashboard:
1. Settings → Webhook URL
2. Cập nhật: `https://socialsense-be.onrender.com/payment/webhook`
3. Test webhook từ PayOS dashboard

---

## 9. Lưu ý bảo mật

### 9.1 Tạo JWT Secret mạnh

```bash
# Chạy lệnh này để tạo secret ngẫu nhiên
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Hoặc dùng: https://generate-secret.vercel.app/64
```

### 9.2 Tạo ApiKeyEncryption Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> ⚠️ **QUAN TRỌNG:** `ApiKeyEncryption__Secret` phải giữ nguyên sau khi đã có keys trong DB.
> Nếu đổi secret này, tất cả API keys đã encrypt trong DB sẽ không decrypt được.

### 9.3 Không commit secrets

Các file sau **KHÔNG được commit**:
- `src/appsettings.json` (đã gitignore ✅)
- `src/appsettings.Development.json` (đã gitignore ✅)
- `src/secrets.json` (đã gitignore ✅)

---

## 10. Troubleshooting

### Lỗi: "Failed to bind to address"
→ Đảm bảo `ASPNETCORE_URLS=http://+:8080` đã set trong env vars.

### Lỗi: "Connection refused" (MySQL)
→ Kiểm tra connection string, đặc biệt `SslMode=Required` cho PlanetScale.

### Lỗi: "Migration failed"
→ Xem logs Render. Nếu DB chưa tồn tại, EF Core sẽ tự tạo khi `MigrateAsync()` chạy.

### Lỗi: "No AI API keys"
→ Sau khi deploy, login admin và thêm key qua `POST /admin/api-keys`.

### App ngủ (free tier)
→ Dùng UptimeRobot (free) ping `/health` mỗi 14 phút để giữ app thức.
→ URL: https://uptimerobot.com

### Cold start chậm
→ Render free tier cold start ~30 giây. Upgrade lên Starter ($7/tháng) để tránh.

---

## Checklist deploy

- [ ] Tạo `Dockerfile` ở root repo
- [ ] Tạo `src/appsettings.Production.json` (placeholder)
- [ ] Sửa `Program.cs` — tắt `UseHttpsRedirection` unconditionally
- [ ] Tạo MySQL database (PlanetScale recommended)
- [ ] Tạo Render Web Service, connect GitHub repo
- [ ] Set tất cả Environment Variables (mục 5)
- [ ] Deploy lần đầu, kiểm tra logs
- [ ] Test `GET /health`
- [ ] Test `POST /auth/login` với seed account
- [ ] Thêm AI keys qua Admin API
- [ ] Thêm Pollinations key qua Admin API
- [ ] Cập nhật PayOS webhook URL
- [ ] Thông báo URL production cho đội FE

---

## Thông tin sau khi deploy

Điền vào sau khi deploy xong:

| Thông tin | Giá trị |
|-----------|---------|
| **Production URL** | `https://____________.onrender.com` |
| **Database host** | `____________` |
| **Deploy date** | `____________` |
| **Admin account** | `admin@socialsense.vn / Password123!` |
