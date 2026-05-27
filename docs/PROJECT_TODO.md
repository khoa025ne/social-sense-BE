# TODO Du an - SocialSense BE

Chu giai: [x] da xong, [ ] can lam

## 0) Nen tang du an
- [x] Khoi tao du an .NET 8 Web API
- [x] Tao folder chuan (Controllers/Services/Data/Models/DTOs/Messaging/Configuration)
- [x] Them EF Core + Pomelo MySQL
- [x] Them RabbitMQ.Client
- [x] Them Swagger + health endpoint
- [x] Build thanh cong
- [x] Tao tai lieu AI (AI_SKILL + listFunction)

## 1) CSDL & migrations
- [x] Dinh nghia entity cot loi (Users/Roles/UserTokens/ExternalLogins/Trends/Tags/TrendTags/ContentHistories)
- [x] Them index cho Trends (CreatedAt, TagId) va cac duong nong khac
- [x] Tao migration EF Core
- [x] Ap dung migration len DB dev

## 2) Auth & User Service
- [ ] Endpoint dang ky/dang nhap
- [ ] Cap JWT + refresh token flow
- [ ] Tich hop OAuth2 (Google/Facebook)
- [ ] Kiem tra HasContext va dieu huong onboarding
- [ ] Schema User/Role + seed data

## 3) Context Management Service
- [x] DTOs + Controller + Service (luong co ban)
- [x] Luu onboarding answers + persona metadata vao MySQL
- [x] Dummy AI extractor stub
- [x] Thay dummy extractor bang Gemini
- [x] Them queue cho onboarding extraction
- [x] Luu embeddings vao Vector DB (Pinecone/Qdrant)
- [ ] Chinh sach versioning + retention cho persona

## 4) Trend Aggregator Service
- [x] Scheduler (12h) de crawl RSS/API
- [x] RabbitMQ producer cho raw items
- [x] Consumer tom tat + gan tag qua AI (Gemini, bat/tat bang config)
- [x] Quan ly taxonomy tag
- [x] Luu Trends/Tags/TrendTags

## 5) RAG Content Generator Service
- [x] Endpoint gen content tu TrendId + UserId
- [x] Query Trend tu MySQL
- [x] Query persona tu Vector DB (Qdrant)
- [x] Ghep prompt + Gemini generation (co fallback)
- [x] Validate output (JSON schema, so hashtag, safety)

## 6) Media & Content History Service
- [ ] Tich hop sinh anh (DALL-E/Midjourney hoac khac)
- [ ] Luu media URLs
- [ ] Endpoint lich su content
- [ ] Job phan tich tu lich su (cap nhat persona)

## 7) Messaging & background processing
- [ ] Vong doi ket noi RabbitMQ + retry policy
- [ ] Quy uoc ten queue
- [ ] Idempotency keys cho consumer

## 8) AI Integration (Gemini)
- [x] Wrapper Gemini + quan ly API key
- [ ] Rate limiting & quota theo module
- [ ] Chien luoc batching request
- [ ] Chien luoc caching (prompt/response hash)
- [ ] Observability (token usage, cost)

## 9) Observability & reliability
- [ ] Logging co cau truc + traceId
- [ ] Metrics (latency, error rate, queue backlog)
- [ ] Canh bao RPM bat thuong va loi

## 10) Security & compliance
- [ ] Mask PII trong log
- [ ] Secret management cho API keys
- [ ] Audit trail cho AI calls

## 11) Testing
- [ ] Unit tests cho services
- [ ] Integration tests (DB + queue)
- [ ] Contract tests cho AI output schema

## 12) DevOps & deployment
- [ ] Dockerfile + docker-compose (MySQL/RabbitMQ)
- [ ] CI pipeline (build + tests)
- [ ] Cau hinh moi truong (dev/staging/prod)

## 13) Documentation
- [x] Cap nhat README (run + env)
- [ ] API reference (Swagger export)
- [ ] So do kien truc

---

## Ghi chu (AI tu dong cap nhat)
- 2026-05-19: Da khoi tao du an, cau hinh EF Core + RabbitMQ, hoan thanh Context module co ban.
- 2026-05-19: Da them tai lieu AI (AI_SKILL.md, listFunction.md).
- 2026-05-19: Da them cac entity cot loi, index co ban va migration InitialCreate; dung MySQL server version tuong minh de tao migration.
- 2026-05-19: Da apply migration InitialCreate len DB dev.
- 2026-05-19: Da them Trend Aggregator skeleton (scheduler + publisher + consumer), mac dinh tat qua TrendAggregator.Enabled=false, dang su dung dummy source/AI.
- 2026-05-19: Da them RSS crawler (RssTrendSourceClient) + config nguon RSS trong appsettings; TrendAggregator.Enabled can bat khi chay that.
- 2026-05-19: Da tich hop Gemini cho tom tat trend (GeminiTrendAiSummarizer), mac dinh tat qua Gemini.Enabled=false.
- 2026-05-20: Da them TagTaxonomy config va loc tag theo taxonomy trong summarizer + worker.
- 2026-05-20: Da them RAG Content Generator (endpoint /content/generate) + ContentGeneratorOptions; vector DB dang stub, fallback tu UserContext.
- 2026-05-20: Da them endpoint quan tri taxonomy (GET/PUT /taxonomy/tags) de cap nhat danh sach tag.
- 2026-05-20: Da tich hop Qdrant local + Gemini embeddings (text-embedding-004) cho persona; upsert khi onboarding va update.
- 2026-05-20: Da thay context extractor sang Gemini (GeminiContextAiExtractor), dung chung config Gemini.
- 2026-05-20: Da them ContextQueue (publisher + worker) va che do queued cho onboarding.
- 2026-05-20: Da cap nhat README voi huong dan run, config, va feature toggles.
