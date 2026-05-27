# SocialSense

Backend for SocialSense APIs and services.

## Requirements
- .NET 8 SDK

## Local dependencies
- MySQL 8.x (or compatible)
- RabbitMQ (for queues)
- Qdrant (for vector persona, local recommended)

## Build
- dotnet build ./src/SocialSense.csproj

## Run
- dotnet run --project ./src/SocialSense.csproj

## Migrations
- dotnet ef migrations add <Name> --project ./src/SocialSense.csproj --startup-project ./src/SocialSense.csproj -o Migrations
- dotnet ef database update --project ./src/SocialSense.csproj --startup-project ./src/SocialSense.csproj

## Configuration
- ConnectionStrings:Default in appsettings.json
- RabbitMQ settings in appsettings.json
- Qdrant settings in appsettings.json
- Gemini and Embeddings settings in appsettings.json

## Feature toggles
- TrendAggregator.Enabled: enable RSS crawling + queue worker
- Gemini.Enabled: enable Gemini for trend summarization and context extraction
- ContentGenerator.Enabled: enable Gemini for content generation
- Embeddings.Enabled: enable Gemini embeddings for Qdrant upsert
- ContextQueue.Enabled: enable onboarding queue (returns status=queued)
- TagTaxonomy.Enforced: force tags to match AllowedTags list

## Key endpoints
- GET /health
- POST /context/onboarding
- GET /context/persona?userId=...
- PUT /context/persona?userId=...
- GET /trends
- GET /trends/tags
- POST /content/generate
- GET /taxonomy/tags
- PUT /taxonomy/tags

## Health Check
- GET /health
