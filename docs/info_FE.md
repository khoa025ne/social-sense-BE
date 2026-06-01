# SocialSense — Thông tin cho đội Frontend

> File này tổng hợp tất cả thông tin FE cần để kết nối với Backend.
> **Điền vào các trường `___` sau khi BE deploy xong.**

---

## 1. API Base URL

| Môi trường | URL |
|-----------|-----|
| **Development (local)** | `http://localhost:5280` |
| **Production (Render)** | `https://social-sense-be.onrender.com` |
| **Custom domain (nếu có)** | `https://api._____________________.com` |

---

## 2. Authentication

### Cơ chế: JWT Bearer Token

```
Header: Authorization: Bearer <accessToken>
```

| Thông tin | Giá trị |
|-----------|---------|
| Token type | `Bearer` |
| Access token TTL | `60 phút` |
| Refresh token TTL | `7 ngày` |
| Token storage | localStorage hoặc httpOnly cookie |

### Flow đăng nhập

```
POST /auth/login → nhận accessToken + refreshToken
    ↓
Lưu token vào storage
    ↓
Mỗi request: thêm header Authorization: Bearer <accessToken>
    ↓
Khi nhận 401 → gọi POST /auth/refresh để lấy token mới
    ↓
Nếu refresh cũng fail → redirect về trang login
```

---

## 3. Tài khoản test

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@socialsense.vn` | `Password123!` |
| **User Pro** | `user1@socialsense.vn` | `Password123!` |
| **User Free** | `user3@socialsense.vn` | `Password123!` |

---

## 4. Endpoints quan trọng

### Auth
| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/auth/register` | ❌ | Đăng ký |
| POST | `/auth/login` | ❌ | Đăng nhập |
| POST | `/auth/refresh` | ❌ | Refresh token |
| GET | `/auth/me` | ✅ | Thông tin user hiện tại |
| GET | `/auth/quota` | ✅ | Quota còn lại hôm nay |
| POST | `/auth/forgot-password` | ❌ | Gửi OTP reset mật khẩu |
| POST | `/auth/reset-password` | ❌ | Đặt lại mật khẩu bằng OTP |

### Content
| Method | Endpoint | Auth | Quota | Mô tả |
|--------|----------|------|-------|-------|
| POST | `/content/generate` | ✅ | -1 | Tạo content AI |
| POST | `/content/check-alignment` | ✅ | 0 | Kiểm tra brand alignment |
| GET | `/content/history` | ✅ | 0 | Lịch sử content |
| PUT | `/content/history/{id}/edit` | ✅ | 0 | Sửa content |

### Image Generation
| Method | Endpoint | Auth | Quota | Mô tả |
|--------|----------|------|-------|-------|
| POST | `/content/image/analyze` | ✅ | 0 | Bước 1: AI phân tích |
| POST | `/content/image/generate` | ✅ | -1 | Bước 2: Tạo ảnh |

### Trends
| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/trends` | ❌ | Danh sách xu hướng |
| GET | `/trends/tags` | ❌ | Danh sách tags |

### Payment
| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/payment/plans` | ❌ | Bảng giá |
| POST | `/payment/create` | ✅ | Tạo đơn thanh toán |
| GET | `/payment/orders/{code}/status` | ✅ | Polling trạng thái |
| GET | `/payment/subscription` | ✅ | Subscription hiện tại |
| GET | `/payment/history` | ✅ | Lịch sử thanh toán |

---

## 5. Quota System

| Tier | Lượt/ngày | Ghi chú |
|------|-----------|---------|
| Free | 5 | Mặc định khi đăng ký |
| Pro | 50 | Sau khi thanh toán |
| Enterprise | 500 hoặc unlimited (-1) | |

**Các action tốn quota:**
- `POST /content/generate` → -1 quota
- `POST /content/image/generate` → -1 quota

**Không tốn quota:**
- `POST /content/image/analyze`
- `POST /content/check-alignment`
- Tất cả GET requests

**Gợi ý FE:** Gọi `GET /auth/quota` sau mỗi action tốn quota để cập nhật UI.

---

## 6. Error Codes quan trọng

| Code | HTTP | Xử lý FE |
|------|------|----------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Hiển thị "Sai email/mật khẩu" |
| `AUTH_INVALID_TOKEN` | 401 | Gọi refresh token |
| `AUTH_INVALID_REFRESH_TOKEN` | 401 | Redirect về login |
| `AUTH_EMAIL_EXISTS` | 400 | "Email đã được đăng ký" |
| `QUOTA_EXCEEDED` | 429 | Hiển thị modal nâng cấp gói |
| `OTP_INVALID_OR_EXPIRED` | 400 | "Mã OTP sai hoặc đã hết hạn" |
| `IMAGE_CONTENT_REQUIRED` | 400 | Validate trước khi gọi API |
| `IMAGE_DRAFT_PROMPT_REQUIRED` | 400 | Validate trước khi gọi API |

---

## 7. Image Generation — Lưu ý đặc biệt

### Hiển thị ảnh
```html
<!-- imageUrl là direct URL đến JPEG -->
<img src="{{ imageUrl }}" alt="AI Generated Banner" loading="lazy" />
```

### Loading time
- Pollinations.ai mất **5–15 giây** để generate ảnh lần đầu
- FE nên hiển thị skeleton/spinner trong lúc chờ ảnh load
- Dùng `onload` event để ẩn spinner khi ảnh đã load xong

### Khi `isGenerated = false`
- Hiển thị `finalPrompt` trong textarea để user copy
- Thêm nút "Copy prompt"
- Hiển thị `promptUsageTip` như hướng dẫn

### Answers format
```json
{
  "q1": "yes",              // hoặc "no"
  "q2": "Tối & sang trọng", // đúng giá trị từ options[]
  "q3": ""                  // caption text hoặc "" nếu không có
}
```
> ⚠️ Không truyền giá trị của q2 vào q3 — sẽ bị inject vào prompt thành text overlay.

---

## 8. Forgot Password — UX Flow

```
[Trang Login]
  └─ "Quên mật khẩu?" link
        └─ [Trang Forgot Password]
              └─ Input email → POST /auth/forgot-password
                    └─ Luôn hiển thị: "Kiểm tra email của bạn"
                          └─ [Trang Reset Password]
                                ├─ Input OTP (6 ô, auto-focus)
                                ├─ Input mật khẩu mới
                                ├─ Countdown timer 10 phút
                                ├─ Nút "Gửi lại" sau 60 giây
                                └─ POST /auth/reset-password
                                      └─ Thành công → redirect Login
```

**Lưu ý:**
- OTP gồm 6 chữ số
- Hết hạn sau 10 phút
- Sau khi đổi mật khẩu thành công → tất cả thiết bị bị đăng xuất

---

## 9. CORS

| Môi trường | Allowed Origins |
|-----------|----------------|
| Development | `*` (tất cả) |
| Production | *(FE cần cung cấp domain để BE whitelist)* |

**FE cần cung cấp:**
- [ ] Domain production của FE: `https://___________________`
- [ ] Domain staging (nếu có): `https://___________________`

---

## 10. Thông tin cần FE cung cấp cho BE

Điền vào và gửi lại cho đội BE:

| Thông tin | Giá trị |
|-----------|---------|
| **FE Production domain** | `https://___________________` |
| **FE Staging domain** | `https://___________________` |
| **PayOS ReturnUrl** | `https://___________________/payment/success` |
| **PayOS CancelUrl** | `https://___________________/payment/cancel` |

---

## 11. Tài liệu tham khảo

- **API Reference đầy đủ:** `docs/API_REFERENCE.md`
- **Swagger UI (dev only):** `http://localhost:5280/swagger`
- **Health check:** `GET /health`
