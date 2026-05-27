# List Function Detail (SocialSense BE)

Version: 0.1 (Draft)
Date: 2026-05-19
Owner: Backend/AI Team

---

## 1) Auth & User Service

### 1.1 Register (Native)
- Purpose: Create new user with email/password
- Trigger: POST /auth/register
- Inputs:
  - email (string)
  - password (string)
  - name (string)
- Validation:
  - email format, unique
  - password length >= 8, complexity rule
  - name length 2-60
- Output:
  - userId, accessToken (JWT), refreshToken
- AI: none
- Errors:
  - 409: email exists
  - 400: validation error

### 1.2 Login (Native)
- Purpose: Authenticate user
- Trigger: POST /auth/login
- Inputs: email, password
- Validation: email format, password not empty
- Output: accessToken, refreshToken, hasContext
- AI: none
- Notes: if hasContext=false, FE redirect to /onboarding

### 1.3 OAuth Login (Google/Facebook)
- Purpose: Authenticate via OAuth2
- Trigger: POST /auth/oauth
- Inputs: provider, oauthToken
- Validation: provider whitelist, token verification
- Output: accessToken, refreshToken, hasContext
- AI: none

### 1.4 Refresh Token
- Purpose: Rotate access token
- Trigger: POST /auth/refresh
- Inputs: refreshToken
- Validation: token valid, not revoked
- Output: new accessToken

### 1.5 Logout
- Purpose: Revoke refresh token
- Trigger: POST /auth/logout
- Inputs: refreshToken
- Output: success

---

## 2) Context Management Service

### 2.1 Submit Onboarding Answers
- Purpose: Collect onboarding answers
- Trigger: POST /context/onboarding
- Inputs:
  - userId
  - answers[] (string)
  - language (vi|en)
- Validation:
  - answers count >= 3
  - max length per answer
  - language enum
- AI Flow:
  - queue -> Gemini extract UserPersona JSON
  - save metadata to MySQL
  - embed and store to Vector DB
- Output:
  - personaVersion, status=queued|done
- Errors:
  - 422: invalid answers
  - 503: queue unavailable

### 2.2 Get User Persona
- Purpose: Retrieve persona
- Trigger: GET /context/persona
- Inputs: userId
- Output: UserPersona JSON
- AI: none

### 2.3 Update Persona (Manual)
- Purpose: User edits persona fields
- Trigger: PUT /context/persona
- Inputs: partial UserPersona
- Validation: field whitelist, length bounds
- AI: optional re-embed and update vector

---

## 3) Trend Aggregator Service

### 3.1 Crawl Trends (Scheduler)
- Purpose: Pull RSS/API data on schedule
- Trigger: Background job every 12h
- Inputs: source configs
- Output: raw items to RabbitMQ
- AI: none

### 3.2 Summarize & Tag Trends
- Purpose: Clean and tag trends
- Trigger: RabbitMQ consumer
- Inputs: batch raw items
- Validation:
  - sourceUrl format
  - title length <= 200
- AI Flow:
  - batch 5-10 items/request
  - Gemini generates summary + tags
- Output:
  - Trends, Tags, TrendTags rows
- Errors:
  - retry on transient AI errors

### 3.3 List Trends
- Purpose: FE query trends
- Trigger: GET /trends
- Inputs: page, pageSize, tagId, sort
- Validation: bounds, tagId exists
- Output: list of TrendItem

---

## 4) RAG Content Generator Service

### 4.1 Generate Content
- Purpose: Generate post from trend + persona
- Trigger: POST /content/generate
- Inputs:
  - userId
  - trendId
  - outputCount (1-3)
  - language (vi|en)
- Validation:
  - userId/trendId exists
  - outputCount bounds
  - token budget
- AI Flow:
  - fetch Trend from MySQL
  - retrieve persona from Vector DB
  - build system prompt
  - Gemini returns JSON
- Output:
  - GeneratedContent[]
- Errors:
  - 404: trend not found
  - 429: rate limit

### 4.2 Regenerate Variant
- Purpose: regenerate with same trend
- Trigger: POST /content/regenerate
- Inputs: userId, trendId, seed
- AI: same as Generate Content, with variant seed

---

## 5) Media & Content History Service

### 5.1 Generate Image
- Purpose: create media from prompt
- Trigger: POST /media/generate
- Inputs: ImageRequest
- Validation: prompt length, aspectRatio whitelist
- AI Flow:
  - call image API
  - store media URL
- Output: mediaUrl

### 5.2 Save Content History
- Purpose: store generated content
- Trigger: POST /history
- Inputs: userId, trendId, content, mediaUrl
- Validation: content size, URL format
- Output: historyId

### 5.3 List Content History
- Purpose: list user history
- Trigger: GET /history
- Inputs: userId, page, pageSize
- Output: list of ContentHistories

---

## 6) Suggested Extensions (Optional)

### 6.1 Analytics/Insights
- Purpose: measure content performance
- Inputs: engagement signals, postId
- AI: optional clustering or topic insights

### 6.2 Scheduler/Publishing
- Purpose: schedule posts
- Inputs: contentId, publishTime
- Validation: time in future

### 6.3 Moderation/Safety
- Purpose: block unsafe content
- AI: Gemini safety or external moderation

### 6.4 Billing/Quota
- Purpose: enforce plan limits
- Inputs: userId, planId

### 6.5 Prompt/Template Registry
- Purpose: manage prompt versions
- Inputs: templateId, version, body

---

## 7) Common Error Codes
- 400: validation error
- 401: unauthorized
- 403: forbidden
- 404: not found
- 409: conflict
- 429: rate limit
- 500: internal error

---

## 8) Non-functional Requirements (Summary)
- Idempotency for mutation endpoints
- Rate limit per user and per service
- Observability: traceId, requestId, latency metrics
- Retry with backoff for AI calls
