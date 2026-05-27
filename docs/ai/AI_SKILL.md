# AI SKILL SPECIFICATION (SocialSense BE)

Version: 0.1 (Draft)
Date: 2026-05-19
Owner: Backend/AI Team

---

## 0) Purpose / Mục tiêu

**VI:** Tài liệu này mô tả bối cảnh dự án, phạm vi AI, luồng vận hành AI theo từng module, chuẩn validate input/output, và cách thiết kế request Gemini để tối ưu số request trên mỗi chức năng.

**EN:** This document defines project context, AI scope, AI operational flows per module, input/output validation standards, and Gemini request design to optimize request volume per function.

---

## 1) Project Context / Bối cảnh dự án

**VI:** Hệ thống BE xây trên C#/.NET Core gồm REST APIs và Background Services. RabbitMQ xử lý queue các tác vụ crawl dữ liệu và gọi LLM để tránh nghẽn. MySQL lưu dữ liệu có cấu trúc (User/Auth/Trends/ContentHistory). Vector DB (Pinecone/Qdrant) lưu embeddings của UserPersona để phục vụ RAG.

**EN:** Backend uses C#/.NET Core (REST APIs + background services). RabbitMQ queues crawling and LLM calls to prevent bottlenecks. MySQL stores structured data (User/Auth/Trends/ContentHistory). Vector DB (Pinecone/Qdrant) stores UserPersona embeddings for RAG.

---

## 2) Scope / Phạm vi

### 2.1 In scope (Core modules)
- Auth & User Service
- Context Management Service
- Trend Aggregator Service
- RAG Content Generator Service
- Media & Content History Service

### 2.2 Suggested extensions / Gợi ý module mở rộng
- Analytics/Insights Service (đo hiệu quả content, engagement signals)
- Scheduler/Publishing Service (đăng bài theo lịch)
- Moderation/Safety Service (lọc nội dung vi phạm)
- Billing/Quota Service (giới hạn theo gói, theo token)
- Prompt/Template Registry (quản lý prompt & versioning)
- Cache Layer (cache trend summary, prompt result)

### 2.3 Out of scope (for now)
- Multi-tenant enterprise SSO, data lake, and BI pipelines

---

## 3) Global AI Operating Principles / Nguyên tắc chung

### 3.1 AI request lifecycle / Vòng đời gọi AI
1. Receive request -> validate DTO
2. Build AI payload -> add metadata (traceId, userId, requestId)
3. Queue (RabbitMQ) when async or heavy
4. Call Gemini -> parse & validate output schema
5. Persist -> return response -> audit log

### 3.2 Reliability / Độ tin cậy
- Retry with exponential backoff + jitter for transient errors
- Circuit breaker for Gemini API timeouts
- Idempotency key for retries (avoid duplicate content)

### 3.3 Cost control / Kiểm soát chi phí
- Prefer Gemini 1.5 Flash for bulk tasks; Pro for high-quality content
- Token budget per module + truncation rules
- Batch where possible (e.g., trend summarization)

### 3.4 Safety & compliance / An toàn
- Mask PII in logs
- Store prompts/outputs with retention policy
- Add safety filter for generated content

---

## 4) Data Contracts (Common Objects) / Chuẩn dữ liệu chung

### 4.1 UserPersona
```json
{
  "userId": "uuid",
  "jobTitle": "string",
  "toneOfVoice": "string",
  "platformPreferences": ["string"],
  "brandKeywords": ["string"],
  "audience": "string",
  "contentGoals": ["string"],
  "language": "vi|en",
  "lastUpdatedAt": "ISO-8601"
}
```

### 4.2 TrendItem
```json
{
  "trendId": "uuid",
  "title": "string",
  "summary": "string",
  "sourceUrl": "string",
  "hotLevel": 1,
  "tags": ["string"],
  "createdAt": "ISO-8601"
}
```

### 4.3 GeneratedContent
```json
{
  "title": "string",
  "body": "string",
  "hashtags": ["string"],
  "language": "vi|en",
  "safetyFlag": false
}
```

### 4.4 ImageRequest
```json
{
  "prompt": "string",
  "style": "string",
  "aspectRatio": "1:1|4:5|16:9",
  "brandKeywords": ["string"],
  "outputCount": 1
}
```

---

## 5) Validation Standards / Chuẩn validate

### 5.1 Recommended validation stack
**VI:** Ưu tiên FluentValidation cho DTOs; DataAnnotations cho ràng buộc đơn giản. Dùng middleware chuẩn hóa lỗi (error code + message).

**EN:** Use FluentValidation for DTOs; DataAnnotations for simple constraints. Standardize error responses (error code + message).

### 5.2 Input validation checklist (applies to all modules)
- Required fields present (null/empty checks)
- Length/size bounds
- Allowed enum values
- URL format validation
- Language and locale validation
- Rate limit per user/service
- Idempotency key for mutation endpoints

### 5.3 Output validation for LLM
- Strict JSON schema validation
- Reject outputs with missing fields
- Sanitize/normalize hashtags
- Language detection (optional)
- Safety filter (profanity or policy rules)

---

## 6) Module AI Skills / Kỹ năng AI theo module

### 6.1 Auth & User Service
**AI role / Vai trò AI:** None by default. Optional: anomaly detection or login risk scoring.

**Flow / Luồng:**
- User login -> DB check -> if `HasContext == false` -> redirect to onboarding

**Validation:**
- Email/phone format, password policy, OAuth token validation

**Questions for stakeholder:**
- Có cần AI để phát hiện hành vi đăng nhập bất thường không?
- Có cần AI để kiểm tra profile completeness không?

---

### 6.2 Context Management Service
**AI role / Vai trò AI:** Convert onboarding answers into structured UserPersona.

**Flow / Luồng:**
1. Receive onboarding answers
2. Validate -> queue
3. Gemini extracts UserPersona JSON
4. Save metadata to MySQL + embeddings to Vector DB

**Validation (input):**
- Minimum answers count
- Max token per answer
- Language required

**Validation (output):**
- Must match UserPersona schema
- `toneOfVoice` in whitelist
- `platformPreferences` in allowed platforms

**Gemini request optimization:**
- Single request per onboarding session
- Cache prompt template by version

**Questions for stakeholder:**
- Persona fields nào là bắt buộc? Field nào là optional?
- Có cần re-run persona extraction khi user cập nhật profile không?

---

### 6.3 Trend Aggregator Service
**AI role / Vai trò AI:** Summarize trend items and tag categories.

**Flow / Luồng:**
1. Crawl RSS/API -> push raw items to RabbitMQ
2. Consumer batches items
3. Gemini summarizes + tags
4. Save Trends + Tags + TrendTags in MySQL

**Validation (input):**
- `sourceUrl` format
- `title` length <= 200
- Max batch size (e.g., 10 items)

**Validation (output):**
- Summary length range
- Tags in allowed taxonomy
- Deduplicate tags

**Gemini request optimization:**
- Batch 5-10 items per request
- Use deterministic temperature for tagging

**Questions for stakeholder:**
- Tag taxonomy có cố định không? ai quản lý?
- Summary length mục tiêu bao nhiêu ký tự?

---

### 6.4 RAG Content Generator Service
**AI role / Vai trò AI:** Generate post content from Trend + UserPersona.

**Flow / Luồng:**
1. FE sends TrendId + UserId
2. Load Trend from MySQL
3. Retrieve similar Persona from Vector DB
4. Assemble system prompt -> Gemini generation
5. Validate JSON -> return to FE

**Validation (input):**
- TrendId/UserId existence
- Token budget for prompt

**Validation (output):**
- JSON schema
- Title length <= 120
- Hashtag count <= 8
- Safety filter pass

**Gemini request optimization:**
- Prompt caching by (trendId + personaVersion)
- Priority queue for paid users
- Retry once with shorter prompt if token overflow

**Questions for stakeholder:**
- Cần số lượng variant cho mỗi request không? (1/3/5)
- Có cần tone/style presets không?

---

### 6.5 Media & Content History Service
**AI role / Vai trò AI:** Image generation via external AI APIs; store content history.

**Flow / Luồng:**
1. Receive image request -> validate
2. Build prompt -> call image API
3. Save media URL + content history

**Validation (input):**
- Prompt length
- Aspect ratio whitelist
- `outputCount` bounds

**Validation (output):**
- URL format
- Content type allowed

**Questions for stakeholder:**
- Có yêu cầu watermark hay brand overlay?
- Có cần safety check trước khi lưu ảnh?

---

## 7) Gemini Request Design / Thiết kế request Gemini

### 7.1 API key handling
- Store key in secret manager or env vars
- Rotate key quarterly
- Never log raw key

### 7.2 Request payload strategy
- Use short system prompt + structured JSON output instructions
- Enforce max tokens per module
- Add `traceId` and `requestId` for observability

### 7.3 Rate limiting and quotas
- Per-user: N requests/day
- Per-service: RPM/TPM budgets
- Queue overflow -> degrade gracefully (return cached or fallback)

### 7.4 Batching strategy (selected)
- Trend summarization: batch 5-10 items/request
- Persona extraction: 1 user/session
- Content generation: 1 trend/persona/request

---

## 8) Observability / Theo dõi & đo lường

- Metrics: success rate, latency, tokens per request, cost per module
- Logs: prompt hash, output size, error type
- Alerts: high error rate, RPM spikes, queue backlog

---

## 9) Security & Logging / Bảo mật & logging

**VI:** Mask PII trong logs; lưu metadata của prompt/output; có retention policy (30-90 ngày). Chỉ lưu full prompt/output khi có opt-in.

**EN:** Mask PII in logs; store prompt/output metadata; define retention (30-90 days). Store full prompt/output only with opt-in.

---

## 10) Open Questions Checklist / Danh sách câu hỏi mở

### Context & Persona
- Persona schema có cần thêm `industry` hoặc `brandVoiceRules`?
- Cơ chế versioning cho persona như thế nào?

### Trend Aggregation
- Tần suất crawl có cần theo topic trọng điểm?
- Có cần multi-language summary không?

### Content Generation
- Cần output định dạng nào? (JSON, Markdown, HTML)
- Có policy chống spam hoặc claim sai không?

### Media
- Ưu tiên model nào cho ảnh? Có fallback không?
- Giới hạn ảnh/ngày theo user tier?

### Cost & Quota
- Cần đặt ngân sách theo tháng/tenant?
- Cơ chế failover nếu hết quota?

---

## 11) Notes on Free Gemini Tier / Lưu ý về free-tier

**VI:** Chính sách free-tier thay đổi theo thời gian. Hãy kiểm tra Google AI Studio/Cloud Console để xác nhận model và quota hiện hành. Khuyến nghị: dùng Gemini 1.5 Flash cho bulk tasks, Pro cho chất lượng cao.

**EN:** Free-tier policies change over time. Verify current model and quotas in Google AI Studio/Cloud Console. Recommendation: use Gemini 1.5 Flash for bulk tasks, Pro for high-quality tasks.
