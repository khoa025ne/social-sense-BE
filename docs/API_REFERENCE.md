# SocialSense BE — Tài liệu API Toàn diện & Hoàn chỉnh (v2.3)

> **Base URL (dev):** `http://localhost:5280`
> **Base URL (https):** `https://localhost:7149`
> **Auth:** JWT Bearer Token — thêm header `Authorization: Bearer <token>` cho mọi endpoint có ký hiệu 🔒

---

## Mục lục

1. [Kiến trúc & Quy tắc chung](#1-kiến-trúc--quy-tắc-chung)
2. [Hệ thống Quota & Tier](#2-hệ-thống-quota--tier)
3. [Xác thực & Quản lý Tài khoản (Auth)](#3-xác-thực--quản-lý-tài-khoản-auth)
4. [Context / Persona](#4-context--persona)
5. [Content — Tạo nội dung AI](#5-content--tạo-nội-dung-ai)
6. [Image Generation Wizard](#6-image-generation-wizard)
7. [Personal Analytics — Phân tích số liệu](#7-personal-analytics--phân-tích-số-liệu)
8. [Trends & Tags — Xu hướng](#8-trends--tags--xu-hướng)
9. [Knowledge Base — Kho tri thức](#9-knowledge-base--kho-tri-thức)
10. [Payment & Subscriptions — Thanh toán](#10-payment--subscriptions--thanh-toán)
11. [Admin Panel — Quản trị hệ thống](#11-admin-panel--quản-trị-hệ-thống)
12. [Phụ lục A — Bảng mã lỗi (Error Codes)](#phụ-lục-a--bảng-mã-lỗi-error-codes)
13. [Phụ lục B — Seed Data mặc định](#phụ-lục-b--seed-data-mặc-định)
14. [Changelog](#changelog)

---

## 1. Kiến trúc & Quy tắc chung

```
FE (React/Vue/HTML)
    │
    ▼ HTTP/HTTPS (JWT Bearer Auth)
ASP.NET Core 8 API
    ├── JWT Auth (HS256)
    ├── QuotaCheckFilter (trước mỗi /content/generate và /analytics/...)
    ├── Controllers (Auth, Context, Content, Image, Analytics, Trends, Knowledge, Payment, Admin)
    │
    ├── Services
    │   ├── ApiKeyEncryptionService — Mã hóa AES-256 cho API keys
    │   ├── GeminiApiKeyPool        — Luân chuyển API keys thông minh (Groq/OpenRouter/Pollinations)
    │   ├── ContentGeneratorService — Sinh content AI (TrendBased/PersonaDriven)
    │   ├── IImageGenerationService — Tích hợp sinh ảnh banner (Pollinations/DALL-E 3)
    │   ├── IAnalyticsService       — Phân tích số liệu từ Excel và sinh báo cáo AI
    │   ├── KnowledgeIngestionService — Nạp tài liệu (docx, pdf, txt, web scrape)
    │   └── SmtpEmailService        — Gửi OTP đặt lại mật khẩu và Welcome Email
    │
    └── MySQL (EF Core, lưu trữ người dùng, lịch sử, giao dịch)
```

### Quy tắc phản hồi (Response Rules)
- Mọi phản hồi thành công thường đi kèm mã HTTP `200 OK` hoặc `201 Created`.
- Phản hồi lỗi tuân theo cấu trúc JSON chuẩn:
  ```json
  {
    "code": "MÃ_LỖI_HỆ_THỐNG",
    "message": "Thông tin chi tiết về lỗi bằng tiếng Việt hoặc tiếng Anh."
  }
  ```

---

## 2. Hệ thống Quota & Tier

Hệ thống áp dụng giới hạn lượt gọi AI hàng ngày (Daily Quota) dựa trên phân hạng tài khoản (Tier):

| Tier | DailyQuotaLimit | Ghi chú |
|------|----------------|---------|
| **Free** | 5 lượt/ngày | Gán tự động khi đăng ký |
| **Pro** | 50 lượt/ngày | Sau khi thanh toán gói Pro |
| **Enterprise / Ultra** | 500 lượt/ngày (hoặc -1) | Nâng cấp thủ công hoặc qua gói Ultra. `-1` đại diện cho Unlimited. |

**Quy tắc hoạt động của Quota:**
- Quota tự động reset về `DailyQuotaLimit` vào đầu ngày mới (0h UTC) khi người dùng thực hiện request đầu tiên trong ngày.
- Các endpoint tốn quota:
  - `POST /content/generate` (Sinh nội dung - 1 quota)
  - `POST /content/image/generate` (Sinh hình ảnh - 1 quota)
  - `POST /analytics/analyze` (Phân tích 1 kỳ - 1 quota)
  - `POST /analytics/compare` (So sánh 2 kỳ - 1 quota)
  - `POST /analytics/upload-and-compare` (Upload & so sánh - 1 quota)
- **Chỉ trừ quota khi AI xử lý thành công**. Nếu có lỗi hệ thống hoặc lỗi API của bên thứ ba, quota của người dùng sẽ không bị trừ.

---

## 3. Xác thực & Quản lý Tài khoản (Auth)

### 3.1 Đăng ký tài khoản
**`POST /auth/register`** — Không yêu cầu token

Đăng ký tài khoản mới. Tài khoản tạo xong sẽ được tự động gán vai trò `User`, Tier `Free` và gửi một **Welcome Email** tự động.

* **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!",
    "displayName": "Nguyễn Văn An"
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "message": "User registered successfully.",
    "userId": 11
  }
  ```
* **Response 400 Bad Request (Email đã tồn tại):**
  ```json
  {
    "code": "AUTH_EMAIL_EXISTS",
    "message": "Email already registered."
  }
  ```

### 3.2 Đăng nhập
**`POST /auth/login`** — Không yêu cầu token

* **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "userId": 11,
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMSIs...",
    "refreshToken": "uG8Jm9v7XN2z5YhL...",
    "email": "user@example.com",
    "displayName": "Nguyễn Văn An",
    "hasContext": false
  }
  ```
  > [!NOTE]
  > Nếu `hasContext = false`, Frontend nên chuyển hướng người dùng tới trang Onboarding khảo sát Persona trước khi sử dụng các tính năng sinh nội dung.

* **Response 401 Unauthorized:**
  ```json
  {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email or password."
  }
  ```

### 3.3 Làm mới Token (Refresh Token)
**`POST /auth/refresh`** — Không yêu cầu token

Dùng để lấy cặp `accessToken` và `refreshToken` mới khi token cũ hết hạn (AccessToken có hạn 60 phút, RefreshToken có hạn 7 ngày).

* **Request Body:**
  ```json
  {
    "refreshToken": "uG8Jm9v7XN2z5YhL..."
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "userId": 11,
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC...",
    "refreshToken": "newRefreshTokenString...",
    "email": "user@example.com",
    "displayName": "Nguyễn Văn An",
    "hasContext": true
  }
  ```
* **Response 401 Unauthorized:**
  ```json
  {
    "code": "AUTH_INVALID_REFRESH_TOKEN",
    "message": "Invalid or expired refresh token."
  }
  ```

### 3.4 Xem thông tin cá nhân hiện tại
**`GET /auth/me`** 🔒

Lấy thông tin tài khoản của user đang đăng nhập dựa vào Access Token.

* **Response 200 OK:**
  ```json
  {
    "id": 11,
    "email": "user@example.com",
    "displayName": "Nguyễn Văn An",
    "hasContext": true,
    "tier": "Free",
    "dailyQuotaLimit": 5,
    "remainingQuota": 3,
    "isUnlimited": false,
    "roles": ["User"]
  }
  ```

### 3.5 Xem Quota của người dùng hiện tại
**`GET /auth/quota`** 🔒

Dùng để hiển thị hạn mức sử dụng thời gian thực trên giao diện người dùng.

* **Response 200 OK:**
  ```json
  {
    "userId": 11,
    "tier": "Free",
    "dailyQuotaLimit": 5,
    "remainingQuota": 3,
    "usedToday": 2,
    "isUnlimited": false,
    "usagePercent": 40.0,
    "lastQuotaReset": "2026-06-15T00:00:00Z",
    "nextResetAt": "2026-06-16T00:00:00Z",
    "tierBenefits": {
      "free": "5 lượt/ngày",
      "pro": "50 lượt/ngày",
      "enterprise": "500 lượt/ngày hoặc Unlimited"
    }
  }
  ```

### 3.6 Xem Quota của user khác theo ID
**`GET /auth/users/{id}/quota`** 🔒

Cho phép người dùng tự xem quota của mình hoặc Admin xem quota của bất kỳ user nào trong hệ thống. Nếu user thường xem ID khác sẽ nhận về lỗi `403 Forbidden`.

### 3.7 Yêu cầu cấp OTP quên mật khẩu
**`POST /auth/forgot-password`** — Không yêu cầu token

Hệ thống sẽ tạo mã OTP gồm 6 chữ số gửi tới email người dùng, hiệu lực trong **10 phút**. Để tăng tính bảo mật chống tấn công rò quét email, endpoint này **luôn trả về HTTP 200** kèm thông báo chung.

* **Request Body:**
  ```json
  {
    "email": "user@example.com"
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "message": "Nếu email tồn tại, mã OTP đã được gửi."
  }
  ```

### 3.8 Đặt lại mật khẩu bằng mã OTP
**`POST /auth/reset-password`** — Không yêu cầu token

Sử dụng mã OTP nhận được từ email để đặt mật khẩu mới. Thành công sẽ thu hồi tất cả Refresh Token hoạt động khác, đăng xuất người dùng khỏi mọi thiết bị.

* **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "otpCode": "184029",
    "newPassword": "NewPassword123!"
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "message": "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại."
  }
  ```
* **Response 400 Bad Request:**
  ```json
  {
    "code": "OTP_INVALID_OR_EXPIRED",
    "message": "Mã OTP không hợp lệ hoặc đã hết hạn."
  }
  ```

### 3.9 Đổi mật khẩu chủ động
**`PUT /auth/change-password`** 🔒

Yêu cầu người dùng đang đăng nhập nhập mật khẩu hiện tại để đổi sang mật khẩu mới. Đổi mật khẩu thành công sẽ thu hồi toàn bộ Refresh Token của user đó.

* **Request Body:**
  ```json
  {
    "currentPassword": "Password123!",
    "newPassword": "NewPassword123!"
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "message": "Đổi mật khẩu thành công. Vui lòng đăng nhập lại."
  }
  ```
* **Response 400 Bad Request (Mật khẩu cũ không chính xác hoặc trùng mật khẩu mới):**
  ```json
  {
    "code": "AUTH_WRONG_PASSWORD",
    "message": "Mật khẩu hiện tại không đúng."
  }
  ```

### 3.10 Cập nhật thông tin tài khoản
**`PUT /auth/profile`** 🔒

* **Request Body:**
  ```json
  {
    "displayName": "Nguyễn Văn Bình"
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "message": "Cập nhật thông tin thành công.",
    "displayName": "Nguyễn Văn Bình",
    "email": "user@example.com"
  }
  ```

---

## 4. Context / Persona

> [!IMPORTANT]
> Toàn bộ API quản lý Persona tự động trích xuất `userId` từ JWT Token. Frontend không cần truyền `userId` vào URL hay Body.

### 4.1 Onboarding — AI trích xuất Persona
**`POST /context/onboarding`** 🔒

Gửi câu trả lời khảo sát gồm tối thiểu 3 câu hỏi bằng tiếng Việt hoặc tiếng Anh. AI sẽ tự động phân tích và tạo một bộ khung Persona thương hiệu chuẩn lưu vào cơ sở dữ liệu.

* **Request Body:**
  ```json
  {
    "language": "vi",
    "answers": [
      "Tôi kinh doanh thời trang nam cao cấp, chuyên cung cấp các mẫu vest công sở, quần tây và áo sơ mi phom dáng lịch lãm.",
      "Khách hàng của tôi là nam giới công sở, doanh nhân trẻ từ 25 đến 45 tuổi.",
      "Tôi muốn truyền tải thông điệp về sự tự tin, phong thái lịch lãm của người đàn ông thành đạt."
    ]
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "personaVersion": 1,
    "status": "done"
  }
  ```

### 4.2 Xem Persona hiện tại
**`GET /context/persona`** 🔒

* **Response 200 OK:**
  ```json
  {
    "userId": 11,
    "version": 1,
    "language": "vi",
    "jobTitle": "Thương hiệu Thời trang Nam Lịch lãm",
    "toneOfVoice": "Trưởng thành, Lịch thiệp, Tự tin và Đáng tin cậy",
    "platformPreferences": ["Facebook", "LinkedIn"],
    "targetAudience": ["Nam giới công sở", "Doanh nhân trẻ", "Quý ông lịch lãm"],
    "contentFormats": ["Bài đăng chia sẻ mẹo phối đồ", "Bài đăng giới thiệu sản phẩm mới"],
    "negativeConstraints": ["Hình ảnh mặc đồ hở hang", "Giọng điệu cợt nhả"],
    "updatedAt": "2026-06-15T07:30:00Z"
  }
  ```

### 4.3 Cập nhật Persona thủ công
**`PUT /context/persona`** 🔒

Người dùng chỉnh sửa trực tiếp các trường cấu hình Persona mà không cần thông qua khảo sát AI. Chỉ cần truyền những trường cần cập nhật (Partial Update).

* **Request Body:**
  ```json
  {
    "jobTitle": "Thương hiệu Thời trang Nam Lịch lãm - Pha Gent",
    "toneOfVoice": "Trưởng thành, Lịch thiệp, Tự tin và Đáng tin cậy",
    "platformPreferences": ["Facebook", "LinkedIn", "Instagram"],
    "targetAudience": ["Nam giới công sở", "Doanh nhân trẻ", "Quý ông lịch lãm"],
    "contentFormats": ["Mẹo phối đồ", "Giới thiệu sản phẩm mới", "Câu chuyện quý ông"],
    "negativeConstraints": ["Hình ảnh hở hang", "Quảng cáo rẻ tiền", "Ngôn từ giật gân"]
  }
  ```
* **Response 200 OK:** Trả về cấu trúc Persona đã cập nhật hoàn thiện tương tự phản hồi của API `GET`.

---

## 5. Content — Tạo nội dung AI

### 5.1 Tạo nội dung (AI Generate)
**`POST /content/generate`** 🔒 *(Tốn 1 quota nếu sinh thành công)*

Sinh nội dung tự động dựa trên Persona của người dùng và các tri thức có liên quan trong cơ sở dữ liệu (RAG).

* **Các tham số cấu hình chính:**
  - `mode`: Chọn giữa `TrendBased` (Tìm xu hướng hot phù hợp nhất với thương hiệu và lồng ghép tri thức) hoặc `PersonaDriven` (Tập trung thuần túy vào khai thác chân dung Persona cùng các công thức tâm lý hành vi đặc thù theo ngành).
  - `trendId`: Có thể truyền ID của một xu hướng cụ thể. Nếu truyền `null`, AI sẽ tự động so khớp xu hướng thông minh.
  - `generateImage`: Hiện tại trường này đóng vai trò flag định hình banner image prompt trong response. Để sinh ảnh thật, cần sử dụng tính năng **Image Generation Wizard** tiếp sau.

* **Request Body:**
  ```json
  {
    "trendId": null,
    "outputCount": 2,
    "language": "vi",
    "targetPlatforms": ["Facebook", "LinkedIn"],
    "generateImage": false,
    "mode": "PersonaDriven",
    "userInstruction": "Nhấn mạnh vào sản phẩm Quần tây Nam cạp thông minh co giãn nhẹ."
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "items": [
      {
        "platform": "Facebook",
        "hook": "Đầu tháng rồi quý ông ơi! Giữ vững phong độ bắt đầu từ chiếc quần tây chỉn chu.",
        "body": "Một ngày làm việc 8 tiếng tại văn phòng luôn đòi hỏi sự thoải mái tuyệt đối. Chiếc quần tây nam cạp thông minh từ Pha Gent có khả năng co giãn nhẹ, giữ phom đứng chuẩn nam tính và chống nhăn hoàn hảo giúp bạn luôn tự tin...",
        "cta": "Inbox Pha Gent nhận tư vấn size chuẩn và ưu đãi đặt hàng ngay hôm nay!",
        "hashtags": ["thoitrangnam", "quantaynam", "phagent", "quyongcongs"],
        "language": "vi",
        "mediaUrl": null,
        "bannerImagePrompt": "Subtle close-up of a modern man's tailored trousers, focus on fabric texture, clean office setting, natural lighting, professional advertising style",
        "bestTimeToPost": "Thứ Hai lúc 08:30 - Đầu tuần đi làm là thời điểm vàng để nam giới quan tâm trang phục công sở."
      }
    ],
    "selectedTrendTitle": null,
    "smartMatchReason": "Nội dung được sinh thuần từ persona — không phụ thuộc trend."
  }
  ```

### 5.2 Kiểm tra sự tương thích thương hiệu (Brand Alignment Check)
**`POST /content/check-alignment`** 🔒 — *Không tốn quota*

Trợ lý chấm điểm bài nháp viết sẵn của người dùng, phân tích sự lệch pha thương hiệu, chỉ ra điểm yếu tâm lý, và tự động viết lại bài đăng tối ưu hơn.

* **Request Body:**
  ```json
  {
    "draftContent": "Bên mình mới về mấy mẫu quần tây nam đẹp mặc đi làm. Vải mát, bền, giá rẻ. Inbox mình tư vấn nhé."
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "brandScore": 65,
    "analysis": "Bài viết có thông tin nhưng thiếu hook thu hút. Sử dụng từ 'giá rẻ' làm giảm uy tín thương hiệu cao cấp đã thiết lập trong Persona. Giọng điệu còn hơi phổ thông, thiếu đòn bẩy uy tín.",
    "suggestions": "1. Thay thế từ 'giá rẻ' bằng cụm từ 'đầu tư xứng đáng' hoặc 'mức giá tối ưu'. 2. Bổ sung hook đánh vào nỗi đau của dân công sở phải ngồi nhiều (nhăn quần, bí bách). 3. Thêm cam kết phom dáng.",
    "refinedContent": "👔 CHỈN CHU SUỐT 8 TIẾNG CÔNG SỞ — KHÔNG CÒN NỖI LO NHĂN QUẦN\n\nNhiều quý ông phải ngồi làm việc cả ngày thường gặp tình trạng quần tây bị nhăn nhúm và bí bách. Dòng sản phẩm quần tây cao cấp Pha Gent ra mắt giải quyết triệt để nỗi lo đó nhờ chất liệu Cotton Spandex co giãn nhẹ và giữ phom đứng chuẩn nam tính.\n\n👉 Inbox ngay để nhận tư vấn size chuẩn xác từ Pha Gent!"
  }
  ```

### 5.3 Lịch sử tạo nội dung
**`GET /content/history`** 🔒

* **Query Parameters:**
  - `page` (Mặc định: 1)
  - `pageSize` (Mặc định: 10, tối đa 100)
* **Response 200 OK:**
  ```json
  {
    "totalCount": 1,
    "page": 1,
    "pageSize": 10,
    "items": [
      {
        "id": 23,
        "userId": 11,
        "originalTrendId": null,
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
        "createdAt": "2026-06-15T07:35:00Z"
      }
    ]
  }
  ```

### 5.4 Chỉnh sửa nội dung lưu trong lịch sử
**`PUT /content/history/{id}/edit`** 🔒

Cho phép người dùng chỉnh sửa văn bản bài viết đã sinh để lưu trữ phiên bản hoàn thiện sau cùng. Bản sửa đổi sẽ được ghi nhận vào trường `userEditedContent`.

* **Request Body:**
  ```json
  {
    "body": "Nội dung bài viết mới sau khi đã được chỉnh sửa...",
    "hook": "Tiêu đề/Hook mới",
    "cta": "CTA mới",
    "hashtags": ["thoitrangnam", "quantay"]
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "message": "Content history updated successfully."
  }
  ```

---

## 6. Image Generation Wizard

Quy trình tạo ảnh banner chuyên nghiệp tích hợp trí tuệ nhân tạo gồm 2 bước chính trên API:

```
[Bước 1: ANALYZE] (POST /content/image/analyze)
      │  AI phân tích nội dung viết → Trả về ý tưởng + Spec kích thước + 3 Câu hỏi Clarifying
      ▼
[Bước 2: REFINE] (Frontend xử lý hiển thị câu hỏi và lấy câu trả lời của user)
      │
      ▼
[Bước 3: GENERATE] (POST /content/image/generate)
         Tốn 1 Quota. AI build Final Prompt → Gọi Pollinations/DALL-E sinh ảnh trực tiếp.
```

### 6.1 Bước 1 — Phân tích (Analyze)
**`POST /content/image/analyze`** 🔒 — *Không tốn quota*

* **Request Body:** Có thể truyền `contentHistoryId` (lấy từ lịch sử) hoặc truyền trực tiếp chuỗi văn bản `contentText`.
  ```json
  {
    "contentHistoryId": 23,
    "platform": "Facebook"
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "imageSummary": "Ảnh chụp cận cảnh chất liệu vải quần tây nam, tông màu xám lạnh sang trọng, đặt trong không gian văn phòng làm việc hiện đại.",
    "draftPrompt": "Tailored pants fabric detail, premium gray color, modern office background, soft lighting",
    "detectedIndustry": "fashion",
    "clarifyingQuestions": [
      {
        "id": "q1",
        "question": "Bạn có muốn hiển thị thêm logo thương hiệu trên góc banner không?",
        "type": "yesno"
      },
      {
        "id": "q2",
        "question": "Tông màu chủ đạo mong muốn:",
        "type": "choice",
        "options": ["Tối & sang trọng", "Sáng & thanh lịch", "Ấm áp & cổ điển"]
      },
      {
        "id": "q3",
        "question": "Nhập đoạn text phụ muốn ghi đè lên ảnh (nếu có):",
        "type": "text_optional"
      }
    ],
    "bannerSpecs": {
      "platform": "Facebook",
      "dimensions": "1200x630",
      "aspectRatio": "1.91:1",
      "recommendedStyle": "Minimalist, fabric-focused, high contrast text"
    }
  }
  ```

### 6.2 Bước 2 — Sinh ảnh (Generate)
**`POST /content/image/generate`** 🔒 *(Tốn 1 quota)*

* **Request Body:**
  ```json
  {
    "contentHistoryId": 23,
    "platform": "Facebook",
    "draftPrompt": "Tailored pants fabric detail, premium gray color, modern office background, soft lighting",
    "detectedIndustry": "fashion",
    "answers": {
      "q1": "no",
      "q2": "Tối & sang trọng",
      "q3": "Pha Gent - Lịch lãm quý ông"
    }
  }
  ```
  > [!CAUTION]
  > Key của dictionary `answers` phải khớp chính xác với `id` của câu hỏi nhận được từ bước Analyze (`q1`, `q2`, `q3`). Nếu user bỏ trống câu hỏi text_optional, hãy truyền chuỗi rỗng `""`.

* **Response 200 OK (Trường hợp hệ thống có cấu hình API Key tạo ảnh):**
  ```json
  {
    "imageUrl": "https://image.pollinations.ai/prompt/Tailored%20pants%20fabric%20detail,%20premium%20gray%20color,...?width=1200&height=630&nologo=true&model=flux",
    "finalPrompt": "Tailored pants fabric detail, premium dark gray color, luxury dark charcoal background, soft gold highlights, high contrast, 1200x630 banner format, aspect ratio 1.91:1, photorealistic, cinematic lighting, text overlay 'Pha Gent - Lịch lãm quý ông' in elegant serif font",
    "bannerSpecs": {
      "platform": "Facebook",
      "dimensions": "1200x630",
      "aspectRatio": "1.91:1",
      "recommendedStyle": "Minimalist, fabric-focused, high contrast text"
    },
    "isGenerated": true,
    "promptUsageTip": null
  }
  ```

* **Response 200 OK (Trường hợp hệ thống không có key tạo ảnh - Trả về prompt để user tự tạo):**
  ```json
  {
    "imageUrl": null,
    "finalPrompt": "Tailored pants fabric detail, premium dark gray color, ...",
    "bannerSpecs": { ... },
    "isGenerated": false,
    "promptUsageTip": "Copy prompt trên và dùng với: Midjourney (/imagine), DALL-E 3 (ChatGPT Plus), hoặc Adobe Firefly để tạo ảnh miễn phí."
  }
  ```

---

## 7. Personal Analytics — Phân tích số liệu

> [!NOTE]
> Module Personal Analytics giúp người dùng đăng tải số liệu hiệu suất mạng xã hội (từ file Excel mẫu) để AI phân tích và đưa ra khuyến nghị tối ưu hóa.

### 7.1 Tải file Excel mẫu
**`GET /analytics/template`** — Không yêu cầu token

Trả về file nhị phân template Excel (.xlsx). Người dùng điền số liệu vào file này để chuẩn bị đăng tải.

### 7.2 Đăng tải file Excel và trích xuất chỉ số
**`POST /analytics/upload`** 🔒 — *Không tốn quota*

Đăng tải file Excel chứa số liệu. Hệ thống sẽ đọc và trả về JSON chứa các chỉ số đã được phân tích thô của Kỳ A và Kỳ B để người dùng rà soát trước khi gửi cho AI phân tích sâu.

* **Request Header:** `Content-Type: multipart/form-data`
* **Request Body (Form Data):**
  - `file`: File Excel (.xlsx, tối đa 5MB)
* **Response 200 OK:**
  ```json
  {
    "message": "Đọc file thành công.",
    "periodA": {
      "platform": "Facebook",
      "periodLabel": "Tháng 4/2026",
      "reach": 15200,
      "impressions": 22400,
      "totalEngagement": 1250,
      "likes": 840,
      "comments": 210,
      "shares": 200,
      "clicks": 450,
      "newFollowers": 120,
      "profileVisits": 340,
      "engagementRate": 5.6,
      "completionRate": null,
      "avgViewDurationSeconds": null,
      "conversionRate": 1.8,
      "clickThroughRate": 2.0,
      "postsCount": 8
    },
    "periodB": {
      "platform": "Facebook",
      "periodLabel": "Tháng 5/2026",
      "reach": 24800,
      "impressions": 38900,
      "totalEngagement": 2690,
      "likes": 1820,
      "comments": 470,
      "shares": 400,
      "clicks": 910,
      "newFollowers": 310,
      "profileVisits": 720,
      "engagementRate": 6.9,
      "completionRate": null,
      "avgViewDurationSeconds": null,
      "conversionRate": 2.4,
      "clickThroughRate": 2.3,
      "postsCount": 10
    }
  }
  ```

### 7.3 Phân tích báo cáo đơn lẻ (Single Period)
**`POST /analytics/analyze`** 🔒 *(Tốn 1 quota)*

Gửi các chỉ số của một kỳ để AI phân tích chuyên sâu hiệu năng.

* **Request Body:**
  ```json
  {
    "metrics": {
      "platform": "Facebook",
      "periodLabel": "Tháng 5/2026",
      "reach": 24800,
      "impressions": 38900,
      "totalEngagement": 2690,
      "likes": 1820,
      "comments": 470,
      "shares": 400,
      "clicks": 910,
      "newFollowers": 310,
      "profileVisits": 720,
      "engagementRate": 6.9,
      "conversionRate": 2.4,
      "clickThroughRate": 2.3,
      "postsCount": 10
    }
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "platform": "Facebook",
    "reportType": "single",
    "periodALabel": "Tháng 5/2026",
    "periodBLabel": null,
    "metrics": [
      {
        "metricKey": "Reach",
        "metricName": "Lượt tiếp cận",
        "valueAFormatted": "24,800",
        "valueBFormatted": null,
        "changePercent": null,
        "status": "neutral",
        "simpleExplain": "Tổng số tài khoản độc duy đã nhìn thấy bài viết.",
        "detail": "Lượng tiếp cận đạt mức ổn định với tần suất 10 bài đăng trong tháng.",
        "higherIsBetter": true
      }
    ],
    "summary": {
      "highlights": ["Tương tác bình luận và chia sẻ tăng mạnh so với số lượng bài viết."],
      "warnings": ["Tỷ lệ nhấp chuột (CTR) còn tương đối thấp."],
      "overallScore": 78,
      "overallTrend": "growing",
      "topRecommendation": "Bổ sung thêm hình ảnh thực tế chất lượng cao để cải thiện CTR."
    },
    "aiNarrative": "Báo cáo cho thấy hiệu suất tổng quan đạt 78 điểm..."
  }
  ```

### 7.4 Phân tích báo cáo so sánh (Compare Periods)
**`POST /analytics/compare`** 🔒 *(Tốn 1 quota)*

So sánh số liệu giữa hai kỳ khác nhau (ví dụ: tháng này so với tháng trước) để AI phân tích biến động tăng trưởng.

* **Request Body:** Truyền đồng thời cả `periodA` (kỳ cũ) và `periodB` (kỳ mới) theo schema chỉ số.
* **Response 200 OK:** Trả về cấu trúc tương đương với Báo cáo đơn lẻ, nhưng các trường `valueBFormatted` sẽ có giá trị và `changePercent` được tính toán cụ thể kèm theo phân tích chi tiết biến động của từng metric.

### 7.5 Phân tích so sánh nhanh bằng file Excel
**`POST /analytics/upload-and-compare`** 🔒 *(Tốn 1 quota)*

Tải file Excel lên và thực hiện so sánh phân tích luôn chỉ trong 1 request duy nhất.

* **Request Header:** `Content-Type: multipart/form-data`
* **Request Body (Form Data):**
  - `file`: File Excel (.xlsx)
* **Response 200 OK:** Trả về JSON Báo cáo so sánh hoàn chỉnh (schema của `POST /analytics/compare`).

### 7.6 Lịch sử báo cáo số liệu
**`GET /analytics/history`** 🔒

Lấy danh sách các báo cáo số liệu mà người dùng đã thực hiện phân tích trước đó.

* **Query Parameters:** `page` (Mặc định: 1), `pageSize` (Mặc định: 10)
* **Response 200 OK:**
  ```json
  {
    "page": 1,
    "pageSize": 10,
    "data": [
      {
        "id": 1,
        "platform": "Facebook",
        "reportType": "compare",
        "periodALabel": "Tháng 4/2026",
        "periodBLabel": "Tháng 5/2026",
        "overallScore": 82,
        "overallTrend": "growing",
        "createdAt": "2026-06-15T08:00:00Z"
      }
    ]
  }
  ```

### 7.7 Chi tiết một báo cáo số liệu
**`GET /analytics/history/{id}`** 🔒

* **Response 200 OK:** Trả về chi tiết báo cáo số liệu đã tạo bao gồm toàn bộ kết quả phân tích AI và metrics gốc.

---

## 8. Trends & Tags — Xu hướng

### 8.1 Danh sách xu hướng
**`GET /trends`** — Không yêu cầu token

* **Query Parameters:**
  - `page` (Mặc định: 1)
  - `pageSize` (Mặc định: 20, tối đa 100)
  - `tagId` (Lọc theo ID thẻ tag - tùy chọn)
  - `search` (Tìm kiếm theo từ khóa tiêu đề - tùy chọn)
* **Response 200 OK:**
  ```json
  {
    "page": 1,
    "pageSize": 20,
    "total": 50,
    "totalPages": 3,
    "items": [
      {
        "id": 6,
        "title": "Xu hướng thời trang tối giản lên ngôi giữa năm 2026",
        "summary": "Người tiêu dùng trẻ đang dịch chuyển mạnh mẽ sang sử dụng các trang phục có gam màu trung tính...",
        "sourceUrl": "https://vnexpress.net/thoi-trang-minimalist-2026",
        "hotLevel": 9,
        "createdAt": "2026-06-14T08:00:00Z",
        "tags": [
          { "id": 1, "name": "Thời trang", "slug": "thoi-trang" }
        ]
      }
    ]
  }
  ```

### 8.2 Danh sách thẻ tags xu hướng
**`GET /trends/tags`** — Không yêu cầu token

* **Response 200 OK:**
  ```json
  [
    { "id": 1, "name": "Thời trang", "slug": "thoi-trang" },
    { "id": 2, "name": "Bất động sản", "slug": "bat-dong-san" }
  ]
  ```

### 8.3 Danh sách tags phân loại hệ thống (Taxonomy Allowed Tags)
**`GET /taxonomy/tags`** — Không yêu cầu token

Lấy ra danh sách các tag được định nghĩa sẵn hợp lệ trong hệ thống phân loại xu hướng.

### 8.4 Cập nhật danh sách tags phân loại
**`PUT /taxonomy/tags`** 🔒

Cập nhật danh sách các tag hợp lệ (chỉ quản trị viên hoặc các luồng tích hợp hệ thống gọi).

* **Request Body:**
  ```json
  {
    "allowedTags": ["thoitrangnam", "vest", "quantay", "thoitrangcongso"]
  }
  ```
* **Response 200 OK:** Trả về danh sách tags đã cập nhật.

---

## 9. Knowledge Base — Kho tri thức

### 9.1 Nhập tri thức thủ công (Manual Ingest)
**`POST /knowledge/manual`** — Không yêu cầu token

Nhập thông tin sản phẩm, thương hiệu hoặc tài liệu quảng cáo trực tiếp bằng văn bản thô. Hệ thống sẽ chunk văn bản và trích xuất từ khóa tự động qua AI.

* **Request Body:**
  ```json
  {
    "title": "Vải Cotton Spandex của Pha Gent",
    "rawContent": "Chất liệu vải Cotton Spandex dệt sợi kép từ 95% sợi bông thiên nhiên và 5% sợi thun co giãn cao cấp. Vải có ưu điểm thấm hút mồ hôi cực tốt, thông thoáng mát mẻ, đặc biệt được xử lý chống nhăn tĩnh điện nên không bị nhăn nhúm sau khi giặt."
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "message": "Knowledge ingested successfully.",
    "itemId": 11,
    "title": "Vải Cotton Spandex của Pha Gent"
  }
  ```
* **Response 409 Conflict (Trùng lặp nội dung):**
  ```json
  {
    "code": "KNOWLEDGE_ALREADY_EXISTS",
    "message": "This knowledge content has already been ingested."
  }
  ```

### 9.2 Thu thập tri thức từ website (Scrape Ingest)
**`POST /knowledge/scrape`** — Không yêu cầu token

Thu thập văn bản tự động từ một URL cụ thể.

* **Whitelist domain được phép:** `wikipedia.org`, `reddit.com`, `dev.to`, `vnexpress.net`, `google.com`, `trends.google.com`.
* **Request Body:**
  ```json
  {
    "targetUrl": "https://vnexpress.net/xu-huong-vai-cong-nghe-moi"
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "message": "Knowledge crawled and ingested successfully.",
    "itemId": 12,
    "title": "xu-huong-vai-cong-nghe-moi",
    "sourceUrl": "https://vnexpress.net/xu-huong-vai-cong-nghe-moi"
  }
  ```

### 9.3 Tải lên tập tin tài liệu (File Ingest)
**`POST /knowledge/upload-file`** — Không yêu cầu token

* **Cấu hình file:** Hỗ trợ các định dạng `.txt`, `.md`, `.docx`, `.pdf`, dung lượng tối đa **10MB**.
* **Request Header:** `Content-Type: multipart/form-data`
* **Request Body:**
  - `file`: Tập tin nhị phân
* **Response 200 OK:**
  ```json
  {
    "message": "File uploaded and ingested successfully.",
    "itemId": 13,
    "fileName": "Pha_Gent_Brand_Guidelines_2026.pdf"
  }
  ```

---

## 10. Payment & Subscriptions — Thanh toán

### 10.1 Danh sách các gói dịch vụ (Plans)
**`GET /payment/plans`** — Không yêu cầu token

* **Response 200 OK:** Trả về danh sách thông tin gói cước (Free, Pro, Ultra) kèm mức giá tương ứng cấu hình trong hệ thống PayOS.

### 10.2 Tạo link thanh toán nâng cấp tài khoản
**`POST /payment/create`** 🔒

Tạo mã đơn hàng thanh toán trên PayOS. Trả về liên kết trang thanh toán và thông tin chuyển khoản thủ công kèm mã QR Code VietQR tương ứng.

* **Request Body:**
  ```json
  {
    "tier": "Pro" // "Pro" hoặc "Ultra"
  }
  ```
  > [!NOTE]
  > Gói "Ultra" trong dữ liệu phản hồi tương ứng với hạng `UserTier.Enterprise` trong DB để đảm bảo tính tương thích ngược.

* **Response 200 OK:**
  ```json
  {
    "orderId": 42,
    "orderCode": 1748500123456,
    "tier": "Pro",
    "amount": 50000,
    "description": "SSPR11", // Mã chuyển khoản: SS + 2 ký tự đầu viết hoa của gói + ID User
    "checkoutUrl": "https://pay.payos.vn/web/abc123",
    "qrCodeUrl": "https://img.vietqr.io/image/...",
    "bankTransfer": {
      "bankName": "MB Bank (hoặc ngân hàng liên kết payOS)",
      "accountNumber": "1234567890",
      "accountName": "CONG TY SOCIALSENSE",
      "amount": 50000,
      "description": "SSPR11"
    },
    "expiresAt": "2026-06-15T15:30:00Z"
  }
  ```

### 10.3 Nhận Webhook từ PayOS (Webhook Callback)
**`POST /payment/webhook`** — Không yêu cầu token (PayOS gọi tự động)

Hệ thống xác thực chữ ký HMAC-SHA256 của PayOS, cập nhật đơn hàng thành `Paid`, nâng cấp Tier và làm mới Quota cho người dùng tương ứng ngay lập tức.
- **Lưu ý:** Nếu webhook nhận `orderCode = 123` (request test của PayOS khi đăng ký webhook), hệ thống trả về mã `200` thành công ngay lập tức mà không xác thực chữ ký.

### 10.4 Kiểm tra trạng thái đơn hàng (Polling)
**`GET /payment/orders/{orderCode}/status`** 🔒

Frontend thực hiện polling gọi endpoint này mỗi 3-5 giây sau khi hiển thị QR thanh toán cho người dùng để cập nhật trạng thái đơn hàng.

* **Response 200 OK:**
  ```json
  {
    "orderId": 42,
    "orderCode": 1748500123456,
    "status": "Paid", // Pending | Paid | Cancelled | Expired
    "tier": "Pro",
    "amount": 50000,
    "paidAt": "2026-06-15T14:05:30Z",
    "createdAt": "2026-06-15T14:00:00Z"
  }
  ```

### 10.5 Thông tin Subscription hiện tại
**`GET /payment/subscription`** 🔒

* **Response 200 OK (Có subscription active):**
  ```json
  {
    "userId": 11,
    "tier": "Pro",
    "status": "Active",
    "startedAt": "2026-06-15T14:05:30Z",
    "expiresAt": "2026-07-15T14:05:30Z",
    "daysRemaining": 30,
    "isActive": true
  }
  ```

### 10.6 Lịch sử giao dịch thanh toán
**`GET /payment/history`** 🔒

* **Query Parameters:** `page` (Mặc định: 1), `pageSize` (Mặc định: 10, tối đa 50)
* **Response 200 OK:** Trả về danh sách đơn hàng đã tạo có phân trang kèm thông tin trạng thái cụ thể.

---

## 11. Admin Panel — Quản trị hệ thống

> [!WARNING]
> Mọi Endpoint quản trị bắt đầu bằng tiền tố `/admin` đều áp dụng chính sách xác thực bắt buộc: Phải mang JWT Token có vai trò `Admin` (Policy: `AdminOnly`).

### 11.1 Bảng số liệu tổng quan (Dashboard Summary)
**`GET /admin/dashboard`** 🔒 Admin

* **Response 200 OK:**
  ```json
  {
    "totalUsers": 10,
    "activeUsers": 9,
    "totalContentGenerated": 50,
    "totalKnowledgeItems": 10,
    "totalTrends": 50,
    "activeApiKeys": 2,
    "coolingDownApiKeys": 0,
    "last7DaysContent": [
      { "date": "2026-06-09", "contentGenerated": 5, "newUsers": 1 },
      { "date": "2026-06-15", "contentGenerated": 12, "newUsers": 2 }
    ]
  }
  ```

### 11.2 Quản lý danh sách người dùng
**`GET /admin/users`** 🔒 Admin

* **Query Parameters:** `page`, `pageSize`, `search` (Email/DisplayName), `isActive` (true/false)
* **Response 200 OK:**
  ```json
  {
    "total": 10,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1,
    "data": [
      {
        "id": 11,
        "email": "user@example.com",
        "displayName": "Nguyễn Văn An",
        "isActive": true,
        "hasContext": true,
        "tier": "Free",
        "dailyQuotaLimit": 5,
        "remainingQuota": 3,
        "lastQuotaReset": "2026-06-15T00:00:00Z",
        "createdAt": "2026-06-10T08:00:00Z",
        "roles": ["User"],
        "totalContentGenerated": 8
      }
    ]
  }
  ```

### 11.3 Quản trị chi tiết người dùng
**`GET /admin/users/{id}`** 🔒 Admin

* **Response 200 OK:** Trả về thông tin chi tiết của 1 user (cấu trúc tương tự item trong danh sách).

### 11.4 Tạo tài khoản thủ công từ Admin
**`POST /admin/users`** 🔒 Admin

* **Request Body:**
  ```json
  {
    "email": "newuser@example.com",
    "password": "Password123!",
    "displayName": "Nhân viên mới",
    "dailyQuotaLimit": 10,
    "isAdmin": false
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "message": "Tạo user thành công.",
    "userId": 12
  }
  ```

### 11.5 Cập nhật tài khoản người dùng
**`PUT /admin/users/{id}`** 🔒 Admin

* **Request Body:**
  ```json
  {
    "displayName": "Tên cập nhật",
    "isActive": true,
    "dailyQuotaLimit": 25,
    "resetQuotaNow": true
  }
  ```

### 11.6 Khóa/Vô hiệu hóa tài khoản (Soft Delete)
**`DELETE /admin/users/{id}`** 🔒 Admin

Khóa tài khoản người dùng (`IsActive = false`). Admin không được tự vô hiệu hóa tài khoản của chính mình.

### 11.7 Mở khóa/Kích hoạt lại tài khoản
**`POST /admin/users/{id}/restore`** 🔒 Admin

### 11.8 Đổi hạng tài khoản (Adjust User Tier & Custom Quota)
**`PUT /admin/users/{id}/tier`** 🔒 Admin

Nâng hoặc hạ hạng tài khoản của người dùng. Hệ thống tự gán quota mặc định hoặc áp dụng `customDailyQuota` ghi đè (chỉ có tier `Ultra/Enterprise` mới được đặt quota `-1` - Unlimited).

* **Request Body:**
  ```json
  {
    "tier": "Pro", // Free | Pro | Ultra
    "customDailyQuota": 80 // Tùy chọn ghi đè
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "message": "Đã đổi tier thành Pro.",
    "userId": 11,
    "tier": "Pro",
    "dailyQuotaLimit": 80,
    "isUnlimited": false
  }
  ```

### 11.9 Reset Quota của người dùng thủ công
**`POST /admin/users/{id}/reset-quota`** 🔒 Admin

Đưa chỉ số `RemainingQuota` của người dùng về đúng giá trị giới hạn ngày `DailyQuotaLimit` ngay lập tức.

### 11.10 Thống kê chi tiết & so sánh hiệu năng hệ thống
**`POST /admin/stats/compare`** 🔒 Admin

Admin so sánh sự phát triển của hệ thống (lượng user mới, nội dung đã sinh, kiến thức đã nạp) giữa 2 chu kỳ thời gian.

* **Request Body:**
  ```json
  {
    "period": "month", // day | month | quarter | year
    "periodA": "2026-05-01",
    "periodB": "2026-06-01"
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "periodA": {
      "from": "2026-05-01T00:00:00Z",
      "to": "2026-06-01T00:00:00Z",
      "label": "05/2026",
      "newUsers": 5,
      "activeUsers": 3,
      "totalContentGenerated": 45,
      "totalApiCalls": 45,
      "newKnowledgeItems": 2,
      "newTrends": 15
    },
    "periodB": {
      "from": "2026-06-01T00:00:00Z",
      "to": "2026-07-01T00:00:00Z",
      "label": "06/2026",
      "newUsers": 12,
      "activeUsers": 8,
      "totalContentGenerated": 120,
      "totalApiCalls": 120,
      "newKnowledgeItems": 8,
      "newTrends": 25
    },
    "diff": {
      "newUsersDiff": 7,
      "newUsersChangePercent": 140.0,
      "contentGeneratedDiff": 75,
      "contentGeneratedChangePercent": 166.67,
      "newKnowledgeDiff": 6,
      "newKnowledgeChangePercent": 300.0,
      "newTrendsDiff": 10,
      "newTrendsChangePercent": 66.67
    }
  }
  ```

### 11.11 Xem danh sách API Keys
**`GET /admin/api-keys`** 🔒 Admin

Lấy danh sách các key cấu hình kết nối AI. Key hiển thị dưới dạng che giấu ký tự bảo mật, chỉ lộ ra 4 ký tự cuối. Trạng thái Cooldown trong runtime pool cũng được đi kèm đầy đủ.

* **Response 200 OK:**
  ```json
  [
    {
      "id": 1,
      "label": "OpenRouter-Key-Main",
      "keySuffix": "8af2",
      "provider": "openrouter",
      "modelOverride": "google/gemini-2.5-flash-preview:free",
      "supportsImageGen": false,
      "isActive": true,
      "isEncrypted": true,
      "notes": "Key free chính cho content",
      "createdAt": "2026-06-10T08:00:00Z",
      "updatedAt": "2026-06-11T12:00:00Z",
      "isInCooldown": false,
      "cooldownExpiresAt": null
    }
  ]
  ```

### 11.12 Thêm mới API Key (Mã hóa AES-256)
**`POST /admin/api-keys`** 🔒 Admin

Tạo mới cấu hình API Key. Key sẽ được mã hóa AES-256 bảo mật tuyệt đối trước khi lưu xuống Database.
- Nếu không truyền trường `provider`, hệ thống tự phát hiện dựa vào prefix giá trị key (`sk-or-` -> openrouter, `gsk_` -> groq, `sk-` -> openai, `AIza` -> gemini, `sk_` -> pollinations).

* **Request Body:**
  ```json
  {
    "label": "Groq-Llama4",
    "keyValue": "gsk_xxxxYOUR_RAW_KEY_HERExxxx",
    "provider": "groq",
    "modelOverride": "meta-llama/llama-4-scout-17b-16e-instruct",
    "supportsImageGen": false,
    "notes": "Key chạy Llama 4 của Groq"
  }
  ```

### 11.13 Nhập API Keys số lượng lớn (Bulk Import)
**`POST /admin/api-keys/bulk`** 🔒 Admin

* **Request Body:** Truyền một mảng chứa danh sách các object cấu hình key như API thêm đơn lẻ.
* **Response 200 OK:**
  ```json
  {
    "message": "Đã thêm 3 key(s).",
    "added": 3,
    "skipped": ["Key-Duplicate-Label"]
  }
  ```

### 11.14 Cập nhật API Key
**`PUT /admin/api-keys/{id}`** 🔒 Admin

Cho phép thay đổi cấu hình, đổi giá trị key hoặc bật/tắt kích hoạt hoạt động.

### 11.15 Xóa API Key
**`DELETE /admin/api-keys/{id}`** 🔒 Admin

### 11.16 Tải lại API Key Pool (Reload runtime pool)
**`POST /admin/api-keys/reload`** 🔒 Admin

Buộc hệ thống đọc lại toàn bộ API Key từ Database vào bộ nhớ đệm (Runtime API Pool) mà không cần khởi động lại máy chủ ứng dụng.
- **Query Parameter:** `clearCooldowns` (true/false) — Tùy chọn để xóa toàn bộ trạng thái lỗi cooldown của các key hiện tại.

### 11.17 Xem trạng thái hoạt động thực tế của Key Pool
**`GET /admin/api-keys/status`** 🔒 Admin

Xem thời gian thực các key trong pool có đang bị khóa tạm thời do quá giới hạn (Rate Limit / Cooldown) hay không.

### 11.18 Xóa trạng thái cooldown của các key trong pool
**`POST /admin/api-keys/clear-cooldown`** 🔒 Admin

### 11.19 Xem danh sách các AI Models hệ thống hỗ trợ
**`GET /admin/models`** 🔒 Admin

Lấy danh sách phân loại các Model được hỗ trợ phân chia theo tính chất (Text Models miễn phí, Multimodal / Image Models tạo ảnh).

* **Response 200 OK:**
  ```json
  {
    "total": 17,
    "freeModels": [
      { "provider": "openrouter", "modelId": "meta-llama/llama-4-scout", "displayName": "Llama 4 Scout (Free)", "supportsImageGen": false, "isFree": true }
    ],
    "imageModels": [
      { "provider": "pollinations", "modelId": "flux", "displayName": "Flux (Pollinations)", "supportsImageGen": true, "isFree": true }
    ],
    "allModels": [...]
  }
  ```

### 11.20 Giả lập cổng thanh toán thành công (Simulate Payment)
**`POST /admin/payment/simulate`** 🔒 Admin

API phụ trợ dành riêng cho đội phát triển kiểm thử (Development/Testing). Nó sẽ ngay lập tức giả lập luồng thanh toán thành công của 1 User ID, tạo Subscription 30 ngày và nâng cấp Tier + Quota tương ứng mà không cần quét QR PayOS thật.

* **Request Body:**
  ```json
  {
    "userId": 11,
    "tier": "Pro" // Pro hoặc Ultra
  }
  ```
* **Response 200 OK:**
  ```json
  {
    "message": "✅ Đã giả lập thanh toán thành công. User 11 nâng lên Pro.",
    "userId": 11,
    "tier": "Pro",
    "orderCode": 1748500859382,
    "dailyQuota": 50,
    "expiresAt": "2026-07-15T14:05:30Z"
  }
  ```

### 11.21 Seed dữ liệu mẫu hệ thống
**`POST /admin/seed`** 🔒 Admin

Cập nhật và nạp lại dữ liệu mẫu (10 Users, 50 Trends, 20 Tags, 10 KnowledgeItems...) vào MySQL nếu cơ sở dữ liệu trống.

---

## Phụ lục A — Bảng mã lỗi (Error Codes)

Dưới đây là tổng hợp các mã lỗi nghiệp vụ được trả về trong trường `code` của JSON phản hồi:

| Mã lỗi (Code) | HTTP Status | Mô tả nghiệp vụ |
|---------------|-------------|-----------------|
| `AUTH_EMAIL_EXISTS` | 400 | Email đã tồn tại trong hệ thống đăng ký. |
| `AUTH_INVALID_CREDENTIALS` | 401 | Email hoặc mật khẩu đăng nhập không chính xác. |
| `AUTH_INVALID_TOKEN` | 401 | JWT Token không hợp lệ hoặc đã bị chỉnh sửa. |
| `AUTH_INVALID_REFRESH_TOKEN`| 401 | Refresh Token đã hết hạn hoặc bị thu hồi. |
| `AUTH_WRONG_PASSWORD` | 400 | Nhập sai mật khẩu hiện tại khi thực hiện đổi. |
| `AUTH_SAME_PASSWORD` | 400 | Mật khẩu mới trùng lặp hoàn toàn với mật khẩu cũ. |
| `USER_NOT_FOUND` | 404/400 | Không tìm thấy tài khoản tương ứng trong DB. |
| `QUOTA_EXCEEDED` | 429 | Đã dùng hết lượt gọi AI định mức hàng ngày của hạng gói. |
| `CONTENT_COUNT_INVALID` | 400 | Lượng bài viết yêu cầu sinh nằm ngoài dải 1-3. |
| `CONTENT_LANGUAGE_INVALID` | 400 | Ngôn ngữ không được hỗ trợ (chỉ chấp nhận `vi` hoặc `en`). |
| `CONTENT_INSTRUCTION_TOO_LONG`| 400 | Chỉ dẫn bổ sung vượt quá 1000 ký tự cho phép. |
| `CONTEXT_ANSWERS_TOO_FEW` | 400 | Onboarding khảo sát yêu cầu tối thiểu phải có 3 câu trả lời. |
| `CONTEXT_ANSWERS_INVALID` | 400 | Câu trả lời khảo sát quá ngắn hoặc vượt 1000 ký tự. |
| `KNOWLEDGE_ALREADY_EXISTS` | 409 | Nội dung tài liệu/tri thức đã được nạp trước đó. |
| `UNSUPPORTED_WEBSITE_SOURCE`| 400 | Tên miền trang web scrape không nằm trong Whitelist. |
| `CANNOT_EXTRACT_TEXT_FROM_FILE`| 422 | Tệp tài liệu trống hoặc không có lớp văn bản trích xuất được. |
| `INVALID_FILE_FORMAT` | 400 | Định dạng tệp không được hỗ trợ (chỉ nhận txt, md, docx, pdf, xlsx). |
| `INVALID_TIER` | 400 | Nhập sai tên phân hạng tài khoản (Free/Pro/Ultra). |
| `UNLIMITED_ENTERPRISE_ONLY`| 400 | Cấu hình quota Unlimited (`-1`) chỉ được áp dụng cho gói Ultra/Enterprise. |
| `KEY_ALREADY_EXISTS` | 400 | API Key này kèm theo cấu hình modelOverride tương tự đã tồn tại. |
| `ALREADY_SUBSCRIBED` | 400 | Người dùng hiện đang sử dụng gói cước active tương đương. |
| `PAYMENT_GATEWAY_ERROR` | 502 | Gặp lỗi truyền thông khi kết nối với cổng thanh toán PayOS. |
| `ORDER_NOT_FOUND` | 404 | Không tồn tại mã đơn hàng thanh toán yêu cầu. |
| `INVALID_SIGNATURE` | 400 | Chữ ký bảo mật Webhook của PayOS không chính xác. |
| `REPORT_NOT_FOUND` | 404 | Không tìm thấy báo cáo số liệu cá nhân. |
| `FILE_TOO_LARGE` | 400 | Dung lượng tệp đăng tải vượt quá giới hạn hệ thống (5MB/10MB). |
| `PARSE_ERROR` | 422 | Không thể phân tích cấu trúc dữ liệu Excel nạp vào. |

---

## Phụ lục B — Seed Data mặc định

Khi DB trống tại thời điểm chạy ứng dụng hoặc khi gọi `POST /admin/seed`, hệ thống sẽ tự động gán dữ liệu kiểm thử:

| Tài khoản kiểm thử | Mật khẩu mặc định | Hạng gói (Tier) | Vai trò (Roles) |
|-------------------|-------------------|-----------------|-----------------|
| `admin@socialsense.vn` | `Password123!` | Enterprise | Admin, User |
| `user1@socialsense.vn` | `Password123!` | Pro | User |
| `user2@socialsense.vn` | `Password123!` | Pro | User |
| `user3-9@socialsense.vn` | `Password123!` | Free | User |

---

## Changelog

### v2.3 — 15/06/2026 *(Bản cập nhật hiện tại)*
- **Tích hợp Module Personal Analytics:** Bổ sung trọn bộ API `/analytics` gồm:
  - Tải Excel template mẫu (`GET /analytics/template`)
  - Upload file Excel thô để parse metrics thô (`POST /analytics/upload`)
  - Phân tích báo cáo đơn lẻ kỳ báo cáo (`POST /analytics/analyze`)
  - Phân tích báo cáo so sánh biến động kỳ A và kỳ B (`POST /analytics/compare`)
  - Upload Excel và phân tích so sánh nhanh (`POST /analytics/upload-and-compare`)
  - Xem lịch sử và chi tiết báo cáo (`GET /analytics/history`, `GET /analytics/history/{id}`)
- **Bổ sung API Quản lý Tài khoản (Auth):**
  - Đổi mật khẩu chủ động (`PUT /auth/change-password`)
  - Cập nhật tên hiển thị người dùng (`PUT /auth/profile`)
- **Nâng cấp quản trị (Admin Panel):**
  - Bổ sung công cụ giả lập thanh toán nâng tier nhanh (`POST /admin/payment/simulate`)
  - Bổ sung lệnh xóa cooldown cho runtime key pool (`POST /admin/api-keys/clear-cooldown`)

### v2.2 — 01/06/2026
- **Tích hợp Image Generation Wizard:**
  - Quy trình sinh ảnh banner 2 bước phối hợp (`/content/image/analyze`, `/content/image/generate`)
  - Kết nối động qua API tạo ảnh miễn phí Pollinations.ai
- **Quên mật khẩu & Bảo mật:**
  - Tích hợp email OTP xác nhận qua mã 6 số (`/auth/forgot-password`, `/auth/reset-password`)
  - Gửi thư chào mừng tự động sau khi đăng ký tài khoản mới thành công.
