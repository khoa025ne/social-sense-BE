# SocialSense BE — Hướng dẫn Deploy lên Railway

> **Railway** hỗ trợ MySQL native + Web Service trong cùng 1 project.
> Không block SMTP → Gmail hoạt động bình thường.
> Free tier: $5 credit/tháng (~đủ cho dev/staging).

---

## Tổng quan

```
Railway Project: SocialSense
    ├── Service 1: MySQL 8          ← database
    └── Service 2: Web (Docker)    ← ASP.NET Core BE
            URL: https://socialsense-be.up.railway.app
```

---

## Bước 1 — Tạo tài khoản Railway

1. Vào https://railway.app → **Login with GitHub**
2. Authorize Railway truy cập GitHub
3. Verify email nếu được yêu cầu

---

## Bước 2 — Tạo Project mới

1. Dashboard → **New Project**
2. Chọn **Empty Project**
3. Đặt tên project: `SocialSense`

---

## Bước 3 — Tạo MySQL Service

1. Trong project → **+ New Service** → **Database** → **MySQL**
2. Railway tự tạo MySQL 8, chờ ~30 giây
3. Click vào MySQL service → tab **Variables** → copy các giá trị:

| Variable Railway | Giá trị ví dụ |
|-----------------|---------------|
| `MYSQL_HOST` | `containers-us-west-xxx.railway.app` |
| `MYSQL_PORT` | `6033` |
| `MYSQL_DATABASE` | `railway` |
| `MYSQL_USER` | `root` |
| `MYSQL_PASSWORD` | `xxxxxxxxxxxx` |

4. Hoặc tab **Connect** → copy `MySQL Connection URL` dạng:
   ```
   mysql://root:password@host:port/railway
   ```

5. **Tạo database `socialsense`:**
   - Tab **Connect** → **MySQL Client** (hoặc dùng TablePlus/DBeaver connect vào)
   - Chạy: `CREATE DATABASE socialsense CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`

---

## Bước 4 — Tạo Web Service từ GitHub

1. Trong project → **+ New Service** → **GitHub Repo**
2. Chọn repo `khoa025ne/social-sense-BE`
3. Branch: `master`
4. Railway tự detect `Dockerfile` ở root → dùng Docker build
5. Chờ build lần đầu (3-5 phút)

---

## Bước 5 — Cấu hình Environment Variables

Click vào Web Service → tab **Variables** → **+ New Variable** → thêm từng biến:

### Bắt buộc

| Variable | Giá trị |
|----------|---------|
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ASPNETCORE_URLS` | `http://+:$PORT` |
| `ConnectionStrings__Default` | `Server=<MYSQL_HOST>;Port=<MYSQL_PORT>;Database=socialsense;User=<MYSQL_USER>;Password=<MYSQL_PASSWORD>;` |
| `Jwt__Secret` | `SocialSenseSuperSecretSecurityKey2026!!!` |
| `Jwt__Issuer` | `SocialSense-BE` |
| `Jwt__Audience` | `SocialSense-FE` |
| `Jwt__ExpiryMinutes` | `60` |
| `ApiKeyEncryption__Secret` | `SocialSenseApiKeyEncrypt2026#$%^&*()` |

> ⚠️ **Quan trọng:** `ASPNETCORE_URLS=http://+:$PORT` — Railway inject `$PORT` tự động (không cố định port 8080 như Render)

### Gmail SMTP (Railway KHÔNG block SMTP)

| Variable | Giá trị |
|----------|---------|
| `Smtp__Host` | `smtp.gmail.com` |
| `Smtp__Port` | `465` |
| `Smtp__Username` | `khoaai2009@gmail.com` |
| `Smtp__Password` | `pmit gtxx vxci xhot` |
| `Smtp__FromName` | `SocialSense` |
| `Smtp__OtpExpiryMinutes` | `10` |

### PayOS

| Variable | Giá trị |
|----------|---------|
| `PayOs__ClientId` | `2fac26d7-626f-4123-8f28-193d797605a7` |
| `PayOs__ApiKey` | `ad590596-352a-4922-9e93-27c6c8f57be5` |
| `PayOs__ChecksumKey` | `a9e4e908c88de2227b4d8a7e3cc6194a284f5237203d5902d8998d37eba2ead8` |
| `PayOs__ReturnUrl` | `socialsense://payment/success` |
| `PayOs__CancelUrl` | `socialsense://payment/cancel` |
| `PayOs__BaseUrl` | `https://api-merchant.payos.vn` |
| `PayOs__ExpiredAfterSeconds` | `900` |
| `PayOs__ProMonthlyPrice` | `50000` |
| `PayOs__EnterpriseMonthlyPrice` | `79000` |

### Logging

| Variable | Giá trị |
|----------|---------|
| `Logging__LogLevel__Default` | `Warning` |
| `Logging__LogLevel__Microsoft.AspNetCore` | `Warning` |

---

## Bước 6 — Sửa Dockerfile cho Railway PORT động

Railway inject `$PORT` vào container (không cố định 8080). Sửa `Dockerfile`:

```dockerfile
# Bỏ dòng: ENV ASPNETCORE_URLS=http://+:8080
# Railway inject PORT qua env var, ta set ASPNETCORE_URLS=$PORT trong Variables
EXPOSE 8080
```

Hoặc giữ nguyên Dockerfile hiện tại và set env var `ASPNETCORE_URLS=http://+:$PORT` — Railway sẽ expand `$PORT` tự động.

---

## Bước 7 — Deploy và kiểm tra

1. Sau khi set Variables → Railway tự redeploy
2. Tab **Deployments** → xem build logs
3. Tìm dòng: `✅ Database migrations applied.`
4. Copy URL từ tab **Settings** → **Domains** → **Generate Domain**
   - Dạng: `https://socialsense-be-production.up.railway.app`

### Test health check
```
GET https://socialsense-be-production.up.railway.app/health
→ { "status": "ok" }
```

### Test login
```
POST https://socialsense-be-production.up.railway.app/auth/login
{
  "email": "admin@socialsense.vn",
  "password": "Password123!"
}
```

### Test gửi mail (đăng ký tài khoản mới)
```
POST https://socialsense-be-production.up.railway.app/auth/register
{
  "email": "test@gmail.com",
  "password": "Test@123456",
  "displayName": "Test User"
}
→ Email welcome sẽ được gửi qua Gmail SMTP
```

---

## Bước 8 — Cập nhật PayOS Webhook URL

Vào https://my.payos.vn → Settings → Webhook URL:
```
https://socialsense-be-production.up.railway.app/payment/webhook
```

---

## Bước 9 — Thêm AI Keys qua Admin API

Login admin → thêm AI keys vào DB (không cần config):

```json
POST /admin/api-keys
Authorization: Bearer <admin-token>

{
  "label": "OpenRouter-Key1",
  "keyValue": "sk-or-v1-xxxx",
  "provider": "openrouter",
  "modelOverride": "meta-llama/llama-4-scout",
  "supportsImageGen": false
}
```

```json
POST /admin/api-keys
{
  "label": "Pollinations-Key1",
  "keyValue": "sk_xxxx",
  "provider": "pollinations",
  "supportsImageGen": true
}
```

---

## So sánh Railway vs Render

| Tiêu chí | Railway | Render |
|---------|---------|--------|
| **MySQL native** | ✅ Có | ❌ Không (chỉ PostgreSQL) |
| **SMTP (port 465/587)** | ✅ Không block | ❌ Block |
| **Free tier** | $5 credit/tháng | Free (sleep sau 15 phút) |
| **Sleep** | Không sleep | Sleep (free tier) |
| **Auto-deploy** | ✅ Có | ✅ Có |
| **Custom domain** | ✅ Có | ✅ Có |

---

## Connection String format cho Railway MySQL

```
Server=<MYSQL_HOST>;Port=<MYSQL_PORT>;Database=socialsense;User=<MYSQL_USER>;Password=<MYSQL_PASSWORD>;SslMode=Required;
```

> Railway MySQL yêu cầu `SslMode=Required` khi connect từ ngoài.

---

## Checklist deploy Railway

- [ ] Tạo Railway account + project
- [ ] Tạo MySQL service → tạo database `socialsense`
- [ ] Tạo Web service từ GitHub repo
- [ ] Set tất cả Environment Variables (mục 5)
- [ ] Đợi deploy xong → kiểm tra logs
- [ ] Test `GET /health`
- [ ] Test `POST /auth/login`
- [ ] Test `POST /auth/register` → kiểm tra email
- [ ] Cập nhật PayOS Webhook URL
- [ ] Thêm AI keys qua Admin API
- [ ] Generate domain → gửi cho đội FE
