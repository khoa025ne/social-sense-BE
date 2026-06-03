# 🔑 FE Guide — Quản lý AI Keys & Image/Text Generation

> Tài liệu này hướng dẫn FE tích hợp **Admin Key Management** và toàn bộ
> flow từ thêm key → sinh text → sinh ảnh. Cập nhật theo các thay đổi BE mới nhất.

---

## 📐 Kiến trúc tổng quan

```
Admin Panel (FE)
    ├── Quản lý Keys  → POST/PUT/DELETE /admin/api-keys
    ├── Xem Models    → GET /admin/models
    └── Key Pool      → GET /admin/api-keys/status

Người dùng (FE)
    ├── Sinh text     → POST /content/generate       (dùng Groq/OpenRouter)
    └── Sinh ảnh
          ├── Bước 1: POST /content/image/analyze    (AI phân tích, không tốn quota)
          └── Bước 2: POST /content/image/generate   (tạo ảnh, -1 quota)
```

**Phân vai key theo task:**

| Task | Provider ưu tiên | Ghi chú |
|------|-----------------|---------|
| Sinh text content | Groq → OpenRouter (round-robin) | FREE |
| Sinh ảnh banner | Pollinations (authenticated) | UNLIMITED FREE |
| Fallback ảnh | OpenRouter image model | FREE |
| Fallback cuối | Pollinations anonymous | Luôn có, chậm hơn |

---

## 🗝️ PHẦN 1 — Admin: Quản lý AI Keys

### 1.1 Lấy danh sách keys

```http
GET /admin/api-keys
Authorization: Bearer <admin_token>
```

**Response:**
```json
[
  {
    "id": 1,
    "label": "Groq-Text-Free",
    "keySuffix": "HPue",
    "provider": "groq",
    "modelOverride": "meta-llama/llama-4-scout-17b-16e-instruct",
    "supportsImageGen": false,
    "isActive": true,
    "isEncrypted": true,
    "notes": null,
    "createdAt": "2026-06-03T00:00:00Z",
    "updatedAt": "2026-06-03T00:00:00Z",
    "isInCooldown": false,
    "cooldownExpiresAt": null
  }
]
```

> ⚠️ `keySuffix` chỉ là 4 ký tự cuối — **key thật không bao giờ được trả về FE**.

---

### 1.2 Xem trạng thái runtime pool

```http
GET /admin/api-keys/status
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "totalKeys": 14,
  "hasKeys": true,
  "allInCooldown": false,
  "keys": [
    {
      "label": "Groq-Text-Free (...HPue)",
      "keySuffix": "HPue",
      "provider": "groq",
      "modelOverride": "meta-llama/llama-4-scout-17b-16e-instruct",
      "supportsImageGen": false,
      "isInCooldown": false,
      "cooldownExpiresAt": null
    },
    {
      "label": "Pollinations-Unlimited (...d5sA)",
      "provider": "pollinations",
      "supportsImageGen": true,
      "isInCooldown": false
    }
  ]
}
```

**UI gợi ý:** Badge màu xanh nếu `isInCooldown = false`, đỏ nếu `true` + hiển thị `cooldownExpiresAt`.

---

### 1.3 Thêm key mới — Request schema

```http
POST /admin/api-keys
Authorization: Bearer <admin_token>
Content-Type: application/json
```

```json
{
  "label": "string (bắt buộc, max 100 ký tự)",
  "keyValue": "string (bắt buộc, key thật)",
  "provider": "groq | openrouter | openai | pollinations | huggingface",
  "modelOverride": "string | null",
  "supportsImageGen": false,
  "notes": "string | null"
}
```

**Nếu không truyền `provider`** — BE tự detect từ prefix key:

| Key prefix | Provider auto-detect |
|-----------|---------------------|
| `gsk_` | `groq` |
| `sk-or-` | `openrouter` |
| `sk_` | `pollinations` |
| `sk-` | `openai` |
| `hf_` | `huggingface` |

**Response thành công:**
```json
{ "message": "Đã thêm API key thành công.", "id": 15 }
```

**Error:**
```json
{ "code": "KEY_ALREADY_EXISTS", "message": "Key này với model này đã tồn tại." }
```

---

### 1.4 Thêm nhiều keys cùng lúc (Bulk)

```http
POST /admin/api-keys/bulk
Authorization: Bearer <admin_token>
```

```json
[
  {
    "label": "Groq-Key-1",
    "keyValue": "gsk_xxx",
    "provider": "groq",
    "modelOverride": "meta-llama/llama-4-scout-17b-16e-instruct",
    "supportsImageGen": false
  },
  {
    "label": "Pollinations-Key-1",
    "keyValue": "sk_xxx",
    "provider": "pollinations",
    "supportsImageGen": true
  }
]
```

**Response:**
```json
{ "message": "Đã thêm 2 key(s).", "added": 2, "skipped": [] }
```

---

### 1.5 Cập nhật key

```http
PUT /admin/api-keys/{id}
Authorization: Bearer <admin_token>
```

```json
{
  "label": "Tên mới (optional)",
  "isActive": true,
  "provider": "groq",
  "modelOverride": "llama-3.3-70b-versatile",
  "supportsImageGen": false,
  "notes": "Ghi chú",
  "keyValue": "gsk_new_key (optional, chỉ truyền khi đổi key)"
}
```

> Tất cả fields đều **optional** — chỉ truyền field cần thay đổi.

---

### 1.6 Xóa key

```http
DELETE /admin/api-keys/{id}
Authorization: Bearer <admin_token>
```

```json
{ "message": "Đã xóa API key." }
```

---

### 1.7 Reload pool (không cần restart server)

```http
POST /admin/api-keys/reload
Authorization: Bearer <admin_token>
```

Gọi sau khi thêm/xóa key để áp dụng ngay.

---

### 1.8 Clear cooldown (khi key bị tạm khóa sai)

```http
POST /admin/api-keys/clear-cooldown
Authorization: Bearer <admin_token>
```

```json
{ "message": "Cleared cooldown for all 14 key(s).", "totalKeys": 14 }
```

---

### 1.9 Lấy danh sách models được hỗ trợ

```http
GET /admin/models
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "total": 17,
  "freeModels": [
    {
      "provider": "groq",
      "modelId": "meta-llama/llama-4-scout-17b-16e-instruct",
      "displayName": "Llama 4 Scout 17B (Groq)",
      "supportsImageGen": false,
      "isFree": true,
      "notes": "Very fast inference on Groq"
    },
    {
      "provider": "openrouter",
      "modelId": "google/gemini-2.0-flash-exp:free",
      "displayName": "Gemini 2.0 Flash Exp (Free)",
      "supportsImageGen": false,
      "isFree": true,
      "notes": "Google's fast model"
    }
  ],
  "imageModels": [
    {
      "provider": "openrouter",
      "modelId": "x-ai/grok-imagine-image-quality",
      "displayName": "Grok Imagine Image Quality (Free)",
      "supportsImageGen": true,
      "isFree": true
    }
  ],
  "allModels": [...]
}
```

**UI gợi ý:** Dropdown chọn model khi tạo key — lấy từ endpoint này, filter theo `provider` và `isFree`.

---

## 📝 PHẦN 2 — Sinh Text Content

### 2.1 Flow đơn giản nhất

```http
POST /content/generate
Authorization: Bearer <user_token>
Content-Type: application/json
```

```json
{
  "trendId": 1,
  "platforms": ["Facebook", "Instagram"],
  "language": "vi"
}
```

**Response:**
```json
{
  "items": [
    {
      "platform": "Facebook",
      "hook": "Cơ hội đầu tư không thể bỏ lỡ!",
      "body": "Thị trường BĐS đang có...",
      "cta": "Liên hệ ngay!",
      "hashtags": ["BatDongSan", "DauTu", "TPHCM"],
      "language": "vi",
      "mediaUrl": null,
      "bannerImagePrompt": "modern luxury apartment...",
      "bestTimeToPost": "Thứ Tư, 20h — Giờ vàng tương tác"
    }
  ],
  "selectedTrendTitle": "Căn hộ mini dưới 1 tỷ hot tại TP.HCM 2026",
  "smartMatchReason": "Trend được chọn trực tiếp bởi người dùng."
}
```

---

### 2.2 Full request schema

```json
{
  "trendId": 1,
  "platforms": ["Facebook", "Instagram", "TikTok"],
  "language": "vi",
  "outputCount": 2,
  "generateImage": false,
  "userInstruction": "Viết theo phong cách trẻ trung, dùng emoji nhiều",
  "mode": "TrendBased"
}
```

| Field | Type | Bắt buộc | Mặc định | Mô tả |
|-------|------|---------|---------|------|
| `trendId` | int? | ❌ | null | Null = AI tự chọn trend hot nhất |
| `platforms` | string[] | ❌ | persona defaults | Danh sách platform |
| `language` | string | ❌ | `"vi"` | `"vi"` hoặc `"en"` |
| `outputCount` | int | ❌ | 1 | 1–3 items |
| `generateImage` | bool | ❌ | false | Có sinh ảnh không (tốn thêm 15-30s) |
| `userInstruction` | string? | ❌ | null | Yêu cầu đặc biệt của user |
| `mode` | string | ❌ | `"TrendBased"` | `"TrendBased"` hoặc `"PersonaDriven"` |

**`mode = "PersonaDriven"`** — AI không dùng trend, chỉ dựa vào persona của user. Phù hợp khi user muốn content về thương hiệu riêng.

---

### 2.3 Platforms hợp lệ

```
"Facebook" | "Instagram" | "TikTok" | "Zalo" | "LinkedIn" | "Twitter"
```

### 2.4 Xử lý quota

```javascript
// Sau mỗi lần generate thành công, cập nhật quota UI
const result = await generateContent(payload);
const quota = await getQuota(); // GET /auth/quota
updateQuotaBadge(quota.remainingQuota, quota.dailyQuotaLimit);

// Khi nhận 429
if (error.status === 429) {
  showUpgradeModal(); // Hiển thị modal nâng cấp gói
}
```

---

## 🖼️ PHẦN 3 — Sinh Ảnh Banner (2 bước)

### Bước 1: Analyze — AI phân tích content

```http
POST /content/image/analyze
Authorization: Bearer <user_token>
Content-Type: application/json
```

```json
{
  "contentHistoryId": 56,
  "platform": "Facebook"
}
```

Hoặc truyền text trực tiếp (không cần lưu history):

```json
{
  "contentText": "Căn hộ mini sang trọng tại TP.HCM, giá chỉ 999 triệu",
  "platform": "Instagram"
}
```

**Response:**
```json
{
  "imageSummary": "Banner sang trọng với hình ảnh căn hộ hiện đại...",
  "draftPrompt": "modern luxury apartment Ho Chi Minh City, cityscape view...",
  "detectedIndustry": "real_estate",
  "clarifyingQuestions": [
    {
      "id": "q1",
      "question": "Bạn có muốn thêm ảnh sản phẩm/căn hộ thực vào banner không?",
      "type": "yesno"
    },
    {
      "id": "q2",
      "question": "Tone màu bạn muốn?",
      "type": "choice",
      "options": ["Tối & sang trọng", "Sáng & năng động", "Tự nhiên & ấm áp"]
    },
    {
      "id": "q3",
      "question": "Có muốn thêm text/caption trên banner không? Nếu có, nhập nội dung:",
      "type": "text_optional"
    }
  ],
  "bannerSpecs": {
    "platform": "Facebook",
    "dimensions": "1200x630",
    "aspectRatio": "1.91:1",
    "recommendedStyle": "Bold text, high contrast, product-focused"
  }
}
```

> ✅ **Không tốn quota.** Gọi thoải mái.

---

### Bước 2: Generate — Tạo ảnh thật

```http
POST /content/image/generate
Authorization: Bearer <user_token>
Content-Type: application/json
```

```json
{
  "contentHistoryId": 56,
  "platform": "Facebook",
  "draftPrompt": "modern luxury apartment Ho Chi Minh City, cityscape view",
  "detectedIndustry": "real_estate",
  "answers": {
    "q1": "yes",
    "q2": "Tối & sang trọng",
    "q3": "Giá chỉ từ 999 triệu"
  }
}
```

**⚠️ Quan trọng về `answers`:**

| Key | Giá trị hợp lệ | Lưu ý |
|-----|---------------|-------|
| `q1` | `"yes"` hoặc `"no"` | Có ảnh sản phẩm không |
| `q2` | Đúng 1 trong options từ bước Analyze | Copy nguyên từ `options[]` |
| `q3` | Text caption hoặc `""` | **Không** truyền giá trị của q2 vào đây |

---

**Response thành công:**
```json
{
  "imageUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRgAB...",
  "finalPrompt": "modern luxury apartment, dark luxury style...",
  "bannerSpecs": {
    "platform": "Facebook",
    "dimensions": "1200x630"
  },
  "isGenerated": true,
  "promptUsageTip": null
}
```

**Response khi không tạo được ảnh:**
```json
{
  "imageUrl": null,
  "finalPrompt": "modern luxury apartment...",
  "isGenerated": false,
  "promptUsageTip": "Copy prompt trên và dùng với: Midjourney, DALL-E 3, hoặc Adobe Firefly."
}
```

### 3.1 Hiển thị ảnh từ base64

```javascript
// imageUrl là base64 data URL — dùng trực tiếp trong <img>
if (result.isGenerated && result.imageUrl) {
  imageElement.src = result.imageUrl;
} else {
  // Hiển thị copy prompt fallback
  showFallbackPrompt(result.finalPrompt, result.promptUsageTip);
}
```

### 3.2 Loading state (ảnh mất 5–30 giây)

```javascript
// FE nên timeout riêng cho image generation
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 90_000); // 90s

try {
  setLoading(true);
  const res = await fetch('/content/image/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
    signal: controller.signal
  });
  const data = await res.json();
  clearTimeout(timeout);
  displayResult(data);
} catch (err) {
  if (err.name === 'AbortError') showToast('Tạo ảnh quá lâu, thử lại sau');
} finally {
  setLoading(false);
}
```

### 3.3 Platforms hợp lệ + kích thước ảnh

| Platform | Kích thước | Tỷ lệ |
|---------|----------|-------|
| Facebook | 1200×630 | 1.91:1 |
| Instagram | 1080×1080 | 1:1 |
| TikTok | 1080×1920 | 9:16 |
| Zalo | 1200×628 | 1.91:1 |
| LinkedIn | 1200×627 | 1.91:1 |
| Twitter | 1600×900 | 16:9 |

---

## 🎨 PHẦN 4 — UI/UX Admin Key Management

### 4.1 Form thêm key — Fields cần thiết

```
┌─────────────────────────────────────────────────┐
│  Label *          [Pollinations-Unlimited      ] │
│  API Key *        [sk_vylQJ8...  (masked input)] │
│  Provider         [pollinations        ▼       ] │
│  Model Override   [                   (optional)]│
│  Supports Image   [✅ Toggle ON/OFF             ] │
│  Notes            [Unlimited image, no watermark]│
│                          [Cancel]  [Add Key]     │
└─────────────────────────────────────────────────┘
```

**Provider dropdown options:**
```javascript
const providers = [
  { value: 'groq',        label: 'Groq (Text — Free unlimited)' },
  { value: 'openrouter',  label: 'OpenRouter (Text + Image)' },
  { value: 'pollinations',label: 'Pollinations (Image — Unlimited)' },
  { value: 'openai',      label: 'OpenAI (Text + DALL-E)' },
  { value: 'huggingface', label: 'HuggingFace (Image)' },
];
```

**Khi chọn provider → auto-fill model gợi ý:**
```javascript
const defaultModels = {
  groq:         'meta-llama/llama-4-scout-17b-16e-instruct',
  openrouter:   'google/gemini-2.0-flash-exp:free',
  pollinations: '',    // không cần model
  openai:       'gpt-4o',
  huggingface:  'black-forest-labs/FLUX.1-schnell',
};
```

**Khi chọn provider = `pollinations` → auto-set `supportsImageGen = true`:**
```javascript
if (provider === 'pollinations') {
  setSupportsImageGen(true);
  setModelOverride('');  // Pollinations không cần model
}
```

---

### 4.2 Hiển thị danh sách keys

```
┌──────┬──────────────────────┬─────────────┬───────────────────────────┬────────┬──────────────┐
│  ID  │  Label               │  Provider   │  Model                    │ Image? │  Status      │
├──────┼──────────────────────┼─────────────┼───────────────────────────┼────────┼──────────────┤
│  1   │ Groq-Text-Free       │ groq        │ llama-4-scout-17b         │  ❌   │  🟢 Active   │
│  2   │ OpenRouter-Text      │ openrouter  │ gemini-2.0-flash-exp:free │  ❌   │  🟢 Active   │
│  10  │ Pollinations-Unltd   │ pollinations│ —                         │  ✅   │  🟢 Active   │
│  11  │ OpenRouter-Img-Bkup  │ openrouter  │ x-ai/grok-imagine         │  ✅   │  🔴 Cooldown │
└──────┴──────────────────────┴─────────────┴───────────────────────────┴────────┴──────────────┘
```

**Status badge logic:**
```javascript
function getKeyStatus(key) {
  if (!key.isActive) return { label: 'Disabled', color: 'gray' };
  if (key.isInCooldown) {
    const expires = new Date(key.cooldownExpiresAt);
    return { label: `Cooldown until ${expires.toLocaleTimeString()}`, color: 'red' };
  }
  return { label: 'Active', color: 'green' };
}
```

---

### 4.3 Model picker từ /admin/models

```javascript
// Fetch models từ BE — dùng để populate dropdown
const { data } = await api.get('/admin/models');

// Text models (supportsImageGen = false)
const textModels = data.allModels.filter(m => !m.supportsImageGen);
// Image models (supportsImageGen = true)
const imageModels = data.allModels.filter(m => m.supportsImageGen);

// Hiển thị badge FREE
// <span class={m.isFree ? 'badge-green' : 'badge-orange'}>{m.isFree ? 'FREE' : 'PAID'}</span>
```

**Free models quan trọng nhất (nên highlight trong UI):**

| Provider | Model ID | Dùng cho | Badge |
|---------|---------|---------|------|
| `groq` | `meta-llama/llama-4-scout-17b-16e-instruct` | Text | 🟢 FREE • Nhanh nhất |
| `groq` | `llama-3.3-70b-versatile` | Text | 🟢 FREE • Chất lượng cao |
| `openrouter` | `google/gemini-2.0-flash-exp:free` | Text | 🟢 FREE • Tiếng Việt tốt |
| `openrouter` | `deepseek/deepseek-r1:free` | Text | 🟢 FREE • Reasoning |
| `openrouter` | `x-ai/grok-imagine-image-quality` | Image | 🟢 FREE • 2K/4K |
| `pollinations` | *(không cần)* | Image | 🟢 UNLIMITED |

---

## ⚡ PHẦN 5 — Thay đổi BE cần FE tinh chỉnh

### 5.1 Image URL — Đã thay đổi từ URL → Base64

**TRƯỚC (cũ):**
```html
<img src="https://image.pollinations.ai/prompt/..." />
```

**BÂY GIỜ (mới):**
```javascript
// imageUrl là data:image/jpeg;base64,... — không phải HTTP URL
// Cần set trực tiếp vào src, KHÔNG gọi fetch thêm
imageElement.src = result.imageUrl;

// Download ảnh
function downloadImage(dataUrl, filename = 'banner.jpg') {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
```

**Lý do thay đổi:** BE download ảnh từ Pollinations rồi convert sang base64,
trả về 1 lần để tránh CORS và giảm delay trên FE.

---

### 5.2 Image generation — Tăng timeout lên 90 giây

```javascript
// Pollinations authenticated: ~5-15s
// Pollinations anonymous fallback: ~30-60s
// FE nên set timeout 90s để cover cả fallback

const GENERATE_IMAGE_TIMEOUT = 90_000; // ms
```

---

### 5.3 Thêm loading progress steps cho image gen

```javascript
// FE nên hiển thị progress steps vì BE có 3 tầng fallback:
const steps = [
  { id: 1, label: 'Đang phân tích yêu cầu...', duration: 2000 },
  { id: 2, label: 'AI đang tạo ảnh (có thể mất 30s)...', duration: 15000 },
  { id: 3, label: 'Đang xử lý và tối ưu ảnh...', duration: 5000 },
];
// Chạy steps tuần tự trong khi chờ API response
```

---

### 5.4 Content generate — Field mới `bannerImagePrompt`

Mỗi item trong `items[]` giờ có thêm `bannerImagePrompt`:

```javascript
const item = result.items[0];
// item.bannerImagePrompt = "modern luxury apartment Ho Chi Minh City..."
// Dùng field này làm draftPrompt khi user nhấn "Tạo ảnh cho post này"
```

**Nút "Tạo ảnh" trong content history:**
```javascript
async function createImageForContent(item, historyId) {
  // Bước 1: analyze (optional nếu đã có draftPrompt)
  const analyzeRes = await api.post('/content/image/analyze', {
    contentHistoryId: historyId,
    platform: item.platform
  });

  // Bước 2: generate với draftPrompt từ analyze
  const imageRes = await api.post('/content/image/generate', {
    contentHistoryId: historyId,
    platform: item.platform,
    draftPrompt: analyzeRes.draftPrompt || item.bannerImagePrompt,
    detectedIndustry: analyzeRes.detectedIndustry,
    answers: {
      q1: 'no',    // default
      q2: 'Tối & sang trọng',  // default
      q3: ''       // không caption
    }
  });

  return imageRes.imageUrl;
}
```

---

### 5.5 Admin: Key pool merge (config + DB)

**TRƯỚC:** Khi DB có keys → config keys bị override hoàn toàn.

**BÂY GIỜ:** DB keys + config keys được **merge**. Thứ tự ưu tiên:
1. DB keys (index 0...N)
2. Config keys bổ sung (keys có trong config nhưng không có trong DB)

**Ảnh hưởng FE:** Trong màn hình `/admin/api-keys/status`, giờ sẽ thấy nhiều keys hơn — cả DB và config. Keys từ config có label không có prefix `DB-`.

---

### 5.6 Clear cooldown — Endpoint mới

```javascript
// Khi admin thấy key bị cooldown oan (BE restart nhưng cooldown còn trong memory)
async function clearAllCooldowns() {
  const res = await api.post('/admin/api-keys/clear-cooldown');
  toast.success(res.message);
  await refreshKeyStatus(); // Reload status table
}
```

Thêm nút **"Clear All Cooldowns"** ở góc màn hình key management, chỉ hiện khi có ít nhất 1 key `isInCooldown = true`.

---

## 🏗️ PHẦN 6 — Setup keys chuẩn cho Production

### Cấu hình khuyến nghị (0 đồng/tháng)

**Thêm lần lượt qua Admin Panel:**

```
1. Text key (Groq — FREE unlimited):
   Label:    Groq-Text-1
   Key:      gsk_xxxxx
   Provider: groq
   Model:    meta-llama/llama-4-scout-17b-16e-instruct
   Image:    ❌ OFF

2. Text key dự phòng (OpenRouter — FREE):
   Label:    OR-Text-Gemini-Free
   Key:      sk-or-v1-xxxxx
   Provider: openrouter
   Model:    google/gemini-2.0-flash-exp:free
   Image:    ❌ OFF

3. Image key chính (Pollinations — UNLIMITED FREE):
   Label:    Pollinations-Primary
   Key:      sk_vylQJ871j9D1ZyKsPL6AjgtmwJeYd5sA
   Provider: pollinations
   Model:    (để trống)
   Image:    ✅ ON

4. Image key dự phòng (OpenRouter — FREE):
   Label:    OR-Image-Grok-Free
   Key:      sk-or-v1-xxxxx (cùng key với text OK)
   Provider: openrouter
   Model:    x-ai/grok-imagine-image-quality
   Image:    ✅ ON
```

**Sau khi thêm xong:**
1. Nhấn `POST /admin/api-keys/reload` để áp dụng ngay
2. Verify `GET /admin/api-keys/status` — tất cả phải `isInCooldown: false`
3. Test: tạo 1 content + 1 ảnh từ user thường

---

## 🐛 PHẦN 7 — Xử lý lỗi phổ biến

| Lỗi | Nguyên nhân | FE xử lý |
|-----|------------|---------|
| `isGenerated: false` | Tất cả providers fail | Hiển thị `promptUsageTip` + nút copy prompt |
| Key `isInCooldown: true` | Rate limit hoặc 429 | Hiển thị thời gian hết cooldown, gợi ý thêm key |
| `allInCooldown: true` | Hết keys | Alert admin ngay, suggest clear-cooldown |
| `QUOTA_EXCEEDED` (429) | Hết quota ngày | Modal upgrade tier |
| Image timeout 90s | Pollinations chậm | Retry 1 lần, sau đó suggest copy prompt |
| `KEY_ALREADY_EXISTS` | Duplicate key+model | Thông báo "Key này đã tồn tại" |

---

## ✅ Checklist tích hợp

### Admin Panel
- [ ] Trang `/admin/api-keys` — danh sách + CRUD
- [ ] Badge status (xanh/đỏ/xám) theo `isInCooldown`
- [ ] Form thêm key với provider dropdown + model picker từ `/admin/models`
- [ ] Auto-set `supportsImageGen = true` khi chọn provider = `pollinations`
- [ ] Nút "Clear Cooldowns" khi có key bị cooldown
- [ ] Nút "Reload Pool" sau khi thêm/xóa key
- [ ] Hiển thị `keySuffix` thay vì key thật

### Content Generation
- [ ] Timeout 60s cho text gen
- [ ] Hiển thị `bestTimeToPost` từ response
- [ ] Nút "Tạo ảnh" từ `bannerImagePrompt` của mỗi item

### Image Generation
- [ ] Timeout 90s
- [ ] Loading progress steps
- [ ] Hiển thị ảnh từ base64 `data:image/jpeg;base64,...`
- [ ] Download button cho ảnh đã tạo
- [ ] Fallback UI khi `isGenerated: false` — hiển thị prompt + copy button
- [ ] Clarifying questions UI (yesno, choice, text_optional)
- [ ] ⚠️ Không truyền giá trị q2 vào q3
