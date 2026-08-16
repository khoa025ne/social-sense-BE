# 📱 TÀI LIỆU KỸ THUẬT & HƯỚNG DẪN THIẾT KẾ CHO ĐỘI MOBILE APP
**Dự án**: SocialSense  
**Chủ đề**: Tích hợp Hệ thống Thống kê, Nhật ký Hành động Thời gian thực (Realtime Activity Logging) và API Admin mới từ Backend  
**Ngày cập nhật**: 17/08/2026

---

## I. TỔNG QUAN CÁC THAY ĐỔI TẠI BACKEND (C# ASP.NET CORE)

Backend đã nâng cấp và bổ sung các tính năng cốt lõi sau:
1. **Tạo Bảng Cơ Sở Dữ Liệu `UserActivities`**: Lưu vết chi tiết từng thao tác người dùng (Đăng nhập/Đăng ký, Tạo bài viết AI, Sinh ảnh AI, Nạp tài liệu tri thức, Thanh toán nâng cấp).
2. **Realtime Activity Logging Service**: Tự động ghi nhận thông tin thao tác ngay khi API được gọi từ phía Client (Web / Mobile).
3. **Cập nhật API Thống kê Tổng quan Admin (`GET /admin/dashboard`)**: Trả về chính xác chỉ số phân rã 7 ngày thực tế từ Database.
4. **Bổ sung API Nhật ký Hành động Chi tiết (`GET /admin/activities/drilldown`)**: Truy vấn dữ liệu thực tế theo từng ngày phục vụ tính năng Click-to-Drilldown.
5. **Bổ sung API Thưởng Quota (`POST /admin/users/{id}/bonus-quota`)**: Cộng thêm lượt dùng trực tiếp cho người dùng.

---

## II. CHI TIẾT CÁC CỔNG API MỚI DÀNH CHO ĐỘI MOBILE APP

### 1. Cấu hình Server Endpoints
- **Base URL Production (Cloud Railway)**: `https://truthful-youth-production-d00b.up.railway.app`
- **Base URL Local Dev**: `http://localhost:5280`
- **Header xác thực (Header Auth)**: `Authorization: Bearer <ADMIN_JWT_TOKEN>`

---

### 2. API 1: Lấy Thống kê Tổng quan Admin 7 ngày (`GET /admin/dashboard`)

* **Phương thức**: `GET`
* **Đường dẫn**: `/admin/dashboard`
* **Mô tả**: Trả về tổng quan hệ thống và mảng dữ liệu 7 ngày gần nhất chứa đầy đủ 8 chỉ số thực tế từ DB.

#### Structure JSON Response:
```json
{
  "totalUsers": 120,
  "activeUsers": 45,
  "totalContentGenerated": 350,
  "totalKnowledgeItems": 28,
  "totalTrends": 50,
  "activeApiKeys": 14,
  "coolingDownApiKeys": 0,
  "last7DaysContent": [
    {
      "date": "2026-08-16",
      "contentGenerated": 12,
      "newUsers": 3,
      "imageGenerated": 5,
      "knowledgeUploaded": 2,
      "userLogins": 15,
      "paymentsCount": 2,
      "proUpgrades": 1,
      "ultraUpgrades": 1,
      "revenue": 178000
    }
  ]
}
```

---

### 3. API 2: Lấy Chi tiết Nhật ký Hành động theo Ngày (`GET /admin/activities/drilldown`)

* **Phương thức**: `GET`
* **Đường dẫn**: `/admin/activities/drilldown?date=YYYY-MM-DD`
* **Tham số Query**: `date` (định dạng `YYYY-MM-DD`, ví dụ: `2026-08-16`). Nếu không truyền, mặc định lấy ngày hôm nay.
* **Mô tả**: Được gọi khi Admin nhấn vào một điểm/mốc ngày trên biểu đồ Mobile.

#### Structure JSON Response:
```json
{
  "date": "2026-08-16",
  "total": 2,
  "activities": [
    {
      "id": "act-1",
      "userId": 18,
      "displayName": "Nguyễn Văn A",
      "email": "userA@socialsense.vn",
      "tier": "Pro",
      "actionType": "CREATE_PROMPT",
      "actionLabel": "Tạo bài viết AI Đa kênh",
      "detail": "Nội dung: 'Kịch bản Video sản phẩm Tết'",
      "timestamp": "17:49:07"
    },
    {
      "id": "act-2",
      "userId": 105,
      "displayName": "Trần Thị B",
      "email": "userB@gmail.com",
      "tier": "Free",
      "actionType": "PAYMENT",
      "actionLabel": "Nâng cấp Gói Pro (79.000đ)",
      "detail": "Đã thanh toán thành công qua VietQR PayOS.",
      "timestamp": "16:20:15"
    }
  ]
}
```

#### Quy ước `actionType` cho Mobile App rendering biểu tượng (Icons):
- `LOGIN`: Đăng nhập / Đăng ký hệ thống.
- `CREATE_PROMPT`: Tạo bài viết AI.
- `IMAGE_GEN`: Sinh ảnh AI bằng Image Wizard.
- `UPLOAD_KNOWLEDGE`: Nạp tệp tài liệu tri thức thương hiệu.
- `PAYMENT`: Thanh toán gói cước thành công.
- `BONUS_QUOTA`: Admin thưởng thêm lượt dùng.

---

### 4. API 3: Thưởng +5 lượt Quota cho Người dùng (`POST /admin/users/{id}/bonus-quota`)

* **Phương thức**: `POST`
* **Đường dẫn**: `/admin/users/{id}/bonus-quota?amount=5`
* **Tham số Path**: `id` (User ID, ví dụ: `18`).
* **Tham số Query**: `amount` (số lượt thưởng, mặc định = `5`).
* **Mô tả**: Gọi từ nút "+5 Quota" trên ứng dụng Mobile.

#### Structure JSON Response:
```json
{
  "message": "Đã cộng +5 lượt cho Nguyễn Văn A.",
  "userId": 18,
  "remainingQuota": 10,
  "dailyQuotaLimit": 10
}
```

---

## III. HƯỚNG DẪN THIẾT KẾ & PHÁT TRIỂN GIAO DIỆN (UI/UX) CHO MOBILE APP

### 1. Màn hình Dashboard Admin (Admin Dashboard Screen)
* **Biểu đồ 1: Thống kê Chuyển đổi Gói cước (Subscription Conversion)**
  * **Dạng biểu đồ**: Stacked Bar Chart (Cột chồng) hoặc Grouped Bar Chart.
  * **Trục X**: 7 ngày gần nhất (`item.date`).
  * **Các chuỗi (Series)**: Gói Pro (`item.proUpgrades`), Gói Ultra (`item.ultraUpgrades`).
  * **Thẻ phụ (Sub-info)**: Hiển thị Tổng doanh thu (`item.revenue`) dạng VND và Tỷ lệ chuyển đổi (`conversionRate`).

* **Biểu đồ 2: Lưu lượng & Tương tác Thời gian thực (Activity Timeline)**
  * **Dạng biểu đồ**: Multi-line Chart (Biểu đồ đường đa chuỗi) hoặc Smooth Area Chart.
  * **Bộ lọc Chỉ số (Metric Toggle Chips/Pill Filter)**: Đặt ở phía trên biểu đồ cho phép bấm chọn Ẩn/Hiện các đường:
    * Tạo bài viết AI (`contentGenerated`)
    * Sinh ảnh AI (`imageGenerated`)
    * Nạp tri thức (`knowledgeUploaded`)
    * Đăng nhập (`userLogins`)
    * Thanh toán (`paymentsCount`)

---

### 2. Luồng Tương Tác Click-to-Drilldown (Interactive Node Tap)
1. Khi Admin **chạm vào một điểm (Data point)** bất kỳ trên biểu đồ 7 ngày:
2. Mobile App lấy giá trị `item.date` của điểm đó và kích hoạt **Bottom Sheet** hoặc **Modal Screen**.
3. Gọi API: `GET /admin/activities/drilldown?date=YYYY-MM-DD`.
4. **Xử lý trạng thái hiển thị (State Management)**:
   * **Nếu `activities.length > 0`**: Render danh sách Card người dùng dạng Scroll View/FlatList. Mỗi item gồm: Avatar chữ cái đầu, Tên, Email, Badge Gói cước (Free/Pro/Ultra), Thời gian từng giây, Badge chi tiết hành động và Nút bấm **"+5 Quota"**.
   * **Nếu `activities.length === 0` (Trống)**: Hiển thị **Empty State Clean Design** (Biểu tượng rỗng + Dòng chữ: *"Chưa có nhật ký hoạt động được ghi nhận trong ngày này. Dữ liệu thời gian thực sẽ hiển thị ngay khi có hành động người dùng."*). **Tuyệt đối không sử dụng mock data**.

---

### 3. Khuyến nghị Thư viện Biểu đồ cho Mobile (Mobile Charting Libraries)
- **React Native**: `react-native-wagmi-charts`, `victory-native`, hoặc `react-native-gifted-charts`.
- **Flutter**: `fl_chart`.
- **Android Native (Kotlin)**: `MPAndroidChart`.
- **iOS Native (Swift)**: `Swift Charts` (iOS 16+).
