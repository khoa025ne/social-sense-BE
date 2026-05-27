# 📚 SocialSense BE – Tài Liệu API Chi Tiết

**Version:** 1.0  
**Ngày cập nhật:** 2026-05-22  
**Framework:** .NET 8.0 Web API  
**Base URL:** `http://localhost:5189`

---

## Mục lục

1. [Health Check](#1-health-check)
2. [Context Management API](#2-context-management-api)
   - 2.1 [Submit Onboarding](#21-submit-onboarding)
   - 2.2 [Get User Persona](#22-get-user-persona)
   - 2.3 [Update Persona](#23-update-persona)
3. [Trends API](#3-trends-api)
   - 3.1 [List Trends](#31-list-trends)
   - 3.2 [Get Tags](#32-get-tags)
4. [Content Generation API](#4-content-generation-api)
   - 4.1 [Generate Content](#41-generate-content)
5. [Tag Taxonomy API](#5-tag-taxonomy-api)
   - 5.1 [Get Taxonomy](#51-get-taxonomy)
   - 5.2 [Update Taxonomy](#52-update-taxonomy)
6. [Common Error Codes](#6-common-error-codes)
7. [Data Models (Entity)](#7-data-models)
8. [Messaging Models](#8-messaging-models)

---

## 1. Health Check

### `GET /health`

**Mục đích:** Kiểm tra trạng thái hoạt động của server.

**Request:** Không cần body hay query parameters.

**Response:**
```json
{
  "status": "ok"
}
```

| Field    | Type   | Mô tả                    |
|----------|--------|---------------------------|
| `status` | string | Trạng thái server ("ok")  |

---

## 2. Context Management API

> **Controller:** `ContextController` — Route: `/context`
> 
> **Service:** `IContextService` → `ContextService`
> 
> Module này quản lý việc onboarding người dùng, trích xuất persona thông qua AI (Gemini), và lưu trữ vào MySQL + Vector DB (Qdrant).

---

### 2.1 Submit Onboarding

### `POST /context/onboarding`

**Mục đích:** Nhận câu trả lời onboarding từ người dùng, sử dụng AI (Gemini) để trích xuất UserPersona có cấu trúc, lưu vào MySQL và upsert embedding vào Qdrant.

**Request Body:**
```json
{
  "userId": "user-uuid-123",
  "answers": [
    "Tôi là một content creator về mảng công nghệ",
    "Tôi muốn viết content cho Facebook và Instagram",
    "Phong cách viết chuyên nghiệp nhưng thân thiện",
    "Đối tượng mục tiêu là Gen Z quan tâm công nghệ"
  ],
  "language": "vi"
}
```

| Field      | Type     | Required | Validation                        | Mô tả                                                    |
|------------|----------|----------|-----------------------------------|-----------------------------------------------------------|
| `userId`   | string   | ✅       | Không rỗng, max 64 ký tự         | ID người dùng                                             |
| `answers`  | string[] | ✅       | Tối thiểu 3 câu, mỗi câu 1-1000 ký tự | Các câu trả lời onboarding dạng free-form             |
| `language` | string   | ✅       | Phải là `"vi"` hoặc `"en"`       | Ngôn ngữ đầu ra                                          |

**Response (Sync – ContextQueue.Enabled = false):**
```json
{
  "personaVersion": 1,
  "status": "done"
}
```

**Response (Async – ContextQueue.Enabled = true):**
```json
{
  "personaVersion": 0,
  "status": "queued"
}
```

| Field            | Type   | Mô tả                                                    |
|------------------|--------|-----------------------------------------------------------|
| `personaVersion` | int    | Phiên bản persona (0 nếu đang xử lý async)               |
| `status`         | string | `"done"` = đã xử lý xong, `"queued"` = đang chờ trong queue |

**Error Responses:**

| Status | Code                        | Message                              |
|--------|-----------------------------|--------------------------------------|
| 400    | `CONTEXT_INVALID_LANGUAGE`  | Language must be vi or en.           |
| 400    | `CONTEXT_ANSWERS_TOO_FEW`   | At least 3 answers are required.     |
| 400    | `CONTEXT_ANSWERS_INVALID`   | Each answer must be 1..1000 chars.   |

**Luồng xử lý bên trong:**
1. Validate input (language, answers count, answer length)
2. Nếu `ContextQueue.Enabled = true` → đẩy message vào RabbitMQ queue `context.onboarding` → trả về `status: "queued"`
3. Nếu sync:
   - Gọi `IContextAiExtractor.ExtractPersonaAsync()` → Gemini trích xuất persona JSON
   - Tạo record `UserContext` mới trong MySQL (version tăng dần, record cũ set `IsActive = false`)
   - Upsert persona embedding vào Qdrant thông qua `IVectorPersonaClient`
   - Trả về `status: "done"`

---

### 2.2 Get User Persona

### `GET /context/persona?userId={userId}`

**Mục đích:** Lấy thông tin persona của người dùng (phiên bản mới nhất).

**Query Parameters:**

| Field    | Type   | Required | Validation       | Mô tả       |
|----------|--------|----------|------------------|--------------|
| `userId` | string | ✅       | Không rỗng       | ID người dùng |

**Response (200 OK):**
```json
{
  "userId": "user-uuid-123",
  "version": 2,
  "language": "vi",
  "jobTitle": "Content Creator",
  "toneOfVoice": "professional",
  "platformPreferences": ["Facebook", "Instagram", "TikTok"],
  "updatedAt": "2026-05-20T10:30:00Z"
}
```

| Field                   | Type     | Mô tả                           |
|-------------------------|----------|----------------------------------|
| `userId`                | string   | ID người dùng                    |
| `version`               | int      | Phiên bản persona hiện tại      |
| `language`              | string   | Ngôn ngữ (`vi` hoặc `en`)       |
| `jobTitle`              | string?  | Chức danh nghề nghiệp            |
| `toneOfVoice`           | string?  | Phong cách viết                  |
| `platformPreferences`   | string[] | Danh sách nền tảng ưa thích     |
| `updatedAt`             | datetime | Thời gian cập nhật gần nhất     |

**Error Responses:**

| Status | Code                      | Mô tả                |
|--------|---------------------------|-----------------------|
| 400    | `CONTEXT_USERID_REQUIRED` | userId is required.   |
| 404    | —                         | Persona không tồn tại |

---

### 2.3 Update Persona

### `PUT /context/persona?userId={userId}`

**Mục đích:** Cập nhật thủ công (manual) các trường persona. Chỉ các trường được gửi sẽ bị ghi đè (partial update).

**Query Parameters:**

| Field    | Type   | Required | Mô tả        |
|----------|--------|----------|---------------|
| `userId` | string | ✅       | ID người dùng |

**Request Body:**
```json
{
  "jobTitle": "Marketing Manager",
  "toneOfVoice": "friendly",
  "platformPreferences": ["Facebook", "LinkedIn"],
  "language": "vi"
}
```

| Field                  | Type     | Required | Validation                   | Mô tả                      |
|------------------------|----------|----------|------------------------------|-----------------------------|
| `jobTitle`             | string?  | ❌       | Max 120 ký tự                | Chức danh nghề nghiệp      |
| `toneOfVoice`          | string?  | ❌       | Max 60 ký tự                 | Phong cách viết             |
| `platformPreferences`  | string[]?| ❌       | Mỗi item 1-60 ký tự         | Danh sách nền tảng          |
| `language`             | string?  | ❌       | `"vi"` hoặc `"en"`          | Ngôn ngữ                   |

**Response (200 OK):**
```json
{
  "userId": "user-uuid-123",
  "version": 2,
  "language": "vi",
  "jobTitle": "Marketing Manager",
  "toneOfVoice": "friendly",
  "platformPreferences": ["Facebook", "LinkedIn"],
  "updatedAt": "2026-05-22T14:00:00Z"
}
```

*(Cấu trúc response giống với [Get Persona](#22-get-user-persona))*

**Error Responses:**

| Status | Code                        | Mô tả                                          |
|--------|-----------------------------|-------------------------------------------------|
| 400    | `CONTEXT_USERID_REQUIRED`   | userId is required.                             |
| 400    | `CONTEXT_PLATFORM_INVALID`  | Platform preferences items must be 1..60 chars. |
| 400    | `CONTEXT_INVALID_LANGUAGE`  | Language must be vi or en.                      |

---

## 3. Trends API

> **Controller:** `TrendsController` — Route: `/trends`
> 
> **Service:** `ITrendQueryService` → `TrendQueryService`
> 
> Module này truy vấn danh sách xu hướng (trends) đã được crawl và tóm tắt bởi AI.

---

### 3.1 List Trends

### `GET /trends`

**Mục đích:** Lấy danh sách xu hướng, hỗ trợ phân trang và lọc theo tag.

**Query Parameters:**

| Field      | Type  | Required | Default | Validation     | Mô tả                    |
|------------|-------|----------|---------|----------------|---------------------------|
| `page`     | int   | ❌       | 1       | ≥ 1            | Trang hiện tại            |
| `pageSize` | int   | ❌       | 20      | 1-100          | Số lượng item mỗi trang  |
| `tagId`    | Guid? | ❌       | null    | UUID hợp lệ    | Lọc theo tag ID           |

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "a1b2c3d4-...",
      "title": "AI đang thay đổi ngành Marketing như thế nào",
      "summary": "Trí tuệ nhân tạo đang tạo ra cuộc cách mạng trong ngành marketing với khả năng cá nhân hóa nội dung...",
      "sourceUrl": "https://vnexpress.net/ai-marketing-123.html",
      "hotLevel": 4,
      "createdAt": "2026-05-20T08:00:00Z",
      "tags": [
        {
          "id": "e5f6g7h8-...",
          "name": "AI",
          "slug": "ai"
        },
        {
          "id": "i9j0k1l2-...",
          "name": "Marketing",
          "slug": "marketing"
        }
      ]
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 150
}
```

| Field                 | Type            | Mô tả                           |
|-----------------------|-----------------|----------------------------------|
| `items`               | TrendItem[]     | Danh sách xu hướng               |
| `items[].id`          | Guid            | ID xu hướng                      |
| `items[].title`       | string          | Tiêu đề (max 200 ký tự)         |
| `items[].summary`     | string          | Tóm tắt bởi AI (max 1000 ký tự) |
| `items[].sourceUrl`   | string          | URL nguồn bài viết              |
| `items[].hotLevel`    | int             | Độ hot (1-5)                     |
| `items[].createdAt`   | datetime        | Thời gian tạo                   |
| `items[].tags`        | TagResponse[]   | Danh sách tag gắn kèm           |
| `items[].tags[].id`   | Guid            | ID tag                           |
| `items[].tags[].name` | string          | Tên tag                         |
| `items[].tags[].slug` | string          | Slug tag (URL-friendly)          |
| `page`                | int             | Trang hiện tại                   |
| `pageSize`            | int             | Số item mỗi trang               |
| `total`               | int             | Tổng số xu hướng                 |

---

### 3.2 Get Tags

### `GET /trends/tags`

**Mục đích:** Lấy danh sách tất cả các tag hiện có trong hệ thống.

**Response (200 OK):**
```json
[
  {
    "id": "e5f6g7h8-...",
    "name": "AI",
    "slug": "ai"
  },
  {
    "id": "i9j0k1l2-...",
    "name": "Marketing",
    "slug": "marketing"
  }
]
```

---

## 4. Content Generation API

> **Controller:** `ContentController` — Route: `/content`
> 
> **Service:** `IContentGeneratorService` → `ContentGeneratorService`
> 
> Module này sử dụng kỹ thuật RAG (Retrieval-Augmented Generation) để tạo nội dung social media từ xu hướng + persona người dùng.

---

### 4.1 Generate Content

### `POST /content/generate`

**Mục đích:** Tạo nội dung bài đăng social media từ xu hướng kết hợp với persona người dùng (RAG).

**Request Body:**
```json
{
  "userId": "user-uuid-123",
  "trendId": "a1b2c3d4-...",
  "outputCount": 2,
  "language": "vi"
}
```

| Field         | Type   | Required | Default | Validation             | Mô tả                          |
|---------------|--------|----------|---------|------------------------|---------------------------------|
| `userId`      | string | ✅       | —       | Không rỗng, max 64     | ID người dùng                   |
| `trendId`     | Guid   | ✅       | —       | UUID hợp lệ, != empty  | ID xu hướng cần tạo content     |
| `outputCount` | int    | ❌       | 1       | 1-3                    | Số biến thể nội dung cần tạo   |
| `language`    | string | ❌       | null    | `"vi"` hoặc `"en"`    | Ngôn ngữ đầu ra                |

**Response (200 OK):**
```json
{
  "items": [
    {
      "title": "🤖 AI đang thay đổi cách bạn làm Marketing!",
      "body": "Bạn có biết rằng 73% marketer đã sử dụng AI trong chiến dịch của mình? Hãy cùng tìm hiểu cách AI có thể giúp bạn tối ưu hóa chiến lược content marketing...",
      "hashtags": ["#AIMarketing", "#ContentCreator", "#DigitalMarketing"],
      "language": "vi"
    },
    {
      "title": "Tương lai Marketing nằm trong tay AI",
      "body": "Từ cá nhân hóa email đến phân tích dữ liệu khách hàng, AI đang mở ra những cơ hội mới cho marketer...",
      "hashtags": ["#MarketingTrends", "#AI", "#TechNews"],
      "language": "vi"
    }
  ]
}
```

| Field                 | Type     | Mô tả                                     |
|-----------------------|----------|--------------------------------------------|
| `items`               | array    | Danh sách nội dung đã tạo                 |
| `items[].title`       | string   | Tiêu đề bài đăng (max 120 ký tự)          |
| `items[].body`        | string   | Nội dung chính (max 2000 ký tự)            |
| `items[].hashtags`    | string[] | Danh sách hashtag (max 8)                  |
| `items[].language`    | string   | Ngôn ngữ nội dung                         |

**Error Responses:**

| Status | Code                       | Mô tả                                |
|--------|----------------------------|---------------------------------------|
| 400    | `CONTENT_USERID_REQUIRED`  | userId is required.                   |
| 400    | `CONTENT_TREND_REQUIRED`   | trendId is required.                  |
| 400    | `CONTENT_COUNT_INVALID`    | outputCount must be 1..3.             |
| 400    | `CONTENT_LANGUAGE_INVALID` | language must be vi or en.            |
| 404    | —                          | Trend không tìm thấy                 |

**Luồng xử lý bên trong (RAG):**
1. Truy vấn `Trend` từ MySQL theo `trendId`
2. Lấy danh sách tags của trend
3. Lấy persona từ Vector DB (Qdrant), fallback sang MySQL nếu Qdrant fail
4. Build prompt bao gồm: persona info + trend info + output rules
5. Gọi Gemini API → nhận JSON array
6. Parse, validate và enforce limits (title length, hashtag count, body length)
7. Trả kết quả về client

---

## 5. Tag Taxonomy API

> **Controller:** `TagTaxonomyController` — Route: `/taxonomy/tags`
> 
> **Service:** `ITagTaxonomyService` → `TagTaxonomyService`
> 
> Module này quản lý danh sách tag được cho phép (taxonomy). Khi `Enforced = true`, AI chỉ được gán tag nằm trong danh sách này.

---

### 5.1 Get Taxonomy

### `GET /taxonomy/tags`

**Mục đích:** Lấy danh sách taxonomy tag hiện tại.

**Response (200 OK):**
```json
{
  "enforced": false,
  "allowedTags": [
    "bat dong san",
    "thoi trang",
    "cong nghe",
    "giao duc",
    "tai chinh"
  ]
}
```

| Field          | Type     | Mô tả                                                |
|----------------|----------|-------------------------------------------------------|
| `enforced`     | bool     | `true` = AI bắt buộc chỉ dùng tag trong list         |
| `allowedTags`  | string[] | Danh sách tag được phép                               |

---

### 5.2 Update Taxonomy

### `PUT /taxonomy/tags`

**Mục đích:** Cập nhật danh sách taxonomy tag.

**Request Body:**
```json
{
  "enforced": true,
  "allowedTags": [
    "Công nghệ",
    "Marketing",
    "AI",
    "Startup",
    "Kinh doanh"
  ]
}
```

| Field         | Type     | Required | Validation                 | Mô tả                          |
|---------------|----------|----------|----------------------------|---------------------------------|
| `enforced`    | bool?    | ❌       | —                          | Bật/tắt enforce taxonomy        |
| `allowedTags` | string[]?| ❌       | Mỗi tag 1-60 ký tự        | Danh sách tag mới               |

**Response (200 OK):**
```json
{
  "enforced": true,
  "allowedTags": [
    "Công nghệ",
    "Marketing",
    "AI",
    "Startup",
    "Kinh doanh"
  ]
}
```

**Error Responses:**

| Status | Code                   | Mô tả                          |
|--------|------------------------|---------------------------------|
| 400    | `TAXONOMY_TAG_INVALID` | Tags must be 1..60 chars.       |

---

## 6. Common Error Codes

| HTTP Status | Ý nghĩa                                         |
|-------------|--------------------------------------------------|
| 200         | Thành công                                       |
| 400         | Lỗi validation – input không hợp lệ             |
| 401         | Chưa xác thực (chưa triển khai)                  |
| 403         | Không có quyền (chưa triển khai)                 |
| 404         | Không tìm thấy resource                         |
| 409         | Xung đột dữ liệu                                |
| 429         | Vượt quá giới hạn request (chưa triển khai)      |
| 500         | Lỗi server nội bộ                                |

**Chuẩn Error Response:**
```json
{
  "code": "ERROR_CODE_HERE",
  "message": "Human-readable error description."
}
```

---

## 7. Data Models (Entity)

### 7.1 User
```json
{
  "id": "string (PK, max 64)",
  "email": "string (unique, max 160)",
  "displayName": "string? (max 160)",
  "passwordHash": "string",
  "hasContext": "bool (default: false)",
  "isActive": "bool (default: true)",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### 7.2 UserContext
```json
{
  "id": "Guid (PK)",
  "userId": "string (FK → User, max 64)",
  "language": "string (max 2: vi|en)",
  "rawAnswersJson": "string (JSON array of answers)",
  "jobTitle": "string? (max 120)",
  "toneOfVoice": "string? (max 60)",
  "platformPreferencesJson": "string? (JSON array of strings)",
  "version": "int (incremental)",
  "isActive": "bool",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### 7.3 Trend
```json
{
  "id": "Guid (PK)",
  "title": "string (max 200)",
  "summary": "string (max 1000)",
  "sourceUrl": "string (max 500)",
  "hotLevel": "int (1-5)",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### 7.4 Tag
```json
{
  "id": "Guid (PK)",
  "name": "string (max 60)",
  "slug": "string (unique, max 80)"
}
```

### 7.5 TrendTag (Join Table)
```json
{
  "trendId": "Guid (FK → Trend)",
  "tagId": "Guid (FK → Tag)"
}
```

### 7.6 ContentHistory
```json
{
  "id": "Guid (PK)",
  "userId": "string (FK → User, max 64)",
  "originalTrendId": "Guid? (FK → Trend)",
  "generatedContent": "string (JSON)",
  "mediaUrl": "string? (max 500)",
  "createdAt": "datetime"
}
```

### 7.7 Role
```json
{
  "id": "Guid (PK)",
  "name": "string (unique, max 50)",
  "description": "string? (max 200)",
  "createdAt": "datetime"
}
```

### 7.8 UserRole (Join Table)
```json
{
  "userId": "string (FK → User)",
  "roleId": "Guid (FK → Role)"
}
```

### 7.9 UserToken
```json
{
  "id": "Guid (PK)",
  "userId": "string (FK → User, max 64)",
  "refreshToken": "string (unique, max 256)",
  "expiresAt": "datetime",
  "createdAt": "datetime",
  "revokedAt": "datetime?",
  "isRevoked": "bool"
}
```

### 7.10 ExternalLogin
```json
{
  "id": "Guid (PK)",
  "userId": "string (FK → User, max 64)",
  "provider": "string (max 40: Google, Facebook...)",
  "providerKey": "string (max 200)",
  "createdAt": "datetime"
}
```

---

## 8. Messaging Models

### 8.1 OnboardingMessage (RabbitMQ Queue: `context.onboarding`)
```json
{
  "userId": "string",
  "answers": ["string", "string", "..."],
  "language": "vi",
  "retryCount": 0
}
```

### 8.2 RawTrendItem (RabbitMQ Queue: `trend.raw`)
```json
{
  "title": "string",
  "sourceUrl": "string",
  "content": "string?",
  "publishedAt": "2026-05-20T08:00:00Z"
}
```

---

## Tổng Quan Các Endpoint

| Method | Route                     | Mô tả                                     |
|--------|---------------------------|--------------------------------------------|
| GET    | `/health`                 | Health check                               |
| POST   | `/context/onboarding`     | Submit onboarding answers                  |
| GET    | `/context/persona`        | Get user persona                           |
| PUT    | `/context/persona`        | Update persona manually                    |
| GET    | `/trends`                 | List trends (phân trang, filter by tag)    |
| GET    | `/trends/tags`            | List all tags                              |
| POST   | `/content/generate`       | Generate content (RAG)                     |
| GET    | `/taxonomy/tags`          | Get tag taxonomy                           |
| PUT    | `/taxonomy/tags`          | Update tag taxonomy                        |
