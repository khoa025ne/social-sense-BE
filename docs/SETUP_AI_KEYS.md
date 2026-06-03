# 🔑 Hướng dẫn cấu hình AI API Keys

## 📋 Tóm tắt

SocialSense hỗ trợ nhiều AI provider:
- **Groq** — text generation (FREE unlimited)
- **OpenRouter** — text + image generation (FREE models + paid)
- **OpenAI** — text + image (paid)
- **Pollinations** — image only (FREE)
- **HuggingFace** — image only (FREE/paid)

---

## 🎯 Chiến lược tiết kiệm tối đa (0 đồng/tháng)

### ✅ Groq (Text generation — FREE không giới hạn)

| Model | Tốc độ | Chất lượng | Giá |
|---|---|---|---|
| `meta-llama/llama-4-scout-17b-16e-instruct` | ⚡⚡⚡ Rất nhanh | ⭐⭐⭐⭐ | FREE |
| `llama-3.3-70b-versatile` | ⚡⚡ Nhanh | ⭐⭐⭐⭐⭐ | FREE |
| `llama-3.1-8b-instant` | ⚡⚡⚡⚡ Siêu nhanh | ⭐⭐⭐ | FREE |

**Rate limit:** 30 requests/phút, không giới hạn requests/ngày

**Lấy key:**
1. Vào https://console.groq.com/keys
2. Đăng nhập Google/GitHub
3. Click **Create API Key** → copy `gsk_xxxxxx`

---

### ✅ OpenRouter (Text + Image — FREE models)

#### Text Models (FREE)

| Model | Chất lượng | Tiếng Việt | Giá |
|---|---|---|---|
| `google/gemini-2.0-flash-exp:free` | ⭐⭐⭐⭐⭐ | ✅ Xuất sắc | FREE |
| `deepseek/deepseek-r1:free` | ⭐⭐⭐⭐⭐ | ✅ Rất tốt | FREE |
| `meta-llama/llama-3.3-70b-instruct:free` | ⭐⭐⭐⭐ | ✅ Tốt | FREE |
| `qwen/qwen3-235b-a22b:free` | ⭐⭐⭐⭐ | ✅ Tốt | FREE |

#### Image Models (FREE)

| Model | Chất lượng | Tốc độ | Giá |
|---|---|---|---|
| `x-ai/grok-imagine-image-quality` | ⭐⭐⭐⭐⭐ 2K/4K | ⚡⚡ ~30s | FREE |

**Rate limit FREE (không add thẻ):** 10 requests/phút, 200 requests/ngày  
**Rate limit sau khi add thẻ:** 20 requests/phút, không giới hạn/ngày (nhưng vẫn free nếu dùng `:free` models)

**Lấy key:**
1. Vào https://openrouter.ai/keys
2. Đăng nhập
3. Click **Create Key** → copy `sk-or-v1-xxxxxx`

**⚠️ LƯU Ý:** Model phải có suffix `:free` mới miễn phí. Ví dụ:
- ✅ `google/gemini-2.0-flash-exp:free` — FREE
- ❌ `google/gemini-2.0-flash` — TỐN TIỀN ($0.00001/1k tokens)

---

## 🔧 Cấu hình trong `appsettings.Development.json`

### Cấu hình tối ưu (3 keys, 0 đồng/tháng)

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
      "keyValue": "sk-or-v1-YOUR_OPENROUTER_KEY_HERE",
      "provider": "openrouter",
      "modelOverride": "google/gemini-2.0-flash-exp:free",
      "supportsImageGen": false
    },
    {
      "label": "OpenRouter-Image-Free",
      "keyValue": "sk-or-v1-YOUR_OPENROUTER_KEY_HERE",
      "provider": "openrouter",
      "modelOverride": "x-ai/grok-imagine-image-quality",
      "supportsImageGen": true
    }
  ]
}
```

**Giải thích:**
- **Key 1+2 (text)** — system tự round-robin giữa Groq và OpenRouter để tránh rate limit
- **Key 3 (image)** — dùng riêng cho tạo ảnh banner (khi user chọn `generateImage: true`)

---

## 📊 Ý nghĩa các field

| Field | Bắt buộc | Ý nghĩa |
|---|---|---|
| `label` | ✅ | Tên hiển thị trong admin panel |
| `keyValue` | ✅ | API key thật |
| `provider` | ✅ | `groq` \| `openrouter` \| `openai` \| `pollinations` \| `huggingface` |
| `modelOverride` | ❌ | Model ID cụ thể (không điền = dùng model mặc định) |
| `supportsImageGen` | ❌ | `true` = key này dùng được cho image generation |

---

## 🚀 Hướng dẫn từng bước

### Bước 1: Lấy Groq key (5 phút)

1. Vào https://console.groq.com/keys
2. Click **Create API Key**
3. Copy key dạng `gsk_xxxxxx`
4. Paste vào `keyValue` của key Groq trong config

### Bước 2: Lấy OpenRouter key (5 phút)

1. Vào https://openrouter.ai/keys
2. Click **Create Key** (không cần add thẻ nếu chỉ dùng free models)
3. Copy key dạng `sk-or-v1-xxxxxx`
4. Paste vào `keyValue` của 2 key OpenRouter (dùng chung 1 key cho cả text và image)

### Bước 3: Restart server

```bash
cd f:\SocialSense-BE\src
dotnet run --urls "http://localhost:5000"
```

### Bước 4: Verify trong logs

```
✅ ApiKeyPool initialized with 3 key(s) from config.
```

### Bước 5: Test

```powershell
# Test content generation (dùng key text)
$token = "YOUR_JWT_TOKEN"
$headers = @{ Authorization = "Bearer $token" }
$body = '{"trendId":1,"platforms":["Facebook"],"language":"vi"}'
Invoke-RestMethod -Uri "http://localhost:5000/content/generate" `
    -Method POST -Headers $headers -Body $body -ContentType "application/json"

# Test image generation (dùng key image)
$bodyImg = '{"contentText":"Căn hộ mini TP.HCM","platform":"Facebook","draftPrompt":"modern apartment Ho Chi Minh City, luxury real estate"}'
Invoke-RestMethod -Uri "http://localhost:5000/image/generate" `
    -Method POST -Headers $headers -Body $bodyImg -ContentType "application/json"
```

---

## 🔥 OpenRouter: Có cần add thẻ hay không?

| Tính năng | KHÔNG add thẻ | CÓ add thẻ |
|---|---|---|
| Free models (`:free`) | ✅ 10 req/min | ✅ 20 req/min |
| Paid models | ❌ | ✅ Pay-per-use |
| Credits tự động charge | ❌ | ❌ (chỉ charge khi dùng paid) |
| Ưu tiên server | ❌ | ✅ |

**Kết luận:**
- **KHÔNG add thẻ** — vẫn dùng được tất cả free models, chỉ bị giới hạn 10 req/min (đủ dùng dev)
- **CÓ add thẻ** — tăng limit lên 20 req/min, mở khóa paid models, KHÔNG tự động charge tiền

**💡 Khuyến nghị:** Add thẻ để tăng rate limit (vẫn FREE nếu chỉ dùng `:free` models).

---

## ⚙️ Quản lý keys từ Admin Panel (Production)

Thay vì hard-code vào `appsettings.json`, production nên dùng Admin Panel:

1. Login với tài khoản Admin
2. Vào `/admin/ai-keys`
3. Click **Add Key**
4. Điền thông tin:
   - Label: `OpenRouter-Text-Free`
   - Key Value: `sk-or-v1-xxxxxx`
   - Provider: `openrouter`
   - Model Override: `google/gemini-2.0-flash-exp:free`
   - Supports Image Gen: `false`
5. Save

Keys được mã hóa AES-256 trong DB và tự reload mà không cần restart server.

---

## 📖 Image Generation Flow

Khi user request `generateImage: true`, hệ thống thử theo thứ tự:

1. **Pollinations.ai** với key từ DB (authenticated, fast)
2. **OpenRouter/HuggingFace** với key có `SupportsImageGen = true`
3. **Pollinations.ai** anonymous (không cần key, luôn hoạt động nhưng chậm)

**Ưu điểm:** Luôn có ảnh, ngay cả khi không có key nào.

---

## 🛠️ Troubleshooting

### 1. "No AI API keys configured"

**Nguyên nhân:** Chưa có key nào active trong config hoặc DB.

**Giải pháp:**
- Kiểm tra `appsettings.Development.json` → field `AiProviderKeys`
- Hoặc thêm key qua Admin Panel → `/admin/ai-keys`

### 2. Image không được tạo

**Nguyên nhân:** Không có key nào có `supportsImageGen: true`.

**Giải pháp:**
- Thêm key OpenRouter với:
  - `modelOverride: "x-ai/grok-imagine-image-quality"`
  - `supportsImageGen: true`

### 3. Rate limit 429 Too Many Requests

**Nguyên nhân:** Vượt quá 10 req/min (OpenRouter free tier).

**Giải pháp:**
- Add thẻ vào OpenRouter → tăng lên 20 req/min
- Hoặc thêm thêm key Groq (30 req/min, không giới hạn/ngày)

### 4. OpenRouter charge tiền bất ngờ

**Nguyên nhân:** Dùng nhầm model không có suffix `:free`.

**Giải pháp:**
- Luôn kiểm tra model có suffix `:free`
- Ví dụ: `google/gemini-2.0-flash-exp:free` (✅) vs `google/gemini-2.0-flash` (❌)

---

## 📚 Models FREE khuyến nghị

### Text Generation (Content)

1. **Groq: `meta-llama/llama-4-scout-17b-16e-instruct`** — nhanh nhất, chất lượng tốt
2. **OpenRouter: `google/gemini-2.0-flash-exp:free`** — chất lượng cao nhất cho tiếng Việt
3. **OpenRouter: `deepseek/deepseek-r1:free`** — reasoning tốt, phù hợp content phức tạp

### Image Generation

1. **OpenRouter: `x-ai/grok-imagine-image-quality`** — FREE, chất lượng 2K/4K, photorealistic
2. **Pollinations.ai** — FREE anonymous, chất lượng 1K

---

## 🎓 Best Practices

1. **Dùng nhiều keys** — để tránh rate limit (round-robin tự động)
2. **Groq cho tốc độ** — Llama 4 Scout trả về trong 1-2 giây
3. **OpenRouter Gemini cho chất lượng** — tiếng Việt tự nhiên nhất
4. **Separate image keys** — đặt `supportsImageGen: true` chỉ cho key image
5. **Monitor logs** — xem key nào đang bị cooldown
6. **Production: dùng DB keys** — Admin Panel mã hóa và hot-reload

---

## ✅ Checklist đầy đủ

- [ ] Lấy Groq key (5 phút)
- [ ] Lấy OpenRouter key (5 phút)
- [ ] Config vào `appsettings.Development.json` (3 keys)
- [ ] Restart server
- [ ] Verify logs: "ApiKeyPool initialized with 3 key(s)"
- [ ] Test content generation
- [ ] Test image generation
- [ ] (Optional) Add thẻ vào OpenRouter để tăng rate limit

---

**🎉 Hoàn thành! Bạn đã có hệ thống AI hoàn toàn miễn phí với 3 provider khác nhau.**
