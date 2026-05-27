# SocialSense API - Test Payload Guide (JWT, MySQL, Gemini)

Tài liệu này tổng hợp toàn bộ các mẫu JSON payload, địa chỉ endpoint và lệnh cURL cho từng API của dự án SocialSense để bạn tiện sử dụng kiểm thử trên Swagger hoặc các công cụ như Postman/Insomnia.

---

## 1. Đăng ký & Đăng nhập (Authentication)

### 1.1 Đăng ký tài khoản (Register)
* **Endpoint**: `POST http://localhost:5280/auth/register`
* **Mô tả**: Đăng ký tài khoản kiểm thử của bạn.
* **JSON Payload**:
```json
{
  "email": "pha@example.com",
  "password": "pha@example.com",
  "displayName": "Pha Developer"
}
```

### 1.2 Đăng nhập nhận JWT Token (Login)
* **Endpoint**: `POST http://localhost:5280/auth/login`
* **Mô tả**: Đăng nhập để nhận `accessToken` (JWT). Hãy copy token này paste vào mục **Authorize** (ở góc phải Swagger) dưới dạng `Bearer <Token>` để gọi các API bảo mật.
* **JSON Payload**:
```json
{
  "email": "pha@example.com",
  "password": "pha@example.com"
}
```

---

## 2. Thiết lập chân dung thương hiệu (Persona & Context)

> [!NOTE]  
> Các API trong mục này yêu cầu đính kèm Header Authorization: `Bearer <JWT_Token>` của tài khoản bạn vừa login.

### 2.1 Khảo sát thiết lập chân dung (Onboarding)
* **Endpoint**: `POST http://localhost:5280/context/onboarding`
* **Mô tả**: Trả lời bảng câu hỏi ban đầu để AI phân tích và tự sinh ra Brand Persona của bạn trong MySQL.
* **JSON Payload**:
```json
{
  "userId": "a6c841b6-f731-4dbd-ad60-915ca29fec5f",
  "answers": [
    "Tôi kinh doanh thời trang nam cao cấp, chuyên cung cấp các mẫu vest công sở, quần tây và áo sơ mi phom dáng lịch lãm.",
    "Khách hàng của tôi là nam giới công sở, doanh nhân trẻ từ 25 đến 45 tuổi, những người cần vẻ ngoài chuyên nghiệp, chỉn chu và nam tính.",
    "Tôi muốn truyền tải thông điệp về sự tự tin, phong thái lịch lãm của người đàn ông thành đạt, nhấn mạnh vào chất liệu bền bỉ và phom dáng tinh tế tôn dáng."
  ],
  "language": "vi"
}
```

### 2.2 Xem chân dung Persona hiện tại
* **Endpoint**: `GET http://localhost:5280/context/persona?userId=a6c841b6-f731-4dbd-ad60-915ca29fec5f`
* **Mô tả**: Truy xuất chân dung thương hiệu chi tiết đã được lưu trữ trong DB MySQL.

### 2.3 Cập nhật trực tiếp Persona
* **Endpoint**: `PUT http://localhost:5280/context/persona?userId=a6c841b6-f731-4dbd-ad60-915ca29fec5f`
* **Mô tả**: Tinh chỉnh trực tiếp các trường cụ thể của Persona.
* **JSON Payload**:
```json
{
  "jobTitle": "Thương hiệu Thời trang Nam Lịch lãm - Pha Gent",
  "toneOfVoice": "Trưởng thành, Lịch thiệp, Tự tin và Đáng tin cậy",
  "platformPreferences": ["Facebook", "LinkedIn"],
  "targetAudience": ["Nam giới công sở", "Doanh nhân trẻ", "Quý ông lịch lãm"],
  "contentFormats": ["Bài đăng chia sẻ mẹo phối đồ", "Bài đăng giới thiệu sản phẩm mới", "Câu chuyện thương hiệu"],
  "negativeConstraints": ["Hình ảnh mặc đồ hở hang như nữ", "Giọng điệu cợt nhả hoặc quá trẻ con", "Quảng cáo giật gân, rẻ tiền"],
  "language": "vi"
}
```

---

## 3. Nạp tri thức & Tài liệu sản phẩm (Knowledge Ingestion)

### 3.1 Nạp tài liệu tri thức thủ công (Manual Ingest)
* **Endpoint**: `POST http://localhost:5280/knowledge/manual`
* **Mô tả**: Nạp thông tin sản phẩm, bài viết tri thức để làm cơ sở dữ liệu cho AI tham chiếu (RAG).
* **JSON Payload**:
```json
{
  "title": "Tài liệu Phom dáng Quần tây Nam Cao cấp 2026",
  "rawContent": "Các sản phẩm quần tây nam của Pha Gent sử dụng chất liệu vải Cotton Spandex co giãn nhẹ, giữ phom tốt và chống nhăn tuyệt đối sau khi giặt. Thiết kế cạp quần thông minh có thể nới lỏng thêm 2-3 cm tạo sự thoải mái tối đa cho quý ông công sở phải ngồi làm việc cả ngày. Đây là dòng sản phẩm tập trung vào độ bền bỉ dài lâu, phom dáng đứng chuẩn nam tính và mức giá cực kỳ tối ưu, mang lại sự đầu tư xứng đáng cho bản thân quý ông."
}
```

### 3.2 Nạp tài liệu từ đường link website (Scrape Ingest)
* **Endpoint**: `POST http://localhost:5280/knowledge/scrape`
* **Mô tả**: Thu thập thông tin từ URL được khai báo (phải thuộc whitelist tên miền trong cấu hình).
* **JSON Payload**:
```json
{
  "targetUrl": "https://trends.google.com/trends/trendingsearches/daily"
}
```

---

## 4. Xem danh sách Trends & Thẻ Tags (MySQL)

### 4.1 Lấy danh sách xu hướng hot
* **Endpoint**: `GET http://localhost:5280/trends?page=1&pageSize=10`
* **Mô tả**: Xem danh sách các xu hướng được tổng hợp trong database.

### 4.2 Lấy danh sách thẻ phân loại tags
* **Endpoint**: `GET http://localhost:5280/trends/tags`
* **Mô tả**: Danh sách thẻ tags dùng để phân nhóm trend.

---

## 5. Sinh nội dung & Chấm điểm thao túng tâm lý (Content & Psychology Coach)

### 5.1 Sinh nội dung kết hợp RAG & Thao túng tâm lý (Generate)
* **Endpoint**: `POST http://localhost:5280/content/generate`
* **Mô tả**: Sinh nội dung tự động dựa trên Persona và Tri thức. Bạn có thể bỏ qua `trendId` (để `null` hoặc bỏ hẳn khỏi JSON) để hệ thống tự động tìm và so khớp tối ưu nhất từ MySQL.
* **JSON Payload**:
```json
{
  "userId": "a6c841b6-f731-4dbd-ad60-915ca29fec5f",
  "trendId": null,
  "outputCount": 2,
  "language": "vi",
  "targetPlatforms": [
    "Facebook",
    "LinkedIn"
  ],
  "generateImage": false
}
```

### 5.2 Trợ lý Chấm điểm & Thâu tóm tâm lý bài viết (Brand Coach & Rewriter)
* **Endpoint**: `POST http://localhost:5280/content/check-alignment`
* **Mô tả**: Gửi bài viết nháp của bạn để AI chấm điểm mức độ khớp thương hiệu, phân tích điểm yếu tâm lý của bài nháp, và tự động viết lại thành một siêu phẩm thao túng tâm lý.
* **JSON Payload**:
```json
{
  "userId": "a6c841b6-f731-4dbd-ad60-915ca29fec5f",
  "draftContent": "Đầu tháng này bên mình có nhập về mấy mẫu quần tây nam mới cực đẹp cho các anh mặc đi làm. Chất vải mát, bền đẹp và giá rất tốt. Các anh ủng hộ em nha, inbox để em tư vấn size ạ."
}
```

### 5.3 Xem lịch sử sinh nội dung
* **Endpoint**: `GET http://localhost:5280/content/history?userId=a6c841b6-f731-4dbd-ad60-915ca29fec5f&page=1&pageSize=10`
* **Mô tả**: Lịch sử các bài viết đã được AI sinh ra để tiện theo dõi và quản lý.
