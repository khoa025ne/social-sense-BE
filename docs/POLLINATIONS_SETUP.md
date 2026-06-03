# 🎨 Pollinations.ai — Unlimited Image Generation Setup

## 🔥 Tại sao dùng Pollinations.ai?

| Tính năng | Anonymous | Authenticated (có key) |
|---|---|---|
| **Rate limit** | Slow (~60s/image) | Fast (~15-30s/image) |
| **Quality** | 1024x1024 max | Up to 2048x2048 |
| **Watermark** | ❌ Có logo nhỏ | ✅ Không logo |
| **Priority** | Low | High |
| **Giá** | FREE | FREE |

**Kết luận:** Có key = unlimited + nhanh + không logo + chất lượng cao — vẫn hoàn toàn miễn phí.

---

## 📋 Bước 1: Lấy Pollinations API Key

### Cách 1: Lấy từ website (dễ nhất)

1. Vào https://pollinations.ai/
2. Kéo xuống phần **"API Access"** hoặc **"Get API Key"**
3. Đăng ký email → nhận key dạng `sk_xxxxxxxxx`

### Cách 2: Qua Discord (nếu cách 1 không có)

1. Join Discord: https://discord.gg/pollinations
2. Vào channel `#api-keys`
3. Gửi message: `/apikey`
4. Bot sẽ DM key cho bạn

### Cách 3: Qua GitHub (developers)

```bash
curl -X POST https://api.pollinations.ai/v1/auth/key \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com"}'
```

---

## 🔧 Bước 2: Config cho Development

Mở `appsettings.Development.json`, thêm key Pollinations:

```json
{
  "AiProviderKeys": [
    {
      "label": "Groq-Text-Free",
      "keyValue": "gsk_YOUR_GROQ_KEY_HERE",
      "provider": "groq",
      "modelOverride": "meta-llama/llama-4-scout-17b-16e-instruct",
      "supportsImageGen": false
    },
    {
      "label": "OpenRouter-Text-Free",
      "keyValue": "sk-or-v1-YOUR_OPENROUTER_KEY",
      "provider": "openrouter",
      "modelOverride": "google/gemini-2.0-flash-exp:free",
      "supportsImageGen": false
    },
    {
      "label": "OpenRouter-Image-Free",
      "keyValue": "sk-or-v1-YOUR_OPENROUTER_KEY",
      "provider": "openrouter",
      "modelOverride": "x-ai/grok-imagine-image-quality",
      "supportsImageGen": true
    },
    {
      "label": "Pollinations-Unlimited",
      "keyValue": "sk_YOUR_POLLINATIONS_KEY_HERE",
      "provider": "pollinations",
      "supportsImageGen": true
    }
  ]
}
```

**Giải thích:**
- **provider: "pollinations"** — system tự biết dùng endpoint `image.pollinations.ai`
- **supportsImageGen: true** — đánh dấu key này dùng cho image
- **modelOverride: null** — Pollinations không cần chỉ định model

---

## 🚀 Bước 3: Test Local

### 3.1. Restart server

```bash
cd f:\SocialSense-BE\src
dotnet run --urls "http://localhost:5000"
```

### 3.2. Verify logs

Xem log khi server khởi động:

```
✅ ApiKeyPool initialized with 4 key(s) from config.
   - Groq-Text-Free (...HPue)
   - OpenRouter-Text-Free (...xxxx)
   - OpenRouter-Image-Free (...xxxx)
   - Pollinations-Unlimited (...xxxx)
```

### 3.3. Test image generation

```powershell
# Login trước
$token = "YOUR_JWT_TOKEN"
$headers = @{ Authorization = "Bearer $token" }

# Test image generation
$bodyImg = @{
    contentText = "Căn hộ mini sang trọng tại TP.HCM"
    platform = "Facebook"
    draftPrompt = "modern luxury apartment in Ho Chi Minh City, cityscape view, photorealistic, 4k"
    detectedIndustry = "real_estate"
    answers = @{
        q1 = "yes"
        q2 = "Tối & sang trọng"
        q3 = "Giá chỉ từ 999tr"
    }
} | ConvertTo-Json -Depth 3

$result = Invoke-RestMethod -Uri "http://localhost:5000/image/generate" `
    -Method POST -Headers $headers -Body $bodyImg -ContentType "application/json"

# Xem kết quả
$result | ConvertTo-Json -Depth 5
```

**Kỳ vọng:**
- `imageUrl`: base64 data URL hoặc HTTP URL
- `isGenerated`: true
- Time: ~15-30 giây

---

## 🌐 Bước 4: Config cho Production (Railway/Render)

### Option 1: Qua Admin Panel (khuyến nghị)

**Ưu điểm:**
- Mã hóa AES-256 trong DB
- Hot-reload không cần restart
- Quản lý dễ, có UI

**Các bước:**

1. Deploy BE lên Railway/Render (không cần config Pollinations key trước)
2. Login với tài khoản Admin
3. Vào `/admin/ai-keys`
4. Click **Add Key**
5. Điền:
   - **Label:** `Pollinations-Unlimited`
   - **Key Value:** `sk_xxxxxxxxx` (key thật)
   - **Provider:** `pollinations`
   - **Model Override:** để trống
   - **Supports Image Gen:** ✅ true
   - **Notes:** `Unlimited image generation, no watermark`
6. Click **Save**
7. Verify: key xuất hiện trong danh sách với đèn xanh

**Xong!** System tự reload key mà không cần restart.

### Option 2: Qua Environment Variables (alternative)

Nếu muốn hard-code vào env vars:

**Render:**

1. Render Dashboard → Web Service → **Environment**
2. Thêm biến mới:

```
Key: AiProviderKeys__3__label
Value: Pollinations-Unlimited

Key: AiProviderKeys__3__keyValue
Value: sk_YOUR_POLLINATIONS_KEY

Key: AiProviderKeys__3__provider
Value: pollinations

Key: AiProviderKeys__3__supportsImageGen
Value: true
```

**Railway:**

1. Railway Dashboard → Variables
2. **RAW Editor** → paste:

```bash
AiProviderKeys__3__label=Pollinations-Unlimited
AiProviderKeys__3__keyValue=sk_YOUR_POLLINATIONS_KEY
AiProviderKeys__3__provider=pollinations
AiProviderKeys__3__supportsImageGen=true
```

**⚠️ Lưu ý:** Index `__3__` phải đúng thứ tự (0, 1, 2, 3...) với các key khác.

---

## 🔍 Bước 5: Verify Production

### Cách 1: Qua Admin Panel

1. Login admin
2. Vào `/admin/ai-keys`
3. Kiểm tra:
   - ✅ Pollinations key xuất hiện
   - ✅ Provider = `pollinations`
   - ✅ Supports Image Gen = true
   - ✅ Active = true

### Cách 2: Qua API

```bash
# Get list keys (admin only)
curl -H "Authorization: Bearer $ADMIN_JWT" \
  https://your-app.onrender.com/admin/ai-keys
```

### Cách 3: Test thực tế

```bash
# Tạo ảnh thật
curl -X POST https://your-app.onrender.com/image/generate \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "contentText": "Modern apartment Ho Chi Minh City",
    "platform": "Facebook",
    "draftPrompt": "luxury real estate, cityscape, photorealistic",
    "detectedIndustry": "real_estate",
    "answers": {"q1": "yes", "q2": "Tối & sang trọng"}
  }'
```

**Kỳ vọng:**
- Response trong 15-30 giây
- `isGenerated: true`
- `imageUrl` chứa base64 data URL
- Không có watermark Pollinations

---

## 📊 Image Generation Priority Flow

Khi user request `generateImage: true`, hệ thống thử theo thứ tự:

```
1. Pollinations.ai (authenticated) ← key từ DB
   ↓ (nếu fail)
2. OpenRouter image model ← x-ai/grok-imagine-image-quality
   ↓ (nếu fail)
3. HuggingFace FLUX ← nếu có key HF
   ↓ (nếu fail)
4. Pollinations.ai (anonymous) ← không cần key, luôn hoạt động
```

**Ưu điểm:**
- Luôn có ảnh (fallback nhiều tầng)
- Ưu tiên key có rate limit cao nhất
- Tự động switch khi provider bị rate limit

---

## 🛠️ Troubleshooting

### 1. "Pollinations key không được dùng"

**Nguyên nhân:** Key không có `supportsImageGen: true`.

**Giải pháp:**
```json
{
  "provider": "pollinations",
  "supportsImageGen": true  ← PHẢI có dòng này
}
```

### 2. "Ảnh vẫn có logo Pollinations"

**Nguyên nhân:** Đang dùng anonymous mode (không có key).

**Giải pháp:**
- Verify key đã add vào DB/config
- Check logs: `"Pollinations GET → 200 (key=****xxxx)"`
- Nếu thấy `(key=none)` → key chưa được load

### 3. "401 Unauthorized từ Pollinations"

**Nguyên nhân:** Key sai hoặc expired.

**Giải pháp:**
- Lấy key mới từ https://pollinations.ai/
- Update lại trong Admin Panel

### 4. "Ảnh sinh chậm ~60 giây"

**Nguyên nhân:** Đang fallback về anonymous mode.

**Giải pháp:**
- Add authenticated key
- Key phải có `supportsImageGen: true`

### 5. Key bị rate limit

**Triệu chứng:** Log hiện `"Pollinations: 429 Too Many Requests"`

**Giải pháp:**
- Add thêm key Pollinations (multi-key rotation)
- Hoặc chờ 60 phút (cooldown tự động)

---

## 🎓 Best Practices

### Development

```json
{
  "AiProviderKeys": [
    {"label": "Groq-Text", "provider": "groq", "supportsImageGen": false},
    {"label": "OpenRouter-Text", "provider": "openrouter", "supportsImageGen": false},
    {"label": "OpenRouter-Image", "provider": "openrouter", "modelOverride": "x-ai/grok-imagine-image-quality", "supportsImageGen": true},
    {"label": "Pollinations-1", "provider": "pollinations", "supportsImageGen": true}
  ]
}
```

### Production (via Admin Panel)

1. **Text keys (2-3 keys):**
   - Groq: `meta-llama/llama-4-scout` (fast)
   - OpenRouter: `google/gemini-2.0-flash-exp:free` (quality)

2. **Image keys (2-3 keys):**
   - Pollinations #1: authenticated (unlimited, priority 1)
   - Pollinations #2: authenticated (backup, priority 2)
   - OpenRouter: `x-ai/grok-imagine-image-quality` (fallback)

---

## ✅ Checklist

### Development
- [ ] Lấy Pollinations key (5 phút)
- [ ] Thêm vào `appsettings.Development.json`
- [ ] Restart server
- [ ] Verify logs: "4 key(s) from config"
- [ ] Test image generation local

### Production (Option 1: Admin Panel)
- [ ] Deploy BE lên Railway/Render
- [ ] Login admin
- [ ] Add Pollinations key qua UI
- [ ] Verify key active với đèn xanh
- [ ] Test image generation production

### Production (Option 2: Env Vars)
- [ ] Thêm `AiProviderKeys__3__*` vào env vars
- [ ] Restart service
- [ ] Verify logs: "X key(s) from config"
- [ ] Test image generation production

---

## 🚀 Deploy Checklist đầy đủ

### 1. Config secrets trong Railway/Render

```bash
# Bắt buộc
ConnectionStrings__Default=<MySQL connection string>
Jwt__Secret=<64 char random>
ApiKeyEncryption__Secret=<32 char random>

# Email (optional nhưng khuyến nghị)
Smtp__Username=<Gmail>
Smtp__Password=<App password>

# Payment (optional)
PayOs__ClientId=<PayOS client ID>
PayOs__ApiKey=<PayOS API key>
PayOs__ChecksumKey=<PayOS checksum>
```

### 2. Deploy

```bash
git push railway main  # hoặc git push origin main (Render auto deploy)
```

### 3. Seed data (lần đầu)

```bash
curl -X POST https://your-app.onrender.com/admin/seed \
  -H "Authorization: Bearer $ADMIN_JWT"
```

### 4. Add AI keys qua Admin Panel

- Groq (text)
- OpenRouter (text + image)
- Pollinations (image) ← bước này!

### 5. Test end-to-end

```bash
# Login
curl -X POST https://your-app.onrender.com/auth/login \
  -d '{"email":"admin@socialsense.vn","password":"Password123!"}'

# Generate content + image
curl -X POST https://your-app.onrender.com/content/generate \
  -H "Authorization: Bearer $JWT" \
  -d '{"trendId":1,"platforms":["Facebook"],"generateImage":true}'
```

---

**🎉 Hoàn thành! Bạn đã có image generation unlimited với Pollinations.ai.**
