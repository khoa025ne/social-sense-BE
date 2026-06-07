# 📊 FE Guide — Analytics Interpreter

> Hướng dẫn tích hợp tính năng **Phân tích Analytics** cho đội Frontend.
> Base URL: `https://truthful-youth-production-d00b.up.railway.app`

---

## 🎯 Tổng quan tính năng

Analytics Interpreter giúp content creator (đặc biệt người mới) hiểu số liệu
mạng xã hội của mình thông qua AI — giải thích đơn giản, so sánh 2 kỳ, đưa ra
gợi ý hành động cụ thể.

**Platforms hỗ trợ:** TikTok · Facebook · Instagram · YouTube

**2 chức năng chính:**
1. **Phân tích 1 kỳ** — AI giải thích từng chỉ số, đánh giá tổng thể
2. **So sánh 2 kỳ** — AI so sánh kỳ này vs kỳ trước, highlight tiến bộ & cần cải thiện

---

## 🔑 Authentication

Tất cả endpoints (trừ `/analytics/template`) yêu cầu JWT Bearer token.

```http
Authorization: Bearer <accessToken>
```

---

## 📋 Danh sách Endpoints

| Method | Endpoint | Auth | Quota | Mô tả |
|--------|----------|------|-------|-------|
| GET | `/analytics/template` | ❌ | 0 | Tải file Excel template |
| POST | `/analytics/upload` | ✅ | 0 | Parse file Excel → metrics JSON |
| POST | `/analytics/analyze` | ✅ | -1 | AI phân tích 1 kỳ |
| POST | `/analytics/compare` | ✅ | -1 | AI so sánh 2 kỳ |
| POST | `/analytics/upload-and-compare` | ✅ | -1 | Upload + so sánh 1 bước |
| GET | `/analytics/history` | ✅ | 0 | Lịch sử phân tích |
| GET | `/analytics/history/{id}` | ✅ | 0 | Chi tiết 1 report |

---

## 📥 Endpoint 1: Tải Template Excel

```http
GET /analytics/template
```

Response: file `.xlsx` (2703 bytes) với 2 sheet:
- Sheet 1: `Kỳ này`
- Sheet 2: `Kỳ trước`

**FE implementation:**
```javascript
// Trigger download trực tiếp
window.open(`${BASE_URL}/analytics/template`, '_blank');

// Hoặc download programmatic
const response = await fetch(`${BASE_URL}/analytics/template`);
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'SocialSense_Analytics_Template.xlsx';
a.click();
```

**Template format:**

| Chỉ số | Giá trị |
|--------|---------|
| Platform | TikTok |
| Kỳ báo cáo | Tháng 6/2026 |
| Tổng tiếp cận | 482300 |
| Lượt hiển thị | |
| Tổng tương tác | 89700 |
| Lượt thích | |
| Bình luận | |
| Lượt chia sẻ | |
| Lượt click | |
| Người theo dõi mới | 2340 |
| Lượt xem trang cá nhân | |
| Tỉ lệ tương tác (%) | 18.6 |
| Tỷ lệ hoàn thành (%) | 72.4 |
| Thời gian xem TB (giây) | 108 |
| Tỷ lệ chuyển đổi (%) | 3.2 |
| CTR (%) | |
| Số bài đăng | |

> ⚠️ User chỉ cần điền cột "Giá trị". Để trống = không phân tích chỉ số đó.

---

## 📤 Endpoint 2: Upload File Parse (Không tốn quota)

```http
POST /analytics/upload
Content-Type: multipart/form-data
```

**Request:**
```javascript
const formData = new FormData();
formData.append('file', excelFile); // .xlsx only, max 5MB

const res = await fetch(`${BASE_URL}/analytics/upload`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData
});
```

**Response 200:**
```json
{
  "message": "Đọc file thành công.",
  "periodA": {
    "platform": "TikTok",
    "periodLabel": "Tháng 6/2026",
    "reach": 482300,
    "totalEngagement": 89700,
    "newFollowers": 2340,
    "engagementRate": 18.6,
    "completionRate": 72.4,
    "avgViewDurationSeconds": 108,
    "conversionRate": 3.2
  },
  "periodB": {
    "platform": "TikTok",
    "periodLabel": "Tháng 5/2026",
    "reach": 419000,
    "totalEngagement": 82500
  }
}
```

**Error codes:**
| Code | HTTP | Nguyên nhân |
|------|------|------------|
| `INVALID_FILE` | 400 | File null hoặc rỗng |
| `INVALID_FILE_FORMAT` | 400 | Không phải .xlsx |
| `FILE_TOO_LARGE` | 400 | > 5MB |
| `PARSE_ERROR` | 422 | File hỏng hoặc sai cấu trúc |

---

## 🤖 Endpoint 3: Phân tích 1 kỳ (Tốn 1 quota)

```http
POST /analytics/analyze
Content-Type: application/json
```

**Request:**
```json
{
  "metrics": {
    "platform": "TikTok",
    "periodLabel": "Tháng 6/2026",
    "reach": 482300,
    "totalEngagement": 89700,
    "newFollowers": 2340,
    "engagementRate": 18.6,
    "completionRate": 72.4,
    "avgViewDurationSeconds": 108,
    "conversionRate": 3.2,
    "likes": 71760,
    "comments": 8970,
    "shares": 4485,
    "clicks": 14352,
    "profileVisits": 9646,
    "clickThroughRate": 2.9,
    "postsCount": 28
  }
}
```

**Tất cả fields trong `metrics`:**

| Field | Type | Bắt buộc | Mô tả |
|-------|------|---------|-------|
| `platform` | string | ✅ | TikTok / Facebook / Instagram / YouTube |
| `periodLabel` | string | ✅ | VD: "Tháng 6/2026", "Tuần 1 tháng 6" |
| `reach` | long? | ❌ | Tổng tiếp cận |
| `impressions` | long? | ❌ | Lượt hiển thị |
| `totalEngagement` | long? | ❌ | Tổng tương tác |
| `likes` | long? | ❌ | Lượt thích |
| `comments` | long? | ❌ | Bình luận |
| `shares` | long? | ❌ | Lượt chia sẻ |
| `clicks` | long? | ❌ | Lượt click |
| `newFollowers` | long? | ❌ | Người theo dõi mới |
| `profileVisits` | long? | ❌ | Lượt xem trang cá nhân |
| `engagementRate` | double? | ❌ | % (VD: 18.6) |
| `completionRate` | double? | ❌ | % (VD: 72.4) |
| `avgViewDurationSeconds` | double? | ❌ | Giây (VD: 108 = 1:48) |
| `conversionRate` | double? | ❌ | % (VD: 3.2) |
| `clickThroughRate` | double? | ❌ | CTR % |
| `postsCount` | int? | ❌ | Số bài đăng trong kỳ |

> Chỉ cần truyền các field **có dữ liệu**. Field null sẽ không được phân tích.

---

## 🔄 Endpoint 4: So sánh 2 kỳ (Tốn 1 quota)

```http
POST /analytics/compare
Content-Type: application/json
```

**Request:**
```json
{
  "periodA": {
    "platform": "TikTok",
    "periodLabel": "Tháng 6/2026",
    "reach": 482300,
    "totalEngagement": 89700,
    "newFollowers": 2340,
    "engagementRate": 18.6,
    "completionRate": 72.4,
    "conversionRate": 3.2
  },
  "periodB": {
    "platform": "TikTok",
    "periodLabel": "Tháng 5/2026",
    "reach": 419000,
    "totalEngagement": 82500,
    "newFollowers": 1910,
    "engagementRate": 18.9,
    "completionRate": 69.4,
    "conversionRate": 3.5
  }
}
```

> `periodA` = kỳ **mới hơn** (kỳ này), `periodB` = kỳ **cũ hơn** (kỳ trước).

---

## 📁 Endpoint 5: Upload + Compare 1 bước (Tốn 1 quota)

```http
POST /analytics/upload-and-compare
Content-Type: multipart/form-data
```

Gộp upload file + so sánh thành 1 request duy nhất.

```javascript
const formData = new FormData();
formData.append('file', filledExcelFile);

const res = await fetch(`${BASE_URL}/analytics/upload-and-compare`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData
});
const result = await res.json(); // AnalyticsReportResponse
```

---

## 📊 Response Schema — AnalyticsReportResponse

Dùng cho cả `/analyze`, `/compare`, `/upload-and-compare`, `/history/{id}`:

```json
{
  "id": 5,
  "platform": "TikTok",
  "reportType": "compare",
  "periodALabel": "Tháng 6/2026",
  "periodBLabel": "Tháng 5/2026",
  "createdAt": "2026-06-07T14:23:11Z",
  "result": {
    "platform": "TikTok",
    "reportType": "compare",
    "periodALabel": "Tháng 6/2026",
    "periodBLabel": "Tháng 5/2026",
    "metrics": [
      {
        "metricKey": "reach",
        "metricName": "Tổng tiếp cận",
        "valueAFormatted": "482,300",
        "valueBFormatted": "419,000",
        "changePercent": 15.04,
        "status": "good",
        "simpleExplain": "Nhiều người thấy bài hơn 15% so với tháng trước",
        "detail": "Tổng tiếp cận tăng đáng kể, cho thấy thuật toán đang ưu tiên phân phối nội dung của bạn.",
        "higherIsBetter": true
      },
      {
        "metricKey": "engagementRate",
        "metricName": "Tỉ lệ tương tác",
        "valueAFormatted": "18.6%",
        "valueBFormatted": "18.9%",
        "changePercent": -1.59,
        "status": "warning",
        "simpleExplain": "Tỉ lệ người xem tương tác giảm nhẹ 1.6%",
        "detail": "Dù reach tăng nhưng engagement rate giảm nhẹ — cần theo dõi xu hướng.",
        "higherIsBetter": true
      }
    ],
    "summary": {
      "highlights": [
        "Tổng tiếp cận tăng 15.04%",
        "Người theo dõi mới tăng 22.51%",
        "Tỷ lệ hoàn thành tăng 4.32%"
      ],
      "warnings": [
        "Tỉ lệ tương tác giảm nhẹ",
        "Tỷ lệ chuyển đổi giảm 8.57%"
      ],
      "overallScore": 82,
      "overallTrend": "growing",
      "topRecommendation": "Tối ưu CTA cuối video để cải thiện conversion rate. Thêm link bio và kêu gọi hành động rõ ràng."
    },
    "aiNarrative": "Kỳ tháng 6 nhìn chung tích cực với reach và follower tăng mạnh. Tuy nhiên engagement rate và conversion rate giảm nhẹ cần chú ý tối ưu nội dung..."
  }
}
```

**Giải thích các field quan trọng:**

| Field | Mô tả | Cách dùng trong UI |
|-------|-------|-------------------|
| `metrics[].status` | `good` / `warning` / `critical` / `neutral` | Màu badge: xanh/vàng/đỏ/xám |
| `metrics[].changePercent` | % thay đổi (A so với B) | `+15.2%` hay `-1.6%` |
| `metrics[].valueAFormatted` | Giá trị đã format sẵn | Hiển thị trực tiếp |
| `metrics[].higherIsBetter` | true = tăng là tốt | Để xác định màu mũi tên |
| `summary.overallScore` | 0–100 | Vòng tròn progress |
| `summary.overallTrend` | `growing` / `stable` / `declining` | Icon trend |
| `summary.highlights` | Điểm sáng (array) | Card xanh |
| `summary.warnings` | Điểm cần chú ý (array) | Card vàng |
| `aiNarrative` | Đoạn văn AI | Paragraph text |

---

## 📜 Endpoint 6: Lịch sử phân tích

```http
GET /analytics/history?page=1&pageSize=10
```

**Response:**
```json
{
  "page": 1,
  "pageSize": 10,
  "data": [
    {
      "id": 5,
      "platform": "TikTok",
      "reportType": "compare",
      "periodALabel": "Tháng 6/2026",
      "periodBLabel": "Tháng 5/2026",
      "overallScore": 82,
      "overallTrend": "growing",
      "createdAt": "2026-06-07T14:23:11Z"
    }
  ]
}
```

## 📄 Endpoint 7: Chi tiết report

```http
GET /analytics/history/{id}
```

Trả về `AnalyticsReportResponse` đầy đủ (cùng schema với `/analyze` và `/compare`).

---

## 🎨 UX Flow gợi ý

### Flow A: Nhập tay nhanh (dành cho người không muốn upload file)

```
[Chọn Platform] → [Nhập số liệu kỳ này] → [Nhập số liệu kỳ trước] → [Phân tích]
```

```javascript
// 1. User điền form
const payload = {
  periodA: { platform, periodLabel: 'Tháng 6', reach, engagementRate, ... },
  periodB: { platform, periodLabel: 'Tháng 5', reach, engagementRate, ... }
};

// 2. Gọi compare
const result = await api.post('/analytics/compare', payload);

// 3. Hiện kết quả
renderAnalyticsResult(result);
```

### Flow B: Upload Excel (dành cho người có export từ platform)

```
[Tải template] → [Điền data vào 2 sheet] → [Upload file] → [Xem kết quả]
```

```javascript
// Bước 1: Tải template (chỉ 1 lần)
downloadTemplate();

// Bước 2: User điền Excel, upload lại
const formData = new FormData();
formData.append('file', uploadedFile);

// Bước 3: Upload + phân tích 1 bước
const result = await api.post('/analytics/upload-and-compare', formData);
renderAnalyticsResult(result);
```

---

## 💡 Gợi ý UI Components

### OverallScore Card
```jsx
// overallScore: 0-100
// overallTrend: growing | stable | declining
<ScoreCard
  score={result.summary.overallScore}
  trend={result.summary.overallTrend}
  trendIcon={trend === 'growing' ? '📈' : trend === 'declining' ? '📉' : '➡️'}
/>
```

### Metric Row
```jsx
// Hiển thị từng chỉ số với màu status
<MetricRow
  name={metric.metricName}
  valueA={metric.valueAFormatted}
  valueB={metric.valueBFormatted}      // null nếu single report
  change={metric.changePercent}         // null nếu single report
  status={metric.status}               // good|warning|critical|neutral
  statusColor={{ good: 'green', warning: 'yellow', critical: 'red', neutral: 'gray' }}
  arrow={metric.changePercent > 0 ? '↑' : metric.changePercent < 0 ? '↓' : '→'}
  arrowColor={metric.higherIsBetter
    ? (metric.changePercent >= 0 ? 'green' : 'red')
    : (metric.changePercent <= 0 ? 'green' : 'red')}
/>
```

### Highlights & Warnings
```jsx
<div className="highlights">
  {result.summary.highlights.map(h => <Tag color="green">✅ {h}</Tag>)}
</div>
<div className="warnings">
  {result.summary.warnings.map(w => <Tag color="yellow">⚠️ {w}</Tag>)}
</div>
```

---

## ⚠️ Lưu ý quan trọng

1. **Timeout**: AI có thể mất 20-30 giây → FE cần loading state + timeout 90s
2. **Fallback**: Khi AI fail, BE vẫn trả về kết quả tính toán cơ bản (không phải lỗi)
3. **Quota**: Mỗi lần analyze/compare/upload-and-compare trừ 1 quota
4. **File format**: Chỉ `.xlsx`, tối đa 5MB
5. **avViewDurationSeconds**: BE nhận giây (số), không phải string "1:48"

---

## 📡 Error Handling

```javascript
const analyzeData = async (payload) => {
  try {
    setLoading(true);
    const res = await fetch(`${BASE_URL}/analytics/compare`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90_000) // 90s timeout
    });

    if (res.status === 429) {
      showModal('Hết quota hôm nay. Nâng cấp gói để có thêm lượt phân tích.');
      return;
    }

    const data = await res.json();
    setResult(data);
  } catch (err) {
    if (err.name === 'TimeoutError') showToast('Phân tích quá lâu, thử lại sau');
    else showToast('Có lỗi xảy ra');
  } finally {
    setLoading(false);
  }
};
```

---

## 🧪 Test Data mẫu cho Swagger

**Single analyze:**
```json
{
  "metrics": {
    "platform": "TikTok",
    "periodLabel": "Tháng 6/2026",
    "reach": 482300,
    "totalEngagement": 89700,
    "newFollowers": 2340,
    "engagementRate": 18.6,
    "completionRate": 72.4,
    "avgViewDurationSeconds": 108,
    "conversionRate": 3.2
  }
}
```

**Compare 2 kỳ:**
```json
{
  "periodA": {
    "platform": "TikTok",
    "periodLabel": "Tháng 6/2026",
    "reach": 482300,
    "totalEngagement": 89700,
    "newFollowers": 2340,
    "engagementRate": 18.6,
    "completionRate": 72.4,
    "conversionRate": 3.2
  },
  "periodB": {
    "platform": "TikTok",
    "periodLabel": "Tháng 5/2026",
    "reach": 419000,
    "totalEngagement": 82500,
    "newFollowers": 1910,
    "engagementRate": 18.9,
    "completionRate": 69.4,
    "conversionRate": 3.5
  }
}
```

**Facebook example:**
```json
{
  "periodA": {
    "platform": "Facebook",
    "periodLabel": "Tuần 1 T6",
    "reach": 45000,
    "totalEngagement": 1350,
    "engagementRate": 3.0,
    "newFollowers": 85,
    "clicks": 540
  },
  "periodB": {
    "platform": "Facebook",
    "periodLabel": "Tuần 4 T5",
    "reach": 38000,
    "totalEngagement": 1140,
    "engagementRate": 3.0,
    "newFollowers": 62,
    "clicks": 420
  }
}
```
