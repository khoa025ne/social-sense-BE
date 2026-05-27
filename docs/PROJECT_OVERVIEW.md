# 🏗️ SocialSense BE – Tổng Quan Chức Năng & Kiến Trúc Dự Án

**Version:** 1.0  
**Ngày cập nhật:** 2026-05-22  
**Framework:** .NET 8.0 Web API (C#)  
**Database:** MySQL 8.0 + Qdrant (Vector DB)  
**Message Queue:** RabbitMQ  
**AI Engine:** Google Gemini API

---

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Kiến trúc hệ thống](#2-kiến-trúc-hệ-thống)
3. [Cấu trúc thư mục dự án](#3-cấu-trúc-thư-mục-dự-án)
4. [Cách vận hành hiện tại](#4-cách-vận-hành-hiện-tại)
5. [Chi tiết từng chức năng](#5-chi-tiết-từng-chức-năng)
   - 5.1 [Context Management Service](#51-context-management-service)
   - 5.2 [Trend Aggregator Service](#52-trend-aggregator-service)
   - 5.3 [RAG Content Generator Service](#53-rag-content-generator-service)
   - 5.4 [Tag Taxonomy Management](#54-tag-taxonomy-management)
6. [Vai trò của AI trong dự án](#6-vai-trò-của-ai-trong-dự-án)
7. [Thư viện & Infrastructure](#7-thư-viện--infrastructure)
8. [Feature Toggles](#8-feature-toggles)
9. [Cách tối ưu AI trong dự án](#9-cách-tối-ưu-ai-trong-dự-án)
10. [Các chức năng chưa triển khai](#10-các-chức-năng-chưa-triển-khai)

---

## 1. Tổng quan dự án

**SocialSense** là hệ thống backend cung cấp API để hỗ trợ người dùng tạo nội dung social media một cách tự động và thông minh. Hệ thống:

1. **Thu thập xu hướng (Trends)** từ các nguồn RSS (VnExpress, Google News, v.v.)
2. **Tóm tắt & gắn tag** xu hướng bằng AI (Gemini)
3. **Xây dựng persona người dùng** từ câu trả lời onboarding, trích xuất bởi AI
4. **Lưu persona dưới dạng vector embedding** vào Qdrant để phục vụ tìm kiếm tương tự (RAG)
5. **Tạo nội dung social media** bằng cách kết hợp xu hướng + persona người dùng thông qua Gemini (kỹ thuật RAG)

**Đối tượng sử dụng:** Content creators, marketers, social media managers

---

## 2. Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Frontend)                          │
└─────────────────────┬───────────────────────────────────────────────┘
                      │ REST API (HTTP)
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    .NET 8.0 WEB API SERVER                         │
│                                                                     │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────────┐ │
│  │  Context     │ │   Trends     │ │  Content   │ │  Taxonomy    │ │
│  │  Controller  │ │  Controller  │ │ Controller │ │  Controller  │ │
│  └──────┬──────┘ └──────┬───────┘ └─────┬──────┘ └──────┬───────┘ │
│         │               │               │               │          │
│  ┌──────▼──────┐ ┌──────▼───────┐ ┌─────▼──────┐ ┌──────▼───────┐ │
│  │  Context    │ │ TrendQuery   │ │  Content   │ │  Taxonomy    │ │
│  │  Service    │ │  Service     │ │  Generator │ │  Service     │ │
│  └──────┬──────┘ └──────────────┘ │  Service   │ └──────────────┘ │
│         │                         └──────┬─────┘                   │
│         │                                │                         │
│  ┌──────▼──────────────────────────────▼──────┐                   │
│  │         AI Layer (Gemini Integration)       │                   │
│  │  ┌──────────────┐  ┌────────────────────┐  │                   │
│  │  │ Context AI   │  │ Trend AI           │  │                   │
│  │  │ Extractor    │  │ Summarizer         │  │                   │
│  │  └──────────────┘  └────────────────────┘  │                   │
│  │  ┌──────────────┐  ┌────────────────────┐  │                   │
│  │  │ Gemini       │  │ Content Generation │  │                   │
│  │  │ Embedding    │  │ (built into CG Svc)│  │                   │
│  │  └──────────────┘  └────────────────────┘  │                   │
│  └────────────────────────────────────────────┘                   │
│                                                                     │
│  ┌──────────────────────────────────────────────┐                  │
│  │         Background Services (Hosted)          │                  │
│  │  ┌────────────────┐  ┌─────────────────────┐ │                  │
│  │  │ TrendCrawl     │  │ TrendSummarization  │ │                  │
│  │  │ Scheduler      │  │ Worker              │ │                  │
│  │  └────────────────┘  └─────────────────────┘ │                  │
│  │  ┌────────────────┐  ┌─────────────────────┐ │                  │
│  │  │ ContextOnboard │  │ QdrantCollection    │ │                  │
│  │  │ Worker         │  │ Initializer         │ │                  │
│  │  └────────────────┘  └─────────────────────┘ │                  │
│  └──────────────────────────────────────────────┘                  │
└─────────┬────────────────────┬─────────────────────┬───────────────┘
          │                    │                     │
          ▼                    ▼                     ▼
┌──────────────┐    ┌──────────────┐      ┌──────────────┐
│   MySQL 8.0  │    │  RabbitMQ    │      │   Qdrant     │
│              │    │              │      │  (Vector DB) │
│ • Users      │    │ • trend.raw  │      │              │
│ • UserContexts│   │ • context.   │      │ • user_      │
│ • Trends     │    │   onboarding │      │   persona    │
│ • Tags       │    └──────────────┘      │   collection │
│ • TrendTags  │                          └──────────────┘
│ • Content    │                                  │
│   Histories  │                                  │
│ • Roles      │                           ┌──────▼──────┐
│ • UserTokens │                           │ Gemini      │
│ • External   │                           │ Embedding   │
│   Logins     │                           │ API         │
└──────────────┘                           └─────────────┘
```

### Kiến trúc tổng quát:

| Thành phần           | Vai trò                                                          |
|----------------------|------------------------------------------------------------------|
| **REST API Layer**   | Tiếp nhận request HTTP từ client, validate, điều phối xử lý     |
| **Service Layer**    | Logic nghiệp vụ chính (CRUD, AI integration, data transformation) |
| **AI Layer**         | Wrapper cho Gemini API (trích xuất persona, tóm tắt trend, sinh content) |
| **Background Layer** | Các hosted service chạy ngầm (crawl RSS, xử lý queue)           |
| **Data Layer**       | EF Core DbContext, truy vấn MySQL                               |
| **Messaging Layer**  | RabbitMQ publishers và consumers                                 |
| **Vector DB Layer**  | Qdrant client cho persona embeddings                             |

### Design Pattern đang sử dụng:

- **Interface-based DI (Dependency Injection):** Tất cả service đều có interface, cho phép swap implementation (ví dụ: `DummyContextAiExtractor` ↔ `GeminiContextAiExtractor`)
- **Feature Toggle Pattern:** Mỗi module có switch bật/tắt qua `appsettings.json`
- **Producer-Consumer Pattern:** Sử dụng RabbitMQ queue giữa scheduler/publisher và worker/consumer
- **RAG (Retrieval-Augmented Generation):** Kết hợp dữ liệu truy xuất (persona + trend) với AI generation
- **Fallback Pattern:** Mọi service AI đều có fallback khi Gemini disabled hoặc lỗi

---

## 3. Cấu trúc thư mục dự án

```
SocialSense-BE/
├── docs/                          # Tài liệu dự án
│   ├── ai/
│   │   ├── AI_SKILL.md            # Đặc tả AI skill
│   │   └── listFunction.md        # Danh sách chức năng
│   ├── api/                       # (API docs – đang phát triển)
│   ├── API_REFERENCE.md           # Tài liệu API chi tiết
│   ├── PROJECT_OVERVIEW.md        # File này
│   └── PROJECT_TODO.md            # Danh sách TODO
├── src/
│   ├── Controllers/               # API Controllers (4 files)
│   │   ├── ContentController.cs   # POST /content/generate
│   │   ├── ContextController.cs   # POST/GET/PUT /context/*
│   │   ├── TagTaxonomyController.cs # GET/PUT /taxonomy/tags
│   │   └── TrendsController.cs    # GET /trends, /trends/tags
│   ├── Services/                  # Business logic (26 files)
│   │   ├── ContextService.cs      # Onboarding + persona CRUD
│   │   ├── ContentGeneratorService.cs # RAG content generation
│   │   ├── TrendQueryService.cs   # Query trends from DB
│   │   ├── TagTaxonomyService.cs  # Taxonomy CRUD
│   │   ├── GeminiContextAiExtractor.cs  # AI persona extraction
│   │   ├── GeminiTrendAiSummarizer.cs   # AI trend summarization
│   │   ├── GeminiEmbeddingClient.cs     # Gemini text-embedding
│   │   ├── QdrantVectorPersonaClient.cs # Qdrant vector operations
│   │   ├── QdrantCollectionInitializer.cs # Auto-create Qdrant collection
│   │   ├── RssTrendSourceClient.cs      # RSS feed crawler
│   │   ├── TrendCrawlScheduler.cs       # Background crawl scheduler
│   │   ├── TrendSummarizationWorker.cs  # Queue consumer for summarization
│   │   ├── ContextOnboardingWorker.cs   # Queue consumer for onboarding
│   │   ├── Dummy*.cs              # Fallback implementations (4 files)
│   │   └── I*.cs                  # Interfaces (9 files)
│   ├── DTOs/                      # Data Transfer Objects (13 files)
│   │   ├── Content/               # GenerateContentRequest/Response
│   │   ├── Context/               # OnboardingRequest/Response, Persona
│   │   ├── Taxonomy/              # TagTaxonomyRequest/Response
│   │   └── Trends/                # TrendListRequest/Response, TagResponse
│   ├── Models/                    # Entity models (10 files)
│   ├── Data/                      # EF Core DbContext (2 files)
│   ├── Messaging/                 # RabbitMQ publishers + models (6 files)
│   ├── Configuration/             # Options classes (9 files)
│   ├── Migrations/                # EF Core migrations
│   ├── Program.cs                 # Application bootstrap & DI
│   ├── SocialSense.csproj         # Project file
│   ├── appsettings.json           # Configuration
│   └── appsettings.Development.json
└── README.md                      # Quick start guide
```

---

## 4. Cách vận hành hiện tại

### 4.1 Khởi động ứng dụng

```bash
cd src
dotnet restore
dotnet ef database update    # Tạo/cập nhật schema MySQL
dotnet run                   # Chạy tại http://localhost:5189
```

### 4.2 Luồng hoạt động tổng thể

```
[User mở app lần đầu]
         │
         ▼
[POST /context/onboarding] ──────────────────────────────┐
   │ Gửi câu trả lời onboarding                         │
   ▼                                                     │ (nếu queue enabled)
[Gemini trích xuất persona] ◄────────────── [RabbitMQ] ◄─┘
   │                                       context.onboarding
   ├──► MySQL (UserContext)
   └──► Qdrant (persona embedding)
         │
         ▼
[User duyệt trends]
         │
         ▼
[GET /trends] ──► MySQL (Trends + Tags)
         │
         ▼
[User chọn trend để tạo content]
         │
         ▼
[POST /content/generate]
   │ trendId + userId
   ├──► MySQL (load Trend data)
   ├──► Qdrant (retrieve persona) ──► fallback MySQL
   ├──► Build RAG prompt
   ├──► Gemini API (generate content)
   └──► Return generated content items
```

### 4.3 Luồng Trend Aggregation (Background)

```
[TrendCrawlScheduler] ──(mỗi 12h)──► [RssTrendSourceClient]
   │                                        │
   │                              Fetch RSS feeds
   │                           (Google News, VnExpress...)
   │                                        │
   ▼                                        ▼
[TrendQueuePublisher] ──────────► [RabbitMQ: trend.raw]
                                        │
                                        ▼
                              [TrendSummarizationWorker]
                                        │
                              Batch N items (default 10)
                                        │
                                        ▼
                              [GeminiTrendAiSummarizer]
                              AI tóm tắt + gán tag
                                        │
                                        ▼
                              [MySQL: Trends + Tags + TrendTags]
```

---

## 5. Chi tiết từng chức năng

---

### 5.1 Context Management Service

| Tiêu chí             | Chi tiết                                                                |
|----------------------|-------------------------------------------------------------------------|
| **Tên chức năng**     | Quản lý Context & Persona Người dùng                                   |
| **Các API**           | `POST /context/onboarding`, `GET /context/persona`, `PUT /context/persona` |
| **Mục tiêu**          | Thu thập thông tin người dùng qua onboarding, sử dụng AI trích xuất persona có cấu trúc, lưu trữ và cung cấp dữ liệu persona cho module Content Generation |

#### Cách vận hành:

1. **Onboarding (Submit):**
   - Người dùng gửi danh sách câu trả lời (tối thiểu 3 câu)
   - Hệ thống có 2 mode:
     - **Sync mode** (`ContextQueue.Enabled = false`): Gọi Gemini trực tiếp, xử lý xong trả kết quả ngay
     - **Async mode** (`ContextQueue.Enabled = true`): Đẩy message vào RabbitMQ queue `context.onboarding`, trả về `status: "queued"`. `ContextOnboardingWorker` sẽ consume và xử lý ngầm

2. **AI Extraction (Gemini):**
   - `GeminiContextAiExtractor` gửi prompt bao gồm câu trả lời onboarding
   - Gemini trả về JSON với các field: `jobTitle`, `toneOfVoice`, `platformPreferences`
   - Validate output, dùng fallback nếu Gemini lỗi hoặc bị tắt

3. **Lưu trữ:**
   - MySQL: tạo record `UserContext` mới (versioned), set record cũ `IsActive = false`
   - Qdrant: tạo embedding từ persona text → upsert vào collection `user_persona`

4. **Get/Update Persona:**
   - `GET`: Trả về version mới nhất từ MySQL
   - `PUT`: Partial update các trường, tự động re-embed vào Qdrant

#### AI cần những thông tin gì:

| Thông tin              | Nguồn                     | Mô tả                                        |
|------------------------|---------------------------|-----------------------------------------------|
| Câu trả lời onboarding | Client (request body)     | Danh sách string, tối thiểu 3 câu            |
| Ngôn ngữ               | Client (request body)     | `"vi"` hoặc `"en"`                           |
| Prompt template         | Hard-coded trong service  | Hướng dẫn AI extract JSON schema cụ thể       |

#### Output AI mong đợi:
```json
{
  "jobTitle": "Content Creator",
  "toneOfVoice": "professional",
  "platformPreferences": ["Facebook", "Instagram"]
}
```

#### Files liên quan:
- `Controllers/ContextController.cs` — Xử lý HTTP request/response
- `Services/ContextService.cs` — Logic nghiệp vụ chính
- `Services/GeminiContextAiExtractor.cs` — Gọi Gemini API trích xuất persona
- `Services/ContextOnboardingWorker.cs` — Background consumer cho queue
- `Messaging/ContextQueuePublisher.cs` — Đẩy message vào RabbitMQ
- `Services/QdrantVectorPersonaClient.cs` — Upsert/query vector embedding
- `Services/GeminiEmbeddingClient.cs` — Tạo embedding từ text

---

### 5.2 Trend Aggregator Service

| Tiêu chí             | Chi tiết                                                                |
|----------------------|-------------------------------------------------------------------------|
| **Tên chức năng**     | Thu thập & Tóm tắt Xu hướng (Trend Aggregator)                         |
| **Các API**           | `GET /trends` (query), `GET /trends/tags` (tags). Phần crawl là background job |
| **Mục tiêu**          | Tự động crawl tin tức từ RSS, dùng AI tóm tắt và gắn tag, lưu vào DB để phục vụ module Content Generation |

#### Cách vận hành:

1. **Crawl Scheduler (`TrendCrawlScheduler`):**
   - Background service chạy định kỳ theo `CrawlIntervalHours` (mặc định 12 giờ)
   - Gọi `ITrendSourceClient.FetchRawItemsAsync()` để lấy raw items từ RSS feeds
   - Đẩy raw items vào RabbitMQ queue `trend.raw` thông qua `TrendQueuePublisher`

2. **RSS Crawler (`RssTrendSourceClient`):**
   - Đọc danh sách RSS feeds từ config `TrendAggregator.Sources`
   - Parse RSS XML bằng `System.ServiceModel.Syndication`
   - Giới hạn `MaxItemsPerSource` items per feed
   - Deduplicate bằng URL

3. **Summarization Worker (`TrendSummarizationWorker`):**
   - Background service consume messages từ RabbitMQ queue `trend.raw`
   - Gom batch theo `BatchSize` (mặc định 10)
   - Gọi `GeminiTrendAiSummarizer.SummarizeAsync()` cho mỗi item
   - Kết quả: summary, hotLevel (1-5), tags
   - Lọc tags theo taxonomy (nếu `Enforced = true`)
   - Upsert Tags → tạo Trends → tạo TrendTags trong MySQL

4. **Query Trends (`TrendQueryService`):**
   - Đọc từ MySQL, hỗ trợ phân trang và filter by tagId
   - Join TrendTags + Tags để trả về kèm danh sách tag

#### AI cần những thông tin gì:

| Thông tin        | Nguồn                        | Mô tả                                |
|------------------|------------------------------|---------------------------------------|
| Title            | Raw RSS item                 | Tiêu đề bài viết nguồn               |
| SourceUrl        | Raw RSS item                 | URL bài viết gốc                     |
| Content          | Raw RSS item (summary/desc)  | Nội dung hoặc mô tả bài viết        |
| AllowedTags      | TagTaxonomyOptions config    | Danh sách tag được phép (nếu có)     |
| Enforced         | TagTaxonomyOptions config    | Bắt buộc dùng tag trong list hay không |

#### Output AI mong đợi:
```json
{
  "summary": "Tóm tắt 2-3 câu về xu hướng...",
  "hotLevel": 4,
  "tags": ["AI", "Marketing"]
}
```

#### Files liên quan:
- `Controllers/TrendsController.cs` — Query endpoint
- `Services/TrendQueryService.cs` — Query logic
- `Services/TrendCrawlScheduler.cs` — Background scheduler
- `Services/RssTrendSourceClient.cs` — RSS crawler
- `Services/TrendSummarizationWorker.cs` — Queue consumer + DB writer
- `Services/GeminiTrendAiSummarizer.cs` — Gọi Gemini tóm tắt + gắn tag
- `Messaging/TrendQueuePublisher.cs` — Publish raw items vào queue
- `Messaging/RawTrendItem.cs` — Message DTO

---

### 5.3 RAG Content Generator Service

| Tiêu chí             | Chi tiết                                                                |
|----------------------|-------------------------------------------------------------------------|
| **Tên chức năng**     | Tạo Nội dung Social Media (RAG Content Generator)                       |
| **Các API**           | `POST /content/generate`                                                |
| **Mục tiêu**          | Tạo nội dung bài đăng social media cá nhân hóa bằng cách kết hợp xu hướng (Trend) + hồ sơ người dùng (Persona) thông qua kỹ thuật RAG và Gemini |

#### Cách vận hành (RAG Pipeline):

```
[Client Request]                    [Gemini API]
  trendId + userId                       ▲
       │                                 │
       ▼                                 │
[1. Load Trend từ MySQL]                 │
       │                                 │
       ▼                                 │
[2. Resolve Persona]                     │
   ├─ Qdrant (primary) ────┐            │
   └─ MySQL (fallback) ────┤            │
                            ▼            │
[3. Build RAG Prompt] ─────────────────►─┘
   • System prompt: persona + rules
   • User prompt: trend title + summary
   • Config: temperature, maxTokens
       │
       ▼
[4. Parse & Validate Output]
   • JSON schema check
   • Title length ≤ 120
   • Body length ≤ 2000
   • Hashtags ≤ 8
   • Strip code fences
       │
       ▼
[5. Return to Client]
```

#### Chi tiết các bước:

1. **Load Trend:** Query `Trends` table từ MySQL, kèm tags thông qua join `TrendTags` + `Tags`
2. **Resolve Persona:**
   - Primary: Gọi Qdrant API retrieve point by userId → lấy payload chứa `jobTitle`, `toneOfVoice`, `platformPreferences`, `language`
   - Fallback: Nếu Qdrant fail → query `UserContexts` table từ MySQL, lấy version mới nhất
3. **Build Prompt:** Ghép persona info + trend info + output rules vào 1 prompt duy nhất
4. **Call Gemini:** POST đến `models/{model}:generateContent` với prompt
5. **Parse Output:** Strip code fences (`\`\`\`json...`) → deserialize JSON → enforce limits

#### AI cần những thông tin gì:

| Thông tin              | Nguồn                     | Mô tả                                              |
|------------------------|---------------------------|-----------------------------------------------------|
| Trend Title            | MySQL (Trends table)      | Tiêu đề xu hướng                                    |
| Trend Summary          | MySQL (Trends table)      | Tóm tắt xu hướng                                    |
| Trend SourceUrl        | MySQL (Trends table)      | URL nguồn                                            |
| Trend Tags             | MySQL (TrendTags + Tags)  | Danh sách tag gắn với trend                          |
| Persona JobTitle       | Qdrant / MySQL            | Nghề nghiệp người dùng                              |
| Persona ToneOfVoice    | Qdrant / MySQL            | Phong cách viết                                      |
| Persona Platforms      | Qdrant / MySQL            | Nền tảng ưu tiên                                     |
| Language               | Client request             | Ngôn ngữ output                                     |
| Output Count           | Client request             | Số biến thể (1-3)                                    |
| MaxTitleLength         | ContentGeneratorOptions    | Giới hạn title (120)                                 |
| MaxBodyLength          | ContentGeneratorOptions    | Giới hạn body (2000)                                 |
| MaxHashtags            | ContentGeneratorOptions    | Giới hạn hashtag (8)                                 |
| Temperature            | ContentGeneratorOptions    | Độ sáng tạo AI (0.7)                                |

#### Output AI mong đợi:
```json
[
  {
    "title": "Tiêu đề bài đăng",
    "body": "Nội dung chi tiết...",
    "hashtags": ["#tag1", "#tag2"]
  }
]
```

#### Fallback Behavior:
Khi Gemini bị tắt hoặc lỗi:
- Trả về content items với `title = trend.Title`, `body = trend.Summary`
- Tags của trend được dùng làm hashtags

#### Files liên quan:
- `Controllers/ContentController.cs` — HTTP endpoint
- `Services/ContentGeneratorService.cs` — RAG logic + Gemini call + parsing
- `Services/QdrantVectorPersonaClient.cs` — Retrieve persona từ Qdrant
- `Configuration/ContentGeneratorOptions.cs` — Cấu hình generation

---

### 5.4 Tag Taxonomy Management

| Tiêu chí             | Chi tiết                                                                |
|----------------------|-------------------------------------------------------------------------|
| **Tên chức năng**     | Quản lý Taxonomy Tag                                                    |
| **Các API**           | `GET /taxonomy/tags`, `PUT /taxonomy/tags`                              |
| **Mục tiêu**          | Quản trị danh sách tag được phép, kiểm soát tag mà AI được gán cho trends |

#### Cách vận hành:

- **In-memory storage:** Taxonomy được load từ `appsettings.json` khi khởi động, lưu trong RAM
- **Enforced mode:** Khi `Enforced = true`, `GeminiTrendAiSummarizer` sẽ lọc tag output của AI để chỉ giữ lại tag nằm trong `AllowedTags`
- **Dynamic update:** Admin có thể thay đổi taxonomy qua API mà không cần restart server
- **Không dùng AI:** Module này hoàn toàn CRUD, không gọi AI

#### Files liên quan:
- `Controllers/TagTaxonomyController.cs` — HTTP endpoints
- `Services/TagTaxonomyService.cs` — Business logic
- `Configuration/TagTaxonomyOptions.cs` — Config model

---

## 6. Vai trò của AI trong dự án

AI (Google Gemini) được sử dụng ở **3 vị trí chính** trong dự án:

### 6.1 Trích xuất Persona (`GeminiContextAiExtractor`)

| Thuộc tính       | Giá trị                                                    |
|------------------|------------------------------------------------------------|
| **Model**        | `gemini-1.5-flash` (mặc định, configurable)               |
| **Temperature**  | 0.2 (thấp → output ổn định, ít creative)                  |
| **Mục đích**     | Chuyển câu trả lời free-form thành JSON có cấu trúc        |
| **Input**        | Danh sách câu trả lời + language                           |
| **Output**       | JSON: `{jobTitle, toneOfVoice, platformPreferences}`        |
| **Fallback**     | `{jobTitle: "Unknown", toneOfVoice: "neutral"}`            |

### 6.2 Tóm tắt Trends (`GeminiTrendAiSummarizer`)

| Thuộc tính       | Giá trị                                                    |
|------------------|------------------------------------------------------------|
| **Model**        | `gemini-1.5-flash` (mặc định)                              |
| **Temperature**  | 0.2 (thấp → tóm tắt chính xác)                            |
| **Mục đích**     | Tóm tắt tin tức + gán tag + đánh giá độ hot               |
| **Input**        | Title + Content/Description + SourceUrl + AllowedTags       |
| **Output**       | JSON: `{summary, hotLevel, tags}`                           |
| **Fallback**     | Dùng title/content gốc cắt ngắn, hotLevel=1, tags rỗng     |

### 6.3 Tạo Content (`ContentGeneratorService`)

| Thuộc tính       | Giá trị                                                    |
|------------------|------------------------------------------------------------|
| **Model**        | `gemini-1.5-pro` (mặc định, configurable)                  |
| **Temperature**  | 0.7 (cao hơn → creative hơn cho content)                   |
| **Mục đích**     | Tạo bài đăng social media cá nhân hóa                     |
| **Input**        | Trend data + Persona data + output rules                    |
| **Output**       | JSON array: `[{title, body, hashtags}]`                    |
| **Fallback**     | Dùng trend title/summary làm content                        |

### 6.4 Embedding (`GeminiEmbeddingClient`)

| Thuộc tính       | Giá trị                                                    |
|------------------|------------------------------------------------------------|
| **Model**        | `text-embedding-004`                                        |
| **Vector Size**  | 768 dimensions                                              |
| **Mục đích**     | Chuyển persona text thành vector để lưu vào Qdrant          |
| **Input**        | Chuỗi text mô tả persona                                   |
| **Output**       | `float[768]`                                                |

---

## 7. Thư viện & Infrastructure

### 7.1 NuGet Packages

| Package                                | Version | Vai trò                                              | Tại sao dùng                                                      |
|----------------------------------------|---------|------------------------------------------------------|--------------------------------------------------------------------|
| `Microsoft.EntityFrameworkCore`        | 8.0.0   | ORM (Object-Relational Mapping)                      | Map C# objects sang MySQL tables, LINQ queries, migrations         |
| `Microsoft.EntityFrameworkCore.Design` | 8.0.0   | Design-time tools cho EF Core                        | Cần để chạy `dotnet ef migrations` commands                       |
| `Pomelo.EntityFrameworkCore.MySql`     | 8.0.0   | MySQL provider cho EF Core                           | EF Core không hỗ trợ MySQL mặc định, Pomelo là provider tốt nhất |
| `RabbitMQ.Client`                      | 7.2.1   | Client library cho RabbitMQ message broker            | Async messaging giữa các component, tránh blocking khi gọi AI    |
| `Swashbuckle.AspNetCore`              | 6.6.2   | Swagger/OpenAPI documentation                        | Tự sinh API docs, UI test tại `/swagger`                          |
| `System.ServiceModel.Syndication`     | 10.0.8  | RSS/Atom feed parser                                 | Parse XML RSS feeds từ các nguồn tin tức                          |

### 7.2 RabbitMQ – Vai trò chi tiết

**RabbitMQ** đóng vai trò là **message broker** trong kiến trúc, giải quyết các vấn đề:

| Vấn đề                              | Giải pháp bằng RabbitMQ                                    |
|--------------------------------------|------------------------------------------------------------|
| **API call Gemini chậm (2-10 giây)** | Đẩy vào queue, xử lý async → API trả về ngay `status: "queued"` |
| **Rate limiting của Gemini**          | Queue đóng vai trò buffer, worker consume theo tốc độ phù hợp |
| **Reliability**                       | Message persistent (`durable: true`), nếu worker crash → message được requeue |
| **Scalability**                       | Có thể chạy nhiều worker instances consume cùng 1 queue    |
| **Decoupling**                        | Scheduler (producer) không phụ thuộc vào Summarizer (consumer) |

**Queues hiện có:**

| Queue Name            | Producer                 | Consumer                      | Mô tả                        |
|-----------------------|--------------------------|-------------------------------|-------------------------------|
| `trend.raw`           | `TrendQueuePublisher`    | `TrendSummarizationWorker`    | Raw RSS items chờ tóm tắt    |
| `context.onboarding`  | `ContextQueuePublisher`  | `ContextOnboardingWorker`     | Onboarding answers chờ extract |

**Cấu hình RabbitMQ:**
```json
{
  "RabbitMQ": {
    "HostName": "localhost",
    "Port": 5672,
    "UserName": "guest",
    "Password": "guest",
    "VirtualHost": "/"
  }
}
```

### 7.3 Qdrant (Vector Database) – Vai trò chi tiết

**Qdrant** là vector database dùng để lưu trữ và tìm kiếm persona embeddings:

| Vai trò                         | Chi tiết                                                        |
|--------------------------------|------------------------------------------------------------------|
| **Lưu persona embedding**      | Persona text → Gemini Embedding API → vector 768D → Qdrant     |
| **Retrieve persona by ID**     | Khi generate content, lấy persona nhanh qua point ID            |
| **Semantic search (tương lai)** | Tìm persona tương tự qua vector similarity (cosine distance)    |

**Collection:** `user_persona`
- **Vector size:** 768
- **Distance metric:** Cosine
- **Payload:** `{userId, jobTitle, toneOfVoice, platformPreferences, language, version}`

**Tại sao dùng Qdrant thay vì chỉ MySQL:**
- MySQL lưu structured data, không hỗ trợ tìm kiếm tương tự (similarity search)
- Qdrant cho phép tìm persona tương tự qua vector distance → có thể dùng cho recommandation trong tương lai
- Tốc độ truy vấn vector nhanh hơn so với full-text search

### 7.4 MySQL – Vai trò chi tiết

**MySQL** là primary database lưu trữ structured data:

| Table            | Vai trò                                                    |
|------------------|-------------------------------------------------------------|
| `Users`          | Thông tin người dùng (email, password hash, hasContext)     |
| `Roles`          | Phân quyền (Admin, Free, Premium)                          |
| `UserRoles`      | Many-to-many User ↔ Role                                    |
| `UserTokens`     | Refresh tokens cho JWT auth                                 |
| `ExternalLogins` | OAuth logins (Google, Facebook)                             |
| `UserContexts`   | Persona data (versioned), raw answers, extracted fields     |
| `Trends`         | Xu hướng đã tóm tắt (title, summary, hotLevel)            |
| `Tags`           | Danh sách tag (name, slug)                                  |
| `TrendTags`      | Many-to-many Trend ↔ Tag                                    |
| `ContentHistories` | Lịch sử content đã tạo                                   |

### 7.5 Gemini API – Vai trò chi tiết

**Google Gemini** là LLM (Large Language Model) chính của dự án:

| Endpoint                                           | Mục đích              |
|----------------------------------------------------|-----------------------|
| `/models/{model}:generateContent`                  | Text generation       |
| `/models/text-embedding-004:embedContent`          | Text embedding (768D) |

**Cách gọi:** HTTP POST trực tiếp qua `HttpClient`, không dùng SDK.

---

## 8. Feature Toggles

Dự án sử dụng feature toggles để bật/tắt từng module. Cấu hình trong `appsettings.json`:

| Toggle Key                  | Default | Ảnh hưởng                                                    |
|-----------------------------|---------|---------------------------------------------------------------|
| `Gemini.Enabled`            | `false` | Bật/tắt **tất cả** Gemini calls (summarization, extraction)  |
| `TrendAggregator.Enabled`   | `false` | Bật/tắt RSS crawl scheduler + summarization worker            |
| `ContentGenerator.Enabled`  | `false` | Bật/tắt Gemini cho content generation (dùng fallback nếu tắt) |
| `Embeddings.Enabled`        | `false` | Bật/tắt Gemini embedding API cho Qdrant upsert               |
| `Qdrant.Enabled`            | `true`  | Bật/tắt Qdrant vector DB (dùng null/dummy nếu tắt)           |
| `ContextQueue.Enabled`      | `false` | Bật/tắt async onboarding qua RabbitMQ                        |
| `TagTaxonomy.Enforced`      | `false` | Bắt buộc tags phải nằm trong AllowedTags list                |

**Khi toggle = false**, hệ thống tự động sử dụng dummy/fallback implementation:
- `DummyContextAiExtractor` → trả persona mặc định
- `DummyTrendAiSummarizer` → cắt ngắn title/content làm summary
- `DummyVectorPersonaClient` → no-op
- `DummyTrendSourceClient` → trả danh sách rỗng

---

## 9. Cách tối ưu AI trong dự án

### 9.1 Tối ưu số lượng request Gemini

| Chiến lược                    | Áp dụng                                                   |
|-------------------------------|-------------------------------------------------------------|
| **Batch processing**          | Trend summarization: 1 request cho N items (qua batch size) |
| **Single request/session**    | Persona extraction: 1 request per onboarding session        |
| **Model selection**           | Flash model cho bulk tasks, Pro cho high-quality content     |
| **Temperature tuning**        | Thấp (0.2) cho extraction/summarization, cao (0.7) cho content |

### 9.2 Tối ưu chất lượng output

| Chiến lược                       | Áp dụng                                                |
|----------------------------------|---------------------------------------------------------|
| **Strict JSON output**           | Prompt yêu cầu "STRICT JSON only", strip code fences   |
| **Output validation**            | Kiểm tra schema, enforce limits (title/body/hashtag)    |
| **Taxonomy filtering**           | Lọc tags theo allowed list sau khi AI trả về            |
| **Fallback on error**            | Luôn có fallback khi Gemini lỗi hoặc trả output sai    |

### 9.3 Tối ưu chi phí

| Chiến lược                       | Áp dụng                                                |
|----------------------------------|---------------------------------------------------------|
| **Model tiering**                | `gemini-1.5-flash` (rẻ) cho summarization, `gemini-1.5-pro` (đắt) cho content |
| **MaxOutputTokens**              | Giới hạn output tokens per module (512 cho summarize, 1024 cho content) |
| **Content truncation**           | Cắt content đầu vào > 2000 chars trước khi đưa vào prompt |
| **Queue buffering**              | RabbitMQ giúp kiểm soát tốc độ gọi AI, tránh burst     |

### 9.4 Cách AI nên vận hành bên trong dự án

1. **Luôn validate output AI:** Không tin tưởng raw output – parse JSON, check schema, enforce limits
2. **Luôn có fallback:** Mọi AI call đều phải có đường dự phòng khi fail
3. **Tách biệt AI logic:** AI calls được isolate trong services riêng (Interface + Implementation), dễ swap/mock
4. **Async cho heavy tasks:** Dùng RabbitMQ queue cho các tác vụ AI tốn thời gian
5. **Log đầy đủ:** Log status code, error body khi Gemini fail để debug

---

## 10. Các chức năng chưa triển khai

| Chức năng                      | Trạng thái | Mô tả                                                |
|--------------------------------|------------|-------------------------------------------------------|
| Auth & User Service            | ❌         | Đăng ký, đăng nhập, JWT, OAuth2, refresh token       |
| Media & Content History        | ❌         | Sinh ảnh, lưu history, phân tích từ lịch sử          |
| Rate limiting & Quota          | ❌         | Giới hạn request per user/service                     |
| Caching (Prompt/Response)      | ❌         | Cache kết quả AI để giảm request                     |
| Observability                  | ❌         | Structured logging, metrics, traceId, alerts          |
| Security (PII masking)         | ❌         | Mask thông tin nhạy cảm trong logs                   |
| Unit/Integration Tests         | ❌         | Testing cho services, DB, queue                       |
| Docker/CI/CD                   | ❌         | Containerization, deployment pipeline                 |
| Persona versioning & retention | ❌         | Chính sách giữ/xóa persona cũ                       |
| Analytics/Insights             | ❌         | Đo hiệu quả content, engagement signals             |
| Scheduler/Publishing           | ❌         | Đăng bài theo lịch                                   |
| Moderation/Safety              | ❌         | Lọc nội dung vi phạm                                 |
| Billing/Quota                  | ❌         | Giới hạn theo gói dịch vụ                            |

---

## Phụ lục: Bảng Tóm tắt Tất cả Services

| Service                          | Interface                  | Loại         | Vai trò                              |
|----------------------------------|----------------------------|--------------|--------------------------------------|
| `ContextService`                 | `IContextService`          | Scoped       | Onboarding + persona CRUD            |
| `GeminiContextAiExtractor`       | `IContextAiExtractor`      | Singleton    | AI trích xuất persona                |
| `ContentGeneratorService`        | `IContentGeneratorService` | HttpClient   | RAG content generation               |
| `TrendQueryService`              | `ITrendQueryService`       | Scoped       | Query trends từ MySQL                |
| `GeminiTrendAiSummarizer`        | `ITrendAiSummarizer`       | Singleton    | AI tóm tắt + gắn tag trends         |
| `RssTrendSourceClient`           | `ITrendSourceClient`       | Singleton    | Crawl RSS feeds                      |
| `TagTaxonomyService`             | `ITagTaxonomyService`      | Singleton    | Quản lý taxonomy tag                 |
| `GeminiEmbeddingClient`          | `IEmbeddingClient`         | HttpClient   | Tạo text embeddings                  |
| `QdrantVectorPersonaClient`      | `IVectorPersonaClient`     | Singleton    | CRUD persona vectors trong Qdrant    |
| `QdrantCollectionInitializer`    | `IHostedService`           | Hosted       | Auto-create Qdrant collection        |
| `TrendCrawlScheduler`            | `BackgroundService`        | Hosted       | Định kỳ crawl RSS                    |
| `TrendSummarizationWorker`       | `BackgroundService`        | Hosted       | Consume & summarize raw trends       |
| `ContextOnboardingWorker`        | `BackgroundService`        | Hosted       | Consume & process onboarding queue   |
| `ContextQueuePublisher`          | `IContextQueuePublisher`   | Singleton    | Publish onboarding messages          |
| `TrendQueuePublisher`            | `ITrendQueuePublisher`     | Singleton    | Publish raw trend items              |
