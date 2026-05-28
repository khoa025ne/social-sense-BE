# SocialSense BE — Tài liệu API cho đội Frontend

> **Base URL (dev):** `http://localhost:5280`
> **Base URL (https):** `https://localhost:7149`
> **Auth:** JWT Bearer Token — thêm header `Authorization: Bearer <token>` cho mọi endpoint có 🔒

---

## Mục lục

1. [Kiến trúc tổng quan](#1-kiến-trúc-tổng-quan)
2. [Hệ thống Quota & Tier](#2-hệ-thống-quota--tier)
3. [Auth — Xác thực](#3-auth--xác-thực)
4. [Context / Persona](#4-context--persona)
5. [Content — Tạo nội dung AI](#5-content--tạo-nội-dung-ai)
6. [Trends — Xu hướng](#6-trends--xu-hướng)
7. [Knowledge Base](#7-knowledge-base)
8. [Admin Panel](#8-admin-panel)
9. [Health Check](#9-health-check)
10. [Gợi ý tính năng mới (MVP+)](#10-gợi-ý-tính-năng-mới-mvp)

---

## 1. Kiến trúc tổng quan

```
FE (React/Vue/HTML)
    │
    ▼ HTTP/HTTPS
ASP.NET Core 8 API
    ├── JWT Auth (HS256)
    ├── QuotaCheckFilter (trước mỗi /content/generate)
    ├── Controllers (Auth, Context, Content, Trends, Knowledge, Admin)
    │
    ├── Services
    │   ├── GeminiApiKeyPool      — round-robin key rotation (OpenRouter + Groq)
    │   ├── ContentGeneratorService — sinh content AI (TrendBased / PersonaDriven)
    │   ├── GeminiContextAiExtractor — extract persona từ câu trả lời onboarding
    │   ├── GeminiKnowledgeExtractor — extract insight từ knowledge base
    │   ├── KnowledgeIngestionService — ingest manual/scrape/file
    │   ├── TrendQueryService     — query trends + tags
    │   ├── ContentHistoryService — lưu/đọc lịch sử content
    │   └── SeedDataService       — seed 10 users, 50 trends, 10 knowledge items
    │
    └── MySQL (EF Core, int auto-increment IDs)
```

### Flow tạo content (quan trọng nhất)

```
POST /content/generate
    │
    ├─ [QuotaCheckFilter] Kiểm tra quota còn không?
    │       └─ Nếu hết → 429 QUOTA_EXCEEDED
    │
    ├─ [ContentController] Lấy userId từ JWT claim
    │
    ├─ [ContentGeneratorService]
    │   ├─ Mode = TrendBased:
    │   │   ├─ Load top 10 trends từ DB
    │   │   ├─ Load knowledge items
    │   │   ├─ Gọi AI (OpenRouter/Groq) → 1 API call duy nhất
    │   │   │   ├─ AI chọn trend phù hợp nhất với persona
    │   │   │   ├─ AI lồng ghép knowledge liên quan
    │   │   │   └─ AI sinh content với công thức tâm lý
    │   │   └─ Nếu AI thành công → lưu history + trừ quota
    │   │
    │   └─ Mode = PersonaDriven:
    │       ├─ Đọc persona của user
    │       ├─ Gọi AI với "psychological playbook" prompt
    │       │   ├─ Phase 1: AI suy luận ngành nghề từ persona
    │       │   ├─ Phase 2: AI chọn công thức tâm lý phù hợp
    │       │   │   (BĐS: FOMO+khan hiếm, Tài chính: social proof, v.v.)
    │       │   └─ Phase 3: AI sinh content đánh thẳng vào pain point
    │       └─ Nếu AI thành công → lưu history + trừ quota
    │
    └─ Response: items[] với hook, body, cta, hashtags, bestTimeToPost
```

---

## 2. Hệ thống Quota & Tier

| Tier | DailyQuotaLimit | Ghi chú |
|------|----------------|---------|
| **Free** | 5 lượt/ngày | Mặc định khi đăng ký |
| **Pro** | 50 lượt/ngày | Admin nâng cấp |
| **Enterprise** | 500/ngày hoặc -1 (unlimited) | Admin nâng cấp |

**Quy tắc:**
- Quota reset tự động về `DailyQuotaLimit` mỗi ngày mới (UTC), kích hoạt khi có request đầu tiên trong ngày.
- **Chỉ trừ quota khi AI thật thành công** — fallback không bị trừ.
- `DailyQuotaLimit = -1` → Enterprise unlimited, bỏ qua mọi kiểm tra quota.
- FE nên gọi `GET /auth/quota` sau mỗi lần generate để cập nhật số lượt còn lại.

---

## 3. Auth — Xác thực

### 3.1 Đăng ký tài khoản

**`POST /auth/register`** — Không cần auth

**User story:** Người dùng mới vào trang, điền email + mật khẩu + tên hiển thị để tạo tài khoản. Hệ thống tự động gán tier Free (5 lượt/ngày) và role "User".

```json
// Request
{
  "email": "nguyen@example.com",
  "password": "Password123!",
  "displayName": "Nguyễn Văn An"
}

// Response 200
{
  "message": "User registered successfully.",
  "userId": 11
}

// Response 400 — email đã tồn tại
{
  "code": "AUTH_EMAIL_EXISTS",
  "message": "Email already registered."
}
```

### 3.2 Đăng nhập

**`POST /auth/login`** — Không cần auth

**User story:** Người dùng nhập email + mật khẩu. Hệ thống trả về `accessToken` (JWT, hết hạn sau 60 phút) và `refreshToken` (7 ngày). FE lưu cả 2 vào localStorage/cookie. `userId` trả về để FE lưu state.

```json
// Request
{
  "email": "nguyen@example.com",
  "password": "Password123!"
}

// Response 200
{
  "userId": 11,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "base64encodedRefreshToken...",
  "email": "nguyen@example.com",
  "displayName": "Nguyễn Văn An",
  "hasContext": false
}

// Response 401
{
  "code": "AUTH_INVALID_CREDENTIALS",
  "message": "Invalid email or password."
}
```

> **Lưu ý FE:** Nếu `hasContext = false` → redirect user đến trang thiết lập Persona trước khi dùng tính năng tạo content.

---

### 3.3 Refresh Token

**`POST /auth/refresh`** — Không cần auth

**User story:** AccessToken hết hạn (401), FE tự động gọi endpoint này với refreshToken để lấy cặp token mới mà không cần user đăng nhập lại.

```json
// Request
{
  "refreshToken": "base64encodedRefreshToken..."
}

// Response 200 — cấu trúc giống /auth/login
{
  "userId": 11,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "newBase64encodedRefreshToken...",
  "email": "nguyen@example.com",
  "displayName": "Nguyễn Văn An",
  "hasContext": true
}

// Response 401 — token hết hạn hoặc đã bị revoke
{
  "code": "AUTH_INVALID_REFRESH_TOKEN",
  "message": "Invalid or expired refresh token."
}
```

---

### 3.4 Thông tin user hiện tại

**`GET /auth/me`** 🔒

**User story:** FE gọi khi load app để lấy thông tin user đang đăng nhập, bao gồm tier, quota, roles.

```json
// Response 200
{
  "id": 11,
  "email": "nguyen@example.com",
  "displayName": "Nguyễn Văn An",
  "hasContext": true,
  "tier": "Free",
  "dailyQuotaLimit": 5,
  "remainingQuota": 3,
  "isUnlimited": false,
  "roles": ["User"]
}
```

---

### 3.5 Quota của user hiện tại

**`GET /auth/quota`** 🔒

**User story:** FE hiển thị thanh progress bar "3/5 lượt hôm nay" ở header. Gọi sau mỗi lần tạo content để cập nhật real-time.

```json
// Response 200
{
  "userId": 11,
  "tier": "Free",
  "dailyQuotaLimit": 5,
  "remainingQuota": 3,
  "usedToday": 2,
  "isUnlimited": false,
  "usagePercent": 40.0,
  "lastQuotaReset": "2026-05-28T00:00:00Z",
  "nextResetAt": "2026-05-29T00:00:00Z",
  "tierBenefits": {
    "free": "5 lượt/ngày",
    "pro": "50 lượt/ngày",
    "enterprise": "500 lượt/ngày hoặc Unlimited"
  }
}
```

---

### 3.6 Quota của user theo ID

**`GET /auth/users/{id}/quota`** 🔒

**User story:** User chỉ xem được quota của chính mình. Admin xem được của bất kỳ user nào. Dùng cho trang profile hoặc admin dashboard.

```
// User xem của mình: GET /auth/users/11/quota
// Admin xem của user khác: GET /auth/users/5/quota

// Response 403 nếu user thường cố xem của người khác
```

---

## 4. Context / Persona

> Tất cả endpoints trong nhóm này yêu cầu JWT. UserId được lấy từ JWT claim — FE không cần truyền userId trong body/query.

### 4.1 Onboarding — AI extract persona

**`POST /context/onboarding`** 🔒

**User story:** Lần đầu dùng app, user trả lời 3-5 câu hỏi về ngành nghề, đối tượng khách hàng, phong cách viết. AI phân tích và tự động điền persona. Sau khi hoàn thành, `hasContext` của user chuyển thành `true`.

**Cách AI hoạt động:** GeminiContextAiExtractor gửi các câu trả lời lên OpenRouter/Groq với prompt yêu cầu trả về JSON schema gồm `jobTitle`, `toneOfVoice`, `platformPreferences`, `targetAudience`, `contentFormats`, `negativeConstraints`.

```json
// Request
{
  "language": "vi",
  "answers": [
    "Tôi là môi giới bất động sản chuyên phân khúc căn hộ cao cấp tại TP.HCM, 5 năm kinh nghiệm.",
    "Khách hàng mục tiêu là nhà đầu tư 35-55 tuổi, thu nhập cao, quan tâm sinh lời và an toàn tài sản.",
    "Tôi muốn đăng Facebook và Zalo hàng ngày, dạng phân tích thị trường và review dự án.",
    "Phong cách chuyên nghiệp nhưng gần gũi, tạo cảm giác tin tưởng.",
    "Không đề cập dự án tranh chấp pháp lý, không cam kết lợi nhuận cụ thể."
  ]
}

// Response 200
{
  "personaVersion": 1,
  "status": "done"
}
```

> **Lưu ý:** Sau khi onboarding xong, gọi `GET /context/persona` để lấy persona đã được AI extract và hiển thị cho user xác nhận.

---

### 4.2 Xem persona hiện tại

**`GET /context/persona`** 🔒

**User story:** Trang "Hồ sơ thương hiệu" hiển thị toàn bộ persona của user. FE dùng để pre-fill form chỉnh sửa.

```json
// Response 200
{
  "userId": 11,
  "version": 1,
  "language": "vi",
  "jobTitle": "Môi giới Bất động sản cao cấp",
  "toneOfVoice": "Chuyên nghiệp, tin cậy, gần gũi",
  "platformPreferences": ["Facebook", "Zalo", "Instagram"],
  "targetAudience": [
    "Nhà đầu tư 35-55 tuổi",
    "Thu nhập cao, tích lũy tài sản",
    "Quan tâm căn hộ cao cấp TP.HCM"
  ],
  "contentFormats": ["Phân tích thị trường", "Review dự án", "Câu chuyện thành công"],
  "negativeConstraints": [
    "Không đề cập dự án tranh chấp pháp lý",
    "Không cam kết lợi nhuận cụ thể"
  ],
  "updatedAt": "2026-05-28T10:30:00Z"
}

// Response 404 — chưa có persona
```

---

### 4.3 Cập nhật persona thủ công

**`PUT /context/persona`** 🔒

**User story:** User muốn chỉnh sửa trực tiếp persona mà không cần qua AI onboarding. Chỉ truyền các field muốn thay đổi — field nào null thì giữ nguyên.

```json
// Request — chỉ cần truyền field muốn thay đổi
{
  "jobTitle": "Chuyên gia BĐS & Đầu tư",
  "toneOfVoice": "Chuyên nghiệp, phân tích sâu",
  "language": "vi",
  "platformPreferences": ["Facebook", "Zalo", "LinkedIn"],
  "targetAudience": [
    "Nhà đầu tư 35-55 tuổi",
    "Doanh nhân quan tâm đầu tư BĐS"
  ],
  "contentFormats": ["Phân tích thị trường", "Review dự án", "Tips đầu tư"],
  "negativeConstraints": [
    "Không đề cập dự án tranh chấp",
    "Không cam kết lợi nhuận"
  ]
}

// Response 200 — trả về persona đã cập nhật (cấu trúc giống GET /context/persona)
```

---

## 5. Content — Tạo nội dung AI

### 5.1 Tạo content

**`POST /content/generate`** 🔒 *(tốn 1 quota nếu AI thành công)*

**User story:** Đây là tính năng cốt lõi. User chọn mode, nền tảng, số lượng bài, nhập yêu cầu bổ sung rồi nhấn "Tạo nội dung". AI sinh ra các bài viết hoàn chỉnh với hook tâm lý, body, CTA, hashtag và gợi ý giờ đăng.

**Hai mode hoạt động:**

**Mode `TrendBased`:** AI load top 10 trends từ DB, chọn trend phù hợp nhất với persona, lồng ghép knowledge base, sinh content xoay quanh trend đó.

**Mode `PersonaDriven`:** AI đọc sâu persona, tự suy luận ngành nghề và áp dụng đúng công thức tâm lý:
- 🏠 BĐS: FOMO + khan hiếm + future pacing ("5 năm nữa đất này x3")
- 💰 Tài chính: Social proof + urgency + identity
- 👗 Thời trang: Status + exclusivity + transformation
- 🍜 Ẩm thực: Sensory + community
- 📚 Giáo dục: Pain agitation + transformation promise

```json
// Request — TrendBased cơ bản
{
  "outputCount": 3,
  "language": "vi",
  "targetPlatforms": ["Facebook", "Instagram", "TikTok"],
  "generateImage": false,
  "mode": "TrendBased"
}

// Request — PersonaDriven với yêu cầu cụ thể
{
  "outputCount": 2,
  "language": "vi",
  "targetPlatforms": ["Facebook", "Zalo"],
  "generateImage": false,
  "mode": "PersonaDriven",
  "userInstruction": "Tập trung vào đất nền ven đô giá 800tr-1.5 tỷ, nhấn mạnh cơ hội đầu tư 2026-2030, tạo cảm giác khan hiếm"
}

// Request — TrendBased với trend cụ thể
{
  "trendId": 7,
  "outputCount": 1,
  "language": "vi",
  "targetPlatforms": ["LinkedIn"],
  "generateImage": false,
  "mode": "TrendBased",
  "userInstruction": "Viết theo góc nhìn chuyên gia, dùng số liệu thực tế"
}
```

```json
// Response 200 — TrendBased
{
  "items": [
    {
      "platform": "Facebook",
      "hook": "Chỉ còn 3 lô cuối — giá tăng 15% sau Tết, bạn có muốn bỏ lỡ?",
      "body": "Thị trường đất nền ven đô đang bước vào chu kỳ tăng giá mạnh nhất trong 5 năm...",
      "cta": "Nhắn tin ngay để giữ chỗ — chỉ cần 50 triệu đặt cọc!",
      "hashtags": ["BatDongSan", "DatNen", "DauTu2026", "VenDo", "CoHoiVang"],
      "language": "vi",
      "mediaUrl": null,
      "bannerImagePrompt": "Aerial view of suburban land development, golden hour, modern infrastructure",
      "bestTimeToPost": "Thứ Ba và Thứ Năm lúc 19:30-21:00 — khung giờ nhà đầu tư online cao nhất"
    },
    {
      "platform": "Instagram",
      "hook": "Người mua năm 2021 đã lãi 200% — bạn có muốn bỏ lỡ lần này?",
      "body": "...",
      "cta": "...",
      "hashtags": ["...", "..."],
      "language": "vi",
      "mediaUrl": null,
      "bannerImagePrompt": "...",
      "bestTimeToPost": "..."
    }
  ],
  "selectedTrendTitle": "Đất nền ven đô tăng giá 30% sau quy hoạch vành đai 4",
  "smartMatchReason": "Xu hướng BĐS ven đô phù hợp hoàn toàn với persona môi giới căn hộ cao cấp TP.HCM"
}

// Response 200 — PersonaDriven (selectedTrendTitle = null)
{
  "items": [...],
  "selectedTrendTitle": null,
  "smartMatchReason": "Nội dung được sinh thuần từ persona — không phụ thuộc trend."
}

// Response 429 — hết quota
{
  "code": "QUOTA_EXCEEDED",
  "tier": "Free",
  "remainingQuota": 0,
  "dailyLimit": 5,
  "message": "Bạn đã dùng hết 5 lượt/ngày của gói Free. Nâng cấp lên Pro/Enterprise để có thêm lượt hoặc quay lại vào ngày mai."
}
```

**Các field của mỗi content item:**

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `platform` | string | Nền tảng mục tiêu |
| `hook` | string | Câu mở đầu dừng scroll, kích thích cảm xúc |
| `body` | string | Nội dung chính (≤1200 ký tự) |
| `cta` | string | Call-to-action cụ thể, có micro-commitment |
| `hashtags` | string[] | Tối đa 6 hashtag |
| `language` | string | `vi` hoặc `en` |
| `mediaUrl` | string? | URL ảnh nếu `generateImage: true` |
| `bannerImagePrompt` | string | Prompt tiếng Anh để generate ảnh (DALL-E/Midjourney) |
| `bestTimeToPost` | string | Gợi ý giờ đăng kèm lý do tâm lý |

---

### 5.2 Kiểm tra Brand Alignment

**`POST /content/check-alignment`** 🔒

**User story:** User đã viết sẵn một bài, muốn AI chấm điểm xem có đúng tone thương hiệu không và nhận bản viết lại tối ưu hơn.

**Cách AI hoạt động:** AI đọc persona + knowledge base → tìm brand rules liên quan → chấm điểm 0-100 → đưa ra phân tích + gợi ý + bản viết lại.

```json
// Request
{
  "draftContent": "Bán đất nền Bình Dương giá rẻ, pháp lý rõ ràng, liên hệ ngay để được tư vấn miễn phí và nhận ưu đãi đặc biệt trong tháng này."
}

// Response 200
{
  "brandScore": 62,
  "analysis": "Bài viết có thông tin cơ bản nhưng thiếu hook tâm lý mạnh. Cụm từ 'giá rẻ' có thể làm giảm uy tín thương hiệu cao cấp. Thiếu social proof và urgency cụ thể.",
  "suggestions": "1. Thay 'giá rẻ' bằng 'giá hợp lý nhất phân khúc'. 2. Thêm con số cụ thể (diện tích, giá/m²). 3. Tạo khan hiếm: 'Chỉ còn X lô'. 4. Thêm future pacing: '3 năm nữa khu vực này...'",
  "refinedContent": "🏠 Chỉ còn 5 lô cuối tại dự án X — Bình Dương\n\nGiá từ 1.2 tỷ/lô (80m²), pháp lý sổ đỏ trao tay.\nKhu vực quy hoạch đô thị mới — giá dự kiến tăng 20-30% sau 2026.\n\n✅ Vị trí: cách QL13 chỉ 500m\n✅ Tiện ích: trường học, bệnh viện, siêu thị trong bán kính 1km\n\n👉 Nhắn tin ngay để giữ chỗ — chỉ cần 100 triệu đặt cọc!"
}
```

---

### 5.3 Lịch sử nội dung

**`GET /content/history`** 🔒

**User story:** Trang "Lịch sử" hiển thị tất cả content đã tạo, có phân trang. User có thể xem lại, copy hoặc chỉnh sửa.

```
GET /content/history?page=1&pageSize=10

// Response 200
{
  "totalCount": 47,
  "page": 1,
  "pageSize": 10,
  "items": [
    {
      "id": 23,
      "userId": 11,
      "originalTrendId": 7,
      "generatedContent": [
        {
          "platform": "Facebook",
          "hook": "...",
          "body": "...",
          "cta": "...",
          "hashtags": ["..."],
          "language": "vi",
          "mediaUrl": null,
          "bannerImagePrompt": "...",
          "bestTimeToPost": "..."
        }
      ],
      "userEditedContent": null,
      "isEdited": false,
      "mediaUrl": null,
      "createdAt": "2026-05-28T14:30:00Z"
    }
  ]
}
```

---

### 5.4 Chỉnh sửa lịch sử

**`PUT /content/history/{id}/edit`** 🔒

**User story:** User muốn chỉnh sửa nội dung đã tạo (sửa body, thêm thông tin sản phẩm cụ thể). Bản gốc vẫn được giữ, bản sửa lưu vào `userEditedContent`.

```json
// PUT /content/history/23/edit
// Request
{
  "body": "Nội dung đã được chỉnh sửa bởi user...",
  "hook": "Hook mới nếu muốn thay",
  "cta": "CTA mới nếu muốn thay"
}

// Response 200
{
  "message": "Content history updated successfully."
}

// Response 404
{
  "code": "HISTORY_NOT_FOUND",
  "message": "Content history with ID 23 not found."
}
```

---

## 6. Trends — Xu hướng

### 6.1 Danh sách xu hướng

**`GET /trends`** — Không cần auth

**User story:** Trang "Xu hướng" hiển thị grid các trend đang hot. User click vào trend để tạo content ngay. Có thể lọc theo tag, phân trang.

```
GET /trends?page=1&pageSize=12&tagId=1

// Response 200
{
  "page": 1,
  "pageSize": 12,
  "total": 50,
  "items": [
    {
      "id": 6,
      "title": "Lãi suất ngân hàng giảm về mức thấp nhất 5 năm",
      "summary": "NHNN điều chỉnh lãi suất điều hành xuống 4%/năm...",
      "sourceUrl": "https://vnexpress.net/...",
      "hotLevel": 10,
      "createdAt": "2026-05-28T08:00:00Z",
      "tags": [
        { "id": 2, "name": "Tài chính", "slug": "tai-chinh" },
        { "id": 13, "name": "Đầu tư", "slug": "dau-tu" }
      ]
    }
  ]
}
```

---

### 6.2 Danh sách tags

**`GET /trends/tags`** — Không cần auth

**User story:** FE dùng để render dropdown filter tags trên trang Xu hướng.

```json
// Response 200
[
  { "id": 1, "name": "Bất động sản", "slug": "bat-dong-san" },
  { "id": 2, "name": "Tài chính", "slug": "tai-chinh" },
  { "id": 3, "name": "Thời trang", "slug": "thoi-trang" }
]
```

---

## 7. Knowledge Base

> Không cần auth (có thể thêm auth sau nếu cần bảo mật).

### 7.1 Nhập thủ công

**`POST /knowledge/manual`**

**User story:** User nhập thông tin sản phẩm, dự án, brand guidelines trực tiếp. AI sẽ dùng thông tin này để làm giàu nội dung khi generate.

**Cách AI hoạt động:** Sau khi lưu, hệ thống tự động chunk text → gọi AI extract insights, keywords, category → lưu vào KnowledgeChunks → AI cũng tự động tạo/cập nhật Trend nếu nội dung có xu hướng mới.

```json
// Request
{
  "title": "Thông tin dự án Vinhomes Grand Park Q9",
  "rawContent": "Vinhomes Grand Park là khu đô thị thông minh quy mô 271ha tại TP Thủ Đức. Gồm 44 tòa căn hộ cao tầng, 3500 căn shophouse, công viên 36ha. Giá từ 2.5 tỷ/căn 1PN. Pháp lý: sổ hồng lâu dài. Tiện ích: trường học quốc tế Vinschool, bệnh viện Vinmec, Vincom Mega Mall. Tỷ suất cho thuê 6-8%/năm. Đã bàn giao 80% dự án."
}

// Response 200
{
  "message": "Knowledge ingested successfully.",
  "itemId": 11,
  "title": "Thông tin dự án Vinhomes Grand Park Q9"
}

// Response 409 — nội dung trùng lặp
{
  "code": "KNOWLEDGE_ALREADY_EXISTS",
  "message": "This knowledge content has already been ingested."
}
```

---

### 7.2 Crawl từ URL

**`POST /knowledge/scrape`**

**User story:** User paste URL bài báo, trang web sản phẩm. Hệ thống tự crawl, extract text và lưu vào knowledge base.

**Whitelist domain hiện tại:** `wikipedia.org`, `reddit.com`, `dev.to`, `vnexpress.net`, `google.com`, `trends.google.com`

```json
// Request
{
  "targetUrl": "https://vnexpress.net/bat-dong-san/..."
}

// Response 200
{
  "message": "Knowledge crawled and ingested successfully.",
  "itemId": 12,
  "title": "bat-dong-san-article",
  "sourceUrl": "https://vnexpress.net/..."
}

// Response 400 — domain không trong whitelist
{
  "code": "UNSUPPORTED_WEBSITE_SOURCE",
  "message": "Crawling from this website domain is not allowed by whitelist options."
}
```

---

### 7.3 Upload file

**`POST /knowledge/upload-file`** — multipart/form-data

**User story:** User upload file tài liệu nội bộ (brochure, brand guideline, báo cáo thị trường). Hỗ trợ `.txt`, `.md`, `.docx`, `.pdf` tối đa 10MB.

```
// Form data: file = <file>

// Response 200
{
  "message": "File uploaded and ingested successfully.",
  "itemId": 13,
  "fileName": "brand-guideline-2026.pdf"
}

// Response 400 — sai định dạng
{
  "code": "INVALID_FILE_FORMAT",
  "message": "Only .txt, .md, .docx, and .pdf file formats are allowed."
}

// Response 422 — file rỗng hoặc không extract được text
{
  "code": "CANNOT_EXTRACT_TEXT_FROM_FILE",
  "message": "The uploaded file is empty or no readable text could be extracted."
}
```

---

## 8. Admin Panel

> Tất cả endpoints `/admin/*` yêu cầu JWT + role **Admin**.

### 8.1 Dashboard tổng quan

**`GET /admin/dashboard`** 🔒 Admin

**User story:** Admin mở dashboard thấy ngay: tổng users, tổng content đã tạo, số API keys đang hoạt động, biểu đồ hoạt động 7 ngày.

```json
// Response 200
{
  "totalUsers": 10,
  "activeUsers": 9,
  "totalContentGenerated": 50,
  "totalKnowledgeItems": 10,
  "totalTrends": 50,
  "activeApiKeys": 2,
  "coolingDownApiKeys": 0,
  "last7DaysContent": [
    { "date": "2026-05-22", "contentGenerated": 5, "newUsers": 1 },
    { "date": "2026-05-23", "contentGenerated": 8, "newUsers": 0 },
    { "date": "2026-05-28", "contentGenerated": 12, "newUsers": 2 }
  ]
}
```

---

### 8.2 Danh sách users

**`GET /admin/users`** 🔒 Admin

```
GET /admin/users?page=1&pageSize=20&search=nguyen&isActive=true

// Response 200
{
  "total": 10,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1,
  "data": [
    {
      "id": 1,
      "email": "admin@socialsense.vn",
      "displayName": "Admin SocialSense",
      "isActive": true,
      "hasContext": true,
      "tier": "Enterprise",
      "dailyQuotaLimit": 500,
      "remainingQuota": 498,
      "lastQuotaReset": "2026-05-28T00:00:00Z",
      "createdAt": "2026-04-01T00:00:00Z",
      "roles": ["Admin", "User"],
      "totalContentGenerated": 15
    }
  ]
}
```

---

### 8.3 Chi tiết user

**`GET /admin/users/{id}`** 🔒 Admin

```json
// GET /admin/users/11
// Response 200 — cấu trúc giống 1 item trong danh sách
```

---

### 8.4 Tạo user mới (admin tạo thay)

**`POST /admin/users`** 🔒 Admin

```json
// Request
{
  "email": "newuser@example.com",
  "password": "Password123!",
  "displayName": "Người dùng mới",
  "dailyQuotaLimit": 10,
  "isAdmin": false
}

// Response 200
{
  "message": "Tạo user thành công.",
  "userId": 12
}
```

---

### 8.5 Cập nhật user

**`PUT /admin/users/{id}`** 🔒 Admin

```json
// Request — chỉ truyền field muốn thay đổi
{
  "displayName": "Tên mới",
  "isActive": true,
  "dailyQuotaLimit": 20,
  "resetQuotaNow": true
}

// Response 200
{ "message": "Cập nhật thành công." }
```

---

### 8.6 Đổi tier user

**`PUT /admin/users/{id}/tier`** 🔒 Admin

**User story:** Admin nâng cấp user từ Free lên Pro sau khi user thanh toán. Quota tự động cập nhật theo tier mặc định hoặc custom.

```json
// Nâng lên Pro (50 lượt/ngày)
{
  "tier": "Pro"
}

// Nâng lên Enterprise với quota custom
{
  "tier": "Enterprise",
  "customDailyQuota": 200
}

// Nâng lên Enterprise unlimited
{
  "tier": "Enterprise",
  "customDailyQuota": -1
}

// Response 200
{
  "message": "Đã đổi tier thành Pro.",
  "userId": 11,
  "tier": "Pro",
  "dailyQuotaLimit": 50,
  "isUnlimited": false
}
```

---

### 8.7 Vô hiệu hóa / Kích hoạt lại user

```
DELETE /admin/users/{id}          → vô hiệu hóa (soft delete)
POST   /admin/users/{id}/restore  → kích hoạt lại
POST   /admin/users/{id}/reset-quota → reset quota về DailyQuotaLimit ngay
```

---

### 8.8 Quản lý API Keys

**User story:** Admin thêm/xóa/bật-tắt API keys của OpenRouter và Groq mà không cần restart server. Pool tự động reload.

```json
// GET /admin/api-keys — danh sách keys (ẩn giá trị thực, chỉ hiện 4 ký tự cuối)
[
  {
    "id": 1,
    "label": "OpenRouter-Key1",
    "keySuffix": "dd1b",
    "provider": "openrouter",
    "isActive": true,
    "notes": "openrouter",
    "createdAt": "2026-05-28T00:00:00Z",
    "isInCooldown": false,
    "cooldownExpiresAt": null
  }
]

// POST /admin/api-keys — thêm key mới
{
  "label": "OpenRouter-Key2",
  "keyValue": "sk-or-v1-...",
  "notes": "openrouter"
}

// POST /admin/api-keys/bulk — thêm nhiều keys
[
  { "label": "Groq-Key2", "keyValue": "gsk_...", "notes": "groq" },
  { "label": "Groq-Key3", "keyValue": "gsk_...", "notes": "groq" }
]

// PUT /admin/api-keys/{id} — cập nhật
// DELETE /admin/api-keys/{id} — xóa
// POST /admin/api-keys/reload — reload pool không cần restart
// GET /admin/api-keys/status — trạng thái runtime pool
```

---

### 8.9 So sánh thống kê 2 kỳ

**`POST /admin/stats/compare`** 🔒 Admin

**User story:** Admin so sánh hiệu suất tháng này vs tháng trước.

```json
// Request
{
  "period": "month",
  "periodA": "2026-04-01",
  "periodB": "2026-05-01"
}

// period: "day" | "month" | "quarter" | "year"

// Response 200
{
  "periodA": {
    "label": "04/2026",
    "newUsers": 8,
    "activeUsers": 6,
    "totalContentGenerated": 120,
    "newKnowledgeItems": 5,
    "newTrends": 30
  },
  "periodB": {
    "label": "05/2026",
    "newUsers": 12,
    "activeUsers": 9,
    "totalContentGenerated": 185,
    "newKnowledgeItems": 8,
    "newTrends": 20
  },
  "diff": {
    "newUsersDiff": 4,
    "newUsersChangePercent": 50.0,
    "contentGeneratedDiff": 65,
    "contentGeneratedChangePercent": 54.17
  }
}
```

---

### 8.10 Seed dữ liệu mẫu

**`POST /admin/seed`** 🔒 Admin

**User story:** Admin muốn reset và seed lại dữ liệu demo. Chỉ chạy khi DB trống.

```json
// Response 200
{ "message": "Seed completed." }
```

---

## 9. Health Check

**`GET /health`** — Không cần auth

```json
// Response 200
{ "status": "ok" }
```

---

## 10. Gợi ý tính năng mới (MVP+)

### 🔥 Ưu tiên cao — Hoàn thiện MVP

#### 10.1 Lịch đăng bài (Content Calendar)
**Endpoint gợi ý:** `POST /content/schedule`, `GET /content/calendar`
- User chọn bài đã tạo → chọn ngày giờ đăng → lưu vào lịch
- FE hiển thị calendar view theo tuần/tháng
- Gợi ý: tích hợp với `bestTimeToPost` AI đã trả về

#### 10.2 Template thư viện
**Endpoint gợi ý:** `GET /templates`, `POST /templates`, `POST /content/generate-from-template`
- Admin tạo template cho từng ngành (BĐS, F&B, thời trang...)
- User chọn template → AI điền vào theo persona
- Giảm thời gian onboarding cho user mới

#### 10.3 Bulk generate
**Endpoint gợi ý:** `POST /content/bulk-generate`
- User tạo 1 lần ra 7-30 bài cho cả tuần/tháng
- Mỗi bài cho 1 ngày, tự động vary platform và format
- Tốn quota theo số bài AI thành công

#### 10.4 Analytics cá nhân
**Endpoint gợi ý:** `GET /analytics/my-stats`
- Thống kê: tổng bài đã tạo, platform hay dùng nhất, trend hay dùng nhất
- Biểu đồ hoạt động 30 ngày
- So sánh với tuần/tháng trước

---

### 💡 Ưu tiên trung bình — Tăng giá trị

#### 10.5 Đánh giá & Feedback content
**Endpoint gợi ý:** `POST /content/history/{id}/feedback`
- User rate bài (1-5 sao) + comment
- AI học từ feedback để cải thiện output sau
- Request: `{ "rating": 4, "comment": "Hook tốt nhưng body hơi dài" }`

#### 10.6 Tái tạo content (Regenerate)
**Endpoint gợi ý:** `POST /content/history/{id}/regenerate`
- User không thích bài đã tạo → nhấn "Tạo lại" với cùng config
- Tốn thêm 1 quota
- Có thể thêm `userFeedback` để AI biết cần cải thiện gì

#### 10.7 Chia sẻ content
**Endpoint gợi ý:** `GET /content/share/{token}`
- Tạo link public để chia sẻ bài đã tạo (không cần đăng nhập)
- Hữu ích khi user muốn gửi cho khách hàng xem trước

#### 10.8 Quản lý Knowledge Base
**Endpoint gợi ý:** `GET /knowledge`, `DELETE /knowledge/{id}`
- Hiện tại chỉ có ingest, chưa có list/delete
- User cần xem danh sách knowledge đã upload và xóa cái không cần

---

### 🚀 Ưu tiên thấp — Scale up

#### 10.9 Multi-language content
- Hiện tại hỗ trợ `vi` và `en`
- Thêm: `ja`, `ko`, `zh` cho thị trường Đông Á
- Endpoint: thêm `language` options vào generate

#### 10.10 Webhook / Notification
**Endpoint gợi ý:** `POST /webhooks`, `GET /webhooks`
- Notify khi quota sắp hết (còn 1 lượt)
- Notify khi có trend mới phù hợp với persona
- Tích hợp Zalo OA, email, Telegram

#### 10.11 Team / Workspace
**Endpoint gợi ý:** `POST /workspaces`, `POST /workspaces/{id}/members`
- Nhiều user dùng chung 1 persona và knowledge base
- Phân quyền: Owner, Editor, Viewer
- Quota chia sẻ theo workspace

#### 10.12 Export content
**Endpoint gợi ý:** `POST /content/export`
- Export nhiều bài ra file Word/PDF/CSV
- Kèm lịch đăng, hashtag, ảnh banner
- Hữu ích cho agency quản lý nhiều khách hàng

---

## Phụ lục — Error Codes

| Code | HTTP | Mô tả |
|------|------|-------|
| `AUTH_EMAIL_EXISTS` | 400 | Email đã đăng ký |
| `AUTH_INVALID_CREDENTIALS` | 401 | Sai email/mật khẩu |
| `AUTH_INVALID_TOKEN` | 401 | JWT không hợp lệ |
| `AUTH_INVALID_REFRESH_TOKEN` | 401 | Refresh token hết hạn |
| `USER_NOT_FOUND` | 400/404 | Không tìm thấy user |
| `QUOTA_EXCEEDED` | 429 | Hết lượt tạo content hôm nay |
| `CONTENT_COUNT_INVALID` | 400 | outputCount phải 1-3 |
| `CONTENT_LANGUAGE_INVALID` | 400 | language phải là `vi` hoặc `en` |
| `CONTENT_INSTRUCTION_TOO_LONG` | 400 | userInstruction > 1000 ký tự |
| `CONTEXT_ANSWERS_TOO_FEW` | 400 | Cần ít nhất 3 câu trả lời |
| `KNOWLEDGE_ALREADY_EXISTS` | 409 | Nội dung đã được ingest |
| `UNSUPPORTED_WEBSITE_SOURCE` | 400 | Domain không trong whitelist |
| `CANNOT_EXTRACT_TEXT_FROM_FILE` | 422 | Không extract được text |
| `INVALID_FILE_FORMAT` | 400 | Sai định dạng file |
| `INVALID_TIER` | 400 | Tier không hợp lệ |
| `UNLIMITED_ENTERPRISE_ONLY` | 400 | Unlimited chỉ cho Enterprise |
| `EMAIL_EXISTS` | 400 | Email đã tồn tại (admin create) |
| `CANNOT_DELETE_SELF` | 400 | Admin không tự xóa mình |
| `KEY_ALREADY_EXISTS` | 400 | API key đã tồn tại |

---

## Phụ lục — Seed Data mặc định

Khi khởi động lần đầu (DB trống), hệ thống tự seed:

| Tài khoản | Mật khẩu | Tier | Role |
|-----------|----------|------|------|
| admin@socialsense.vn | Password123! | Enterprise | Admin + User |
| user1@socialsense.vn | Password123! | Pro | User |
| user2@socialsense.vn | Password123! | Pro | User |
| user3-9@socialsense.vn | Password123! | Free | User |

Ngoài ra: 50 Trends, 20 Tags, 10 KnowledgeItems, 50 ContentHistories, 10 UserContexts.
