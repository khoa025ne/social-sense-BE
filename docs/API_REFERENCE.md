# SocialSense BE — Tài liệu API cho đội Frontend

> **Base URL (dev):** `http://localhost:5280`
> **Base URL (https):** `https://localhost:7149`
> **Auth:** JWT Bearer Token — thêm header `Authorization: Bearer <token>` cho mọi endpoint có 🔒

---

> ## 🆕 CẬP NHẬT MỚI NHẤT — v2.2 (01/06/2026)
>
> Xem chi tiết ở cuối tài liệu:
> - **[Mục 13 — Image Generation Wizard](#13-image-generation-wizard-)** — Tạo ảnh banner AI 2 bước, tích hợp Pollinations.ai miễn phí
> - **[Mục 14 — Đổi mật khẩu qua OTP Email](#14-đổi-mật-khẩu-qua-otp-email-)** — Forgot password + reset qua email
> - **[Mục 15 — Welcome Email](#15-welcome-email-)** — Email chào mừng tự động sau đăng ký
> - **[Quota áp dụng cho tạo ảnh](#quota-image)** — `POST /content/image/generate` giờ tốn 1 quota

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
11. [Payment — Thanh toán](#11-payment--thanh-toán)
12. [Tier & Quota chi tiết](#12-tier--quota-chi-tiết)
13. [🆕 Image Generation Wizard](#13-image-generation-wizard-)
14. [🆕 Đổi mật khẩu qua OTP Email](#14-đổi-mật-khẩu-qua-otp-email-)
15. [🆕 Welcome Email](#15-welcome-email-)

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

## 11. Payment — Thanh toán

### 11.1 Danh sách gói dịch vụ

**`GET /payment/plans`** — Không cần auth

**User story:** FE render trang pricing hiển thị 3 gói Free/Pro/Enterprise với giá và tính năng để user so sánh và chọn nâng cấp.

```json
// Response 200
{
  "plans": [
    {
      "tier": "Free",
      "price": 0,
      "billingCycle": "forever",
      "features": ["5 lượt/ngày", "TrendBased & PersonaDriven", "Knowledge Base", "Brand Alignment", "Lịch sử"]
    },
    {
      "tier": "Pro",
      "price": 50000,
      "billingCycle": "monthly",
      "features": ["50 lượt/ngày", "Tất cả Free", "Ưu tiên AI", "Hỗ trợ email"]
    },
    {
      "tier": "Enterprise",
      "price": 79000,
      "billingCycle": "monthly",
      "features": ["500 lượt/ngày", "Tất cả Pro", "Hỗ trợ 24/7", "Custom quota"]
    }
  ]
}
```

---

### 11.2 Tạo đơn thanh toán

**`POST /payment/create`** 🔒

**User story:** User chọn gói Pro/Enterprise → hệ thống tạo link thanh toán payOS với QR code và thông tin chuyển khoản thủ công. User quét QR hoặc chuyển khoản → payOS tự động gọi webhook → tier nâng cấp.

```json
// Request
{
  "tier": "Pro"
}

// Response 200
{
  "orderId": 42,
  "orderCode": 1748500123456,
  "checkoutUrl": "https://pay.payos.vn/web/abc123",
  "qrCodeUrl": "https://api.vietqr.io/image/...",
  "bankTransfer": {
    "bankName": "MB Bank",
    "accountNumber": "1234567890",
    "accountName": "CONG TY SOCIALSENSE",
    "amount": 50000,
    "description": "SS1748500123456"
  },
  "expiresAt": "2026-05-28T15:30:00Z"
}
```

> ⚠️ **Lưu ý quan trọng:** `description` tối đa 25 ký tự, dùng làm nội dung chuyển khoản — user phải nhập đúng nội dung này khi chuyển khoản thủ công để hệ thống tự động xác nhận.

---

### 11.3 Webhook từ payOS

**`POST /payment/webhook`** — Không cần auth (payOS gọi)

**User story:** payOS gọi endpoint này sau khi xác nhận giao dịch thành công. App verify HMAC-SHA256 signature, cập nhật đơn hàng, tạo subscription 30 ngày, nâng tier + quota cho user.

> ⚠️ **Lưu ý quan trọng:** `orderCode = 123` là request test của payOS khi đăng ký webhook — trả về 200 ngay mà không verify signature. Đây là hành vi bắt buộc theo spec payOS.

```json
// Payload từ payOS (hệ thống tự xử lý, FE không cần gọi)
{
  "code": "00",
  "desc": "success",
  "success": true,
  "data": {
    "orderCode": 1748500123456,
    "amount": 50000,
    "description": "SS1748500123456",
    "accountNumber": "1234567890",
    "reference": "TXN_REF_ABC",
    "transactionDateTime": "2026-05-28T14:00:00Z",
    "currency": "VND",
    "paymentLinkId": "abc123",
    "code": "00",
    "desc": "Thành công",
    "counterAccountBankId": null,
    "counterAccountBankName": null,
    "counterAccountName": null,
    "counterAccountNumber": null,
    "virtualAccountName": null,
    "virtualAccountNumber": null
  },
  "signature": "hmac_sha256_signature_here"
}

// Response 200 — luôn trả về 200 để payOS không retry
{ "code": "00", "desc": "success" }
```

---

### 11.4 Kiểm tra trạng thái đơn hàng

**`GET /payment/orders/{orderCode}/status`** 🔒

**User story:** FE polling mỗi 3-5 giây sau khi user quét QR để biết đã thanh toán chưa. Khi `status = "Paid"` thì dừng polling và hiển thị thông báo nâng cấp thành công.

```json
// GET /payment/orders/1748500123456/status

// Response 200
{
  "orderId": 42,
  "orderCode": 1748500123456,
  "status": "Pending",
  "tier": "Pro",
  "amount": 50000,
  "paidAt": null,
  "createdAt": "2026-05-28T14:00:00Z"
}

// Response 200 — sau khi thanh toán
{
  "orderId": 42,
  "orderCode": 1748500123456,
  "status": "Paid",
  "tier": "Pro",
  "amount": 50000,
  "paidAt": "2026-05-28T14:05:30Z",
  "createdAt": "2026-05-28T14:00:00Z"
}
```

**Các giá trị `status`:** `Pending` | `Paid` | `Cancelled` | `Expired`

---

### 11.5 Thông tin subscription hiện tại

**`GET /payment/subscription`** 🔒

**User story:** Hiển thị thông tin gói hiện tại của user — tier, ngày hết hạn, số ngày còn lại. Dùng cho trang "Tài khoản" hoặc banner nhắc gia hạn.

```json
// Response 200
{
  "userId": 11,
  "tier": "Pro",
  "status": "Active",
  "startedAt": "2026-05-28T14:05:30Z",
  "expiresAt": "2026-06-28T14:05:30Z",
  "daysRemaining": 30,
  "isActive": true
}

// Response 200 — gói Free (không có subscription)
{
  "userId": 11,
  "tier": "Free",
  "status": "None",
  "startedAt": null,
  "expiresAt": null,
  "daysRemaining": null,
  "isActive": false
}
```

---

### 11.6 Lịch sử thanh toán

**`GET /payment/history`** 🔒

**User story:** Trang lịch sử thanh toán — user xem tất cả đơn hàng đã tạo, trạng thái từng đơn.

```
GET /payment/history?page=1&pageSize=10

// Response 200
{
  "totalCount": 3,
  "page": 1,
  "pageSize": 10,
  "items": [
    {
      "orderId": 42,
      "orderCode": 1748500123456,
      "tier": "Pro",
      "amount": 50000,
      "status": "Paid",
      "paidAt": "2026-05-28T14:05:30Z",
      "createdAt": "2026-05-28T14:00:00Z"
    },
    {
      "orderId": 38,
      "orderCode": 1748400987654,
      "tier": "Pro",
      "amount": 50000,
      "status": "Expired",
      "paidAt": null,
      "createdAt": "2026-04-28T10:00:00Z"
    }
  ]
}
```

---

## 12. Tier & Quota chi tiết

### Bảng tier

| Tier | DailyQuotaLimit | Giá | Ghi chú |
|------|----------------|-----|---------|
| **Free** | 5/ngày | 0 | Mặc định khi đăng ký |
| **Pro** | 50/ngày | 50.000 VND/tháng | Thanh toán qua payOS |
| **Enterprise** | 500/ngày hoặc -1 | 79.000 VND/tháng | -1 = unlimited |

### Quy tắc quota

- Quota reset tự động về `DailyQuotaLimit` mỗi ngày mới (UTC), kích hoạt khi có request đầu tiên trong ngày.
- **Chỉ trừ quota khi AI thật thành công** — fallback không bị trừ.
- `DailyQuotaLimit = -1` → Enterprise unlimited, bỏ qua mọi kiểm tra quota.
- FE nên gọi `GET /auth/quota` sau mỗi lần generate để cập nhật số lượt còn lại real-time.

### Flow nâng cấp tier qua thanh toán

```
User chọn gói → POST /payment/create
    │
    ├─ Hệ thống tạo PaymentOrder (status: Pending)
    ├─ Tạo link payOS với QR code + thông tin chuyển khoản
    │
    ▼
User quét QR hoặc chuyển khoản thủ công
    │
    ▼
payOS xác nhận giao dịch → POST /payment/webhook
    │
    ├─ App verify HMAC-SHA256 signature
    ├─ Cập nhật PaymentOrder (status: Paid)
    ├─ Tạo Subscription (30 ngày)
    └─ Nâng tier + quota cho user
    │
    ▼
FE polling GET /payment/orders/{orderCode}/status
    └─ Khi status = "Paid" → hiển thị thông báo thành công
```

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
| `ALREADY_SUBSCRIBED` | 400 | Đã có subscription active cùng tier |
| `PAYMENT_GATEWAY_ERROR` | 502 | payOS API lỗi |
| `ORDER_NOT_FOUND` | 404 | Không tìm thấy đơn hàng |
| `INVALID_SIGNATURE` | 400 | Webhook signature không hợp lệ |

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


---




> Tất cả endpoints yêu cầu JWT 🔒. **Không tốn quota** ở bước Analyze.

### Flow tổng quan

```
Bước 1: ANALYZE          Bước 2: REFINE           Bước 3: GENERATE
POST /content/image/analyze  →  FE collect answers  →  POST /content/image/generate
(1 AI call)                     (không gọi BE)          (1-2 AI calls)
```

---

### 13.1 Bước 1 — Analyze

**`POST /content/image/analyze`** 🔒 — Không tốn quota

**User story:** Sau khi tạo content xong, user nhấn "Tạo hình ảnh". AI đọc content, phân tích ngành nghề, trả về tóm tắt hình ảnh phù hợp + 3 câu hỏi clarifying + draft prompt sơ bộ.

```json
// Request — dùng contentHistoryId (lấy từ GET /content/history)
{
  "contentHistoryId": 23,
  "platform": "Facebook"
}

// Request — hoặc truyền thẳng text
{
  "contentText": "Chỉ còn 3 lô cuối ven sông Quận 7 — giá tăng 15% sau Tết. Nhắn tin ngay để giữ chỗ!",
  "platform": "Facebook"
}

// Response 200
{
  "imageSummary": "Banner BĐS cao cấp ven sông Quận 7, tone tối sang trọng, nhấn mạnh vị trí độc đáo và cảm giác khan hiếm. Ánh sáng vàng hoàng hôn phản chiếu trên mặt sông.",
  "draftPrompt": "Luxury riverside property Ho Chi Minh City, aerial view, golden hour lighting, dark premium aesthetic, modern architecture, river reflection...",
  "detectedIndustry": "real_estate",
  "clarifyingQuestions": [
    {
      "id": "q1",
      "question": "Bạn có muốn thêm ảnh thực tế của bất động sản vào banner không?",
      "type": "yesno"
    },
    {
      "id": "q2",
      "question": "Tone màu bạn muốn:",
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

**Các loại câu hỏi (`type`):**

| Type | Mô tả | FE render |
|------|-------|-----------|
| `yesno` | Có/Không | 2 button |
| `choice` | Chọn 1 trong nhiều | Radio hoặc button group |
| `text_optional` | Nhập text tùy chọn | Input field, có thể bỏ trống |

**`detectedIndustry` có thể là:** `real_estate`, `fashion`, `food`, `tech`, `finance`, `beauty`, `fitness`, `education`, `other`

---

### 13.2 Bước 2 — Refine (FE only, không gọi BE)

FE hiển thị UI wizard với các câu hỏi từ bước 1. User trả lời → FE lưu answers vào state.

```
┌─────────────────────────────────────────────────────┐
│ 🎨 AI phân tích: Banner BĐS ven sông Quận 7         │
│ tone tối sang trọng, ánh hoàng hôn trên sông        │
│                                                     │
│ ❓ Thêm ảnh thực tế BĐS?    [Có ✓]  [Không]        │
│ ❓ Tone màu?  [Tối ✓]  [Sáng]  [Tự nhiên]          │
│ ❓ Caption: [Chỉ còn 3 lô — Giá tăng sau Tết]      │
│                                                     │
│              [← Quay lại]  [Tạo ảnh →]             │
└─────────────────────────────────────────────────────┘
```

---

### 13.3 Bước 3 — Generate

**`POST /content/image/generate`** 🔒

**User story:** User nhấn "Tạo ảnh" sau khi trả lời câu hỏi. AI build final prompt chuyên nghiệp theo BANNER FORMULA, tinh chỉnh thêm bằng AI, rồi tạo ảnh (nếu có image model key) hoặc trả về prompt để dùng với Midjourney/DALL-E.

```json
// Request
{
  "contentHistoryId": 23,
  "platform": "Facebook",
  "draftPrompt": "Luxury riverside property Ho Chi Minh City, aerial view, golden hour lighting...",
  "detectedIndustry": "real_estate",
  "answers": {
    "q1": "yes",
    "q2": "Tối & sang trọng",
    "q3": "Chỉ còn 3 lô — Giá tăng sau Tết"
  }
}

// Response 200 — khi có image model key
{
  "imageUrl": "https://cdn.openai.com/generated/...",
  "finalPrompt": "Luxury riverside property Ho Chi Minh City, dark luxury, deep charcoal background, gold accents, dramatic lighting, luxury real estate photography, architectural visualization, golden hour lighting, river view background, 1200x630 banner, 1.91:1 aspect ratio, 8K quality, commercial photography, with real product prominently featured, rule of thirds composition, text overlay: 'Chỉ còn 3 lô — Giá tăng sau Tết' in bold white sans-serif font, high contrast, urgency badge 'HOT DEAL' in corner",
  "bannerSpecs": {
    "platform": "Facebook",
    "dimensions": "1200x630",
    "aspectRatio": "1.91:1",
    "recommendedStyle": "Bold text, high contrast, product-focused"
  },
  "isGenerated": true,
  "promptUsageTip": null
}

// Response 200 — khi chưa có image model key (trả về prompt để dùng ngoài)
{
  "imageUrl": null,
  "finalPrompt": "Luxury riverside property Ho Chi Minh City, dark luxury...",
  "bannerSpecs": { ... },
  "isGenerated": false,
  "promptUsageTip": "Copy prompt trên và dùng với: Midjourney (/imagine), DALL-E 3 (ChatGPT Plus), hoặc Adobe Firefly để tạo ảnh miễn phí."
}
```

**Khi `isGenerated = false`**, FE nên hiển thị:
- `finalPrompt` trong textarea để user copy
- Nút "Copy prompt" + link đến Midjourney/DALL-E
- `promptUsageTip` như hướng dẫn

---

### 13.4 Platform specs tự động

| Platform | Dimensions | Aspect Ratio |
|----------|-----------|--------------|
| Facebook | 1200×630 | 1.91:1 |
| Instagram | 1080×1080 | 1:1 |
| TikTok | 1080×1920 | 9:16 |
| Zalo | 1200×628 | 1.91:1 |
| LinkedIn | 1200×627 | 1.91:1 |
| Twitter/X | 1600×900 | 16:9 |

---

### 13.5 Kích hoạt image generation thật

Để `isGenerated = true`, admin cần thêm key có `supportsImageGen = true` và `modelOverride` trỏ đến image model.

**Model free hỗ trợ tạo ảnh trên OpenRouter:**

| Model ID | Tên | Free? | Chất lượng |
|----------|-----|-------|-----------|
| `x-ai/grok-imagine-image-quality` | Grok Imagine Image Quality | ✅ Free | Photorealistic 1K/2K |
| `openai/gpt-4o` | GPT-4o | ❌ Trả phí | Multimodal cao cấp |
| `google/gemini-2.0-flash` | Gemini 2.0 Flash | ❌ Trả phí | Nhanh, đa phương thức |

**Thêm key Grok Image (free):**

```json
POST /admin/api-keys
{
  "label": "OpenRouter-Grok-Image",
  "keyValue": "sk-or-v1-YOUR_KEY_HERE",
  "provider": "openrouter",
  "modelOverride": "x-ai/grok-imagine-image-quality",
  "supportsImageGen": true,
  "notes": "Grok free image generation — photorealistic 1K/2K"
}
```

**Cơ chế hoạt động:**
- Gọi `/api/v1/chat/completions` với `modalities: ["image"]`
- Response trả về ảnh dạng base64 data URL hoặc hosted URL
- `imageUrl` trong response có thể là `data:image/png;base64,...` hoặc `https://...`
- FE cần xử lý cả 2 dạng khi hiển thị ảnh

---

## 14. API Key Management nâng cấp *(CẬP NHẬT)*

### 14.1 Thay đổi so với phiên bản cũ

**Mã hóa AES-256:** Tất cả key được mã hóa trước khi lưu vào DB. FE không bao giờ nhận được giá trị key thật — chỉ nhận `keySuffix` (4 ký tự cuối).

**Fields mới trong `POST /admin/api-keys`:**

```json
{
  "label": "OpenRouter-Gemini25",
  "keyValue": "sk-or-v1-...",
  "provider": "openrouter",
  "modelOverride": "google/gemini-2.5-flash-preview:free",
  "supportsImageGen": false,
  "notes": "Gemini 2.5 Flash free tier"
}
```

| Field mới | Kiểu | Mô tả |
|-----------|------|-------|
| `provider` | string | `openrouter` \| `groq` \| `openai` \| `gemini`. Để trống = auto-detect từ key prefix |
| `modelOverride` | string? | Model ID cụ thể. Null = dùng model mặc định |
| `supportsImageGen` | bool | Model có hỗ trợ generate ảnh không |

**Response `GET /admin/api-keys` có thêm:**

```json
{
  "id": 3,
  "label": "OpenRouter-Gemini25",
  "keySuffix": "ae3",
  "provider": "openrouter",
  "modelOverride": "google/gemini-2.5-flash-preview:free",
  "supportsImageGen": false,
  "isActive": true,
  "isEncrypted": true,
  "notes": "Gemini 2.5 Flash free tier"
}
```

---

### 14.2 Danh sách models hỗ trợ

**`GET /admin/models`** 🔒 Admin

**User story:** Admin xem danh sách models có thể dùng để cấu hình cho từng key.

```json
// Response 200
{
  "total": 16,
  "freeModels": [
    { "provider": "openrouter", "modelId": "meta-llama/llama-4-scout",             "displayName": "Llama 4 Scout (Free)",           "supportsImageGen": false, "isFree": true },
    { "provider": "openrouter", "modelId": "google/gemini-2.5-flash-preview:free", "displayName": "Gemini 2.5 Flash Preview (Free)", "supportsImageGen": false, "isFree": true },
    { "provider": "openrouter", "modelId": "deepseek/deepseek-r1:free",            "displayName": "DeepSeek R1 (Free)",             "supportsImageGen": false, "isFree": true },
    { "provider": "groq",       "modelId": "meta-llama/llama-4-scout-17b-16e-instruct", "displayName": "Llama 4 Scout 17B (Groq)", "supportsImageGen": false, "isFree": true },
    { "provider": "groq",       "modelId": "llama-3.1-8b-instant",                "displayName": "Llama 3.1 8B Instant (Groq)",    "supportsImageGen": false, "isFree": true }
  ],
  "imageModels": [
    { "provider": "openrouter", "modelId": "x-ai/grok-imagine-image-quality",     "displayName": "Grok Imagine Image Quality (Free)", "supportsImageGen": true,  "isFree": true  },
    { "provider": "openrouter", "modelId": "openai/gpt-4o",                        "displayName": "GPT-4o (Vision+Text)",              "supportsImageGen": true,  "isFree": false },
    { "provider": "openrouter", "modelId": "google/gemini-2.0-flash",              "displayName": "Gemini 2.0 Flash (Vision)",         "supportsImageGen": true,  "isFree": false },
    { "provider": "openrouter", "modelId": "anthropic/claude-3.5-sonnet",          "displayName": "Claude 3.5 Sonnet (Vision)",        "supportsImageGen": true,  "isFree": false }
  ]
}
```

---

## Phụ lục — Changelog

### v2.1 — 30/05/2026 *(mới nhất)*

**Thêm mới:**
- `POST /content/image/analyze` — Bước 1 Image Wizard: AI phân tích content, trả về imageSummary + clarifyingQuestions + draftPrompt
- `POST /content/image/generate` — Bước 3 Image Wizard: build final prompt + tạo ảnh (nếu có image key) hoặc trả về prompt
- `GET /admin/models` — Danh sách free models + image models hỗ trợ
- `ApiKeyEncryptionService` — Mã hóa AES-256 cho tất cả key trong DB

**Cập nhật:**
- `POST /admin/api-keys` — Thêm fields: `provider`, `modelOverride`, `supportsImageGen`. Key tự động encrypt khi lưu
- `PUT /admin/api-keys/{id}` — Hỗ trợ update `provider`, `modelOverride`, `supportsImageGen`
- `POST /admin/api-keys/bulk` — Encrypt tất cả keys trong batch
- `GET /admin/api-keys` — Response thêm `isEncrypted`, `modelOverride`, `supportsImageGen`
- `GET /admin/api-keys/status` — Thêm `modelOverride`, `supportsImageGen` trong key status
- `GeminiApiKeyPool` — Load `Provider`/`ModelOverride`/`SupportsImageGen` từ DB, decrypt key khi dùng

**Fix:**
- Xóa User Secrets placeholder đang override `AiProviderKeys` với fake keys
- `GET /admin/api-keys` crash khi 2 keys có cùng 4 ký tự cuối → fix bằng `GroupBy`
- AI 401 retry: tự động xoay sang key tiếp theo khi nhận 401 Unauthorized
- `AllowAutoRedirect = false` trên tất cả AI HttpClients để tránh Authorization header bị strip
- `PersonaDriven` parse failure: log raw AI text + strengthen JSON-only prompt instruction


---

---

# ═══════════════════════════════════════════════════════
# 🆕 TÍNH NĂNG MỚI — v2.2 (01/06/2026)
# ═══════════════════════════════════════════════════════

> Các mục bên dưới là **hoàn toàn mới**, chưa có trong tài liệu cũ.
> Đội FE cần implement thêm 3 flow này.

---

## 13. Image Generation Wizard 🆕

> Tất cả endpoints yêu cầu JWT 🔒.
> **Bước Analyze không tốn quota. Bước Generate tốn 1 quota** (giống tạo content).

### Flow tổng quan

```
Bước 1 — ANALYZE                    Bước 2 — GENERATE
POST /content/image/analyze    →    POST /content/image/generate
(AI phân tích, trả câu hỏi)         (User trả lời → AI tạo ảnh)
Không tốn quota                      Tốn 1 quota
```

---

### 13.1 Bước 1 — Analyze

**`POST /content/image/analyze`** 🔒 — **Không tốn quota**

AI đọc content, phát hiện ngành nghề, trả về `draftPrompt` + tối đa 3 câu hỏi clarifying + thông số banner theo platform.

```json
// Request — dùng content history đã lưu
{
  "contentHistoryId": 23,
  "platform": "Facebook"
}

// Request — hoặc truyền thẳng text
{
  "contentText": "Ra mắt căn hộ cao cấp The Grand tại TP.HCM. View sông Sài Gòn, tiện ích 5 sao. Giá từ 3.5 tỷ.",
  "platform": "Facebook"
}
```

```json
// Response 200
{
  "imageSummary": "Banner BĐS cao cấp ven sông, tone tối sang trọng, ánh hoàng hôn vàng ấm.",
  "draftPrompt": "Luxury apartment interior, Saigon river view, modern architecture, golden hour lighting",
  "detectedIndustry": "real_estate",
  "clarifyingQuestions": [
    {
      "id": "q1",
      "question": "Bạn có muốn thêm ảnh thực tế của bất động sản vào banner không?",
      "type": "yesno"
    },
    {
      "id": "q2",
      "question": "Tone màu bạn muốn:",
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

**Loại câu hỏi (`type`) — FE render tương ứng:**

| `type` | FE render |
|--------|-----------|
| `yesno` | 2 button: Có / Không |
| `choice` | Radio group hoặc button group từ `options[]` |
| `text_optional` | Input text, có thể bỏ trống |

**`detectedIndustry` có thể là:** `real_estate` · `fashion` · `food` · `tech` · `finance` · `beauty` · `fitness` · `education` · `other`

---

### 13.2 Bước 2 — Generate

**`POST /content/image/generate`** 🔒 — **Tốn 1 quota**

Nhận `draftPrompt` + `detectedIndustry` từ bước 1, cộng với answers của user → AI build final prompt → tạo ảnh qua Pollinations.ai.

```json
// Request
{
  "contentHistoryId": 23,
  "platform": "Facebook",
  "draftPrompt": "Luxury apartment interior, Saigon river view, modern architecture, golden hour lighting",
  "detectedIndustry": "real_estate",
  "answers": {
    "q1": "no",
    "q2": "Tối & sang trọng",
    "q3": ""
  }
}
```

> ⚠️ **Lưu ý quan trọng về `answers`:**
> - `q1`: `"yes"` hoặc `"no"` (hoặc `"có"` / `"không"`)
> - `q2`: truyền đúng giá trị từ `options[]` — ví dụ `"Tối & sang trọng"`
> - `q3`: nếu user không nhập caption thì truyền `""` hoặc bỏ qua key — **không truyền giá trị của q2 vào đây**

```json
// Response 200 — ảnh được tạo thành công
{
  "imageUrl": "https://image.pollinations.ai/prompt/Luxury%20apartment%20interior,...?width=1200&height=630&seed=54321&nologo=true&model=flux&enhance=true&token=...",
  "finalPrompt": "Luxury apartment interior, Saigon river view, dark luxury, charcoal background, gold accents, 1200x630, 8K, photorealistic, commercial banner",
  "bannerSpecs": {
    "platform": "Facebook",
    "dimensions": "1200x630",
    "aspectRatio": "1.91:1",
    "recommendedStyle": "Bold text, high contrast, product-focused"
  },
  "isGenerated": true,
  "promptUsageTip": null
}

// Response 200 — chưa có image key (chỉ trả prompt)
{
  "imageUrl": null,
  "finalPrompt": "Luxury apartment interior...",
  "bannerSpecs": { "..." },
  "isGenerated": false,
  "promptUsageTip": "Copy prompt trên và dùng với: Midjourney (/imagine), DALL-E 3 (ChatGPT Plus), hoặc Adobe Firefly để tạo ảnh miễn phí."
}

// Response 429 — hết quota
{
  "code": "QUOTA_EXCEEDED",
  "tier": "Free",
  "remainingQuota": 0,
  "dailyLimit": 5,
  "message": "Bạn đã dùng hết 5 lượt/ngày của gói Free..."
}
```

**Cách FE hiển thị ảnh:**

```html
<!-- imageUrl là direct URL đến JPEG — dùng thẳng làm src -->
<img src="{{ imageUrl }}" alt="AI Generated Banner" />
```

> ⚠️ Pollinations mất 5–15 giây để generate lần đầu. FE nên hiển thị loading skeleton trong lúc chờ ảnh load.

---

### 13.3 Platform specs tự động

| Platform | Dimensions | Aspect Ratio |
|----------|-----------|--------------|
| Facebook | 1200×630 | 1.91:1 |
| Instagram | 1080×1080 | 1:1 |
| TikTok | 1080×1920 | 9:16 |
| Zalo | 1200×628 | 1.91:1 |
| LinkedIn | 1200×627 | 1.91:1 |
| Twitter/X | 1600×900 | 16:9 |

---

### 13.4 Kích hoạt image generation (Admin)

Admin thêm Pollinations key vào DB — pool tự reload, không cần restart:

```json
POST /admin/api-keys
Authorization: Bearer <admin-token>

{
  "label": "Pollinations-Key1",
  "keyValue": "sk_xxxxxxxxxxxxxxxx",
  "provider": "pollinations",
  "supportsImageGen": true,
  "notes": "Pollinations.ai image generation"
}
```

> Key prefix `sk_` được auto-detect là `provider = "pollinations"`. Nếu không truyền `provider`, hệ thống tự detect từ prefix.

---

<a name="quota-image"></a>
### 13.5 Quota cho Image Generation

| Endpoint | Tốn quota? |
|----------|-----------|
| `POST /content/image/analyze` | ❌ Không |
| `POST /content/image/generate` | ✅ **1 quota** |

Sau khi generate, FE nên gọi `GET /auth/quota` để cập nhật số lượt còn lại.

---

## 14. Đổi mật khẩu qua OTP Email 🆕

### Flow

```
POST /auth/forgot-password   →   Nhận email → gửi OTP 6 số về mail (hết hạn 10 phút)
        ↓
POST /auth/reset-password    →   Xác nhận OTP + mật khẩu mới → đổi mật khẩu
```

---

### 14.1 Gửi OTP

**`POST /auth/forgot-password`** — Không cần auth

> Luôn trả `200` dù email có tồn tại hay không — tránh email enumeration attack.

```json
// Request
{
  "email": "user@example.com"
}

// Response 200 — luôn trả về thông báo này
{
  "message": "Nếu email tồn tại, mã OTP đã được gửi."
}
```

**Hành vi:**
- OTP 6 chữ số, hết hạn sau **10 phút**
- Nếu user request OTP mới, OTP cũ bị vô hiệu hoá ngay
- Email gửi từ `khoaai2009@gmail.com` với subject: `Mã xác nhận đặt lại mật khẩu — SocialSense`

---

### 14.2 Đặt lại mật khẩu

**`POST /auth/reset-password`** — Không cần auth

```json
// Request
{
  "email": "user@example.com",
  "otpCode": "482931",
  "newPassword": "NewPassword123!"
}

// Response 200
{
  "message": "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại."
}

// Response 400 — OTP sai hoặc hết hạn
{
  "code": "OTP_INVALID_OR_EXPIRED",
  "message": "Mã OTP không hợp lệ hoặc đã hết hạn."
}

// Response 400 — user không tồn tại
{
  "code": "USER_NOT_FOUND",
  "message": "Tài khoản không tồn tại."
}
```

**Sau khi đổi mật khẩu thành công:**
- Tất cả refresh token hiện tại bị **revoke** → user bị đăng xuất khỏi tất cả thiết bị
- FE nên redirect về trang login

---

### 14.3 Validation

| Field | Rule |
|-------|------|
| `email` | Valid email format |
| `otpCode` | Đúng 6 ký tự số |
| `newPassword` | Tối thiểu 6 ký tự |

---

### 14.4 UX gợi ý cho FE

```
[Trang Login]
  └─ "Quên mật khẩu?" → [Trang Forgot Password]
        └─ Nhập email → POST /auth/forgot-password
              └─ Hiển thị: "Kiểm tra email của bạn"
                    └─ [Trang Reset Password]
                          └─ Nhập OTP (6 ô) + mật khẩu mới
                                └─ POST /auth/reset-password
                                      └─ Thành công → redirect Login
```

**Lưu ý UX:**
- Hiển thị countdown timer 10 phút cho OTP
- Nút "Gửi lại OTP" sau 60 giây (gọi lại `forgot-password`)
- Input OTP nên là 6 ô riêng biệt (auto-focus next)

---

## 15. Welcome Email 🆕

### Mô tả

Sau khi user đăng ký thành công qua `POST /auth/register`, hệ thống **tự động gửi email chào mừng** — FE không cần làm gì thêm.

**Thông tin email:**
- **From:** `SocialSense <khoaai2009@gmail.com>`
- **Subject:** `Chào mừng bạn đến với SocialSense! 🥳`
- **Nội dung:** Tên hiển thị, email đăng nhập, nút CTA "Khám phá ngay"
- **Design:** Tone trắng-đen, logo SVG inline, phong cách tối giản

**Lưu ý:** Nếu SMTP lỗi, đăng ký vẫn thành công — email fail không block response.

---

## Phụ lục — Error Codes mới (v2.2)

| Code | HTTP | Mô tả |
|------|------|-------|
| `OTP_INVALID_OR_EXPIRED` | 400 | OTP sai hoặc đã hết hạn 10 phút |
| `IMAGE_CONTENT_REQUIRED` | 400 | Cần truyền `contentHistoryId` hoặc `contentText` |
| `IMAGE_DRAFT_PROMPT_REQUIRED` | 400 | Cần truyền `draftPrompt` từ bước Analyze |

---

## Phụ lục — Changelog

### v2.2 — 01/06/2026 *(mới nhất)*

**Thêm mới:**
- `POST /content/image/analyze` — Bước 1 Image Wizard: AI phân tích content, trả về `imageSummary` + `clarifyingQuestions` + `draftPrompt` + `bannerSpecs`. Không tốn quota.
- `POST /content/image/generate` — Bước 2 Image Wizard: build final prompt + tạo ảnh qua Pollinations.ai. **Tốn 1 quota.**
- `POST /auth/forgot-password` — Gửi OTP 6 số về email, hết hạn 10 phút
- `POST /auth/reset-password` — Xác nhận OTP + đặt lại mật khẩu, revoke tất cả refresh token
- Welcome email tự động sau `POST /auth/register`

**Cập nhật:**
- `POST /admin/api-keys` — Hỗ trợ `provider = "pollinations"` cho image generation key. Auto-detect từ prefix `sk_`.
- Quota system — `POST /content/image/generate` giờ tốn 1 quota, có reset hàng ngày và check Enterprise unlimited.

### v2.1 — 30/05/2026

- Image Wizard endpoints (analyze + generate) — phiên bản đầu, chưa có quota
- `GET /admin/models` — danh sách models hỗ trợ
- `ApiKeyEncryptionService` — mã hóa AES-256 cho tất cả key trong DB
- `POST /admin/api-keys` — thêm fields `provider`, `modelOverride`, `supportsImageGen`
