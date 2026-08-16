# Script kiểm tra credits và models OpenRouter
$apiKey = Read-Host "Nhập OpenRouter API Key"

Write-Host "`n=== Kiểm tra Credits ===" -ForegroundColor Cyan
try {
    $headers = @{
        "Authorization" = "Bearer $apiKey"
        "HTTP-Referer" = "https://socialsense.vn"
    }
    
    $credits = Invoke-RestMethod -Uri "https://openrouter.ai/api/v1/auth/key" -Headers $headers -Method GET
    Write-Host "✅ Credits còn lại: `$$($credits.data.limit)" -ForegroundColor Green
    Write-Host "✅ Rate limit: $($credits.data.rate_limit)" -ForegroundColor Green
} catch {
    Write-Host "❌ Lỗi kiểm tra credits: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Các model FREE/RẺ nhất ===" -ForegroundColor Cyan
Write-Host "1. google/gemini-2.0-flash-exp:free - MIỄN PHÍ hoàn toàn" -ForegroundColor Green
Write-Host "2. meta-llama/llama-3.1-8b-instruct:free - MIỄN PHÍ" -ForegroundColor Green
Write-Host "3. microsoft/phi-3-mini-128k-instruct:free - MIỄN PHÍ" -ForegroundColor Green
Write-Host "4. qwen/qwen-2-7b-instruct:free - MIỄN PHÍ" -ForegroundColor Green
Write-Host "5. meta-llama/llama-3.2-3b-instruct:free - MIỄN PHÍ" -ForegroundColor Green
Write-Host "`n6. google/gemini-flash-1.5 - `$0.00001/1k tokens (RẺ)" -ForegroundColor Yellow
Write-Host "7. anthropic/claude-3.5-haiku - `$0.00025/1k tokens" -ForegroundColor Yellow

Write-Host "`n=== Test model FREE ===" -ForegroundColor Cyan
$testModel = "google/gemini-2.0-flash-exp:free"
$body = @{
    model = $testModel
    messages = @(
        @{
            role = "user"
            content = "Viết 1 câu hook ngắn về BĐS TP.HCM"
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $result = Invoke-RestMethod -Uri "https://openrouter.ai/api/v1/chat/completions" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -ContentType "application/json"
    
    Write-Host "✅ Test thành công!" -ForegroundColor Green
    Write-Host "Response: $($result.choices[0].message.content)" -ForegroundColor White
    Write-Host "`nCost: `$$($result.usage.prompt_tokens * 0) (FREE)" -ForegroundColor Green
} catch {
    Write-Host "❌ Lỗi test: $($_.Exception.Message)" -ForegroundColor Red
}
