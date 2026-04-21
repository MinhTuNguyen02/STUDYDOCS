# 📚 StudyDocs Market

Sàn giao dịch tài liệu học tập trực tuyến — nơi mọi người có thể **mua, bán, tải xuống và đánh giá** tài liệu một cách an toàn, minh bạch.

> **Trạng thái:** Đang phát triển (Development)

---

## 📐 Kiến trúc tổng quan

```
STUDYDOCS/
├── docker-compose.yml          # Gotenberg (chuyển đổi DOCX → PDF)
├── backend/                    # Backend  (NestJS + Prisma)
│   ├── prisma/schema.prisma
│   ├── src/modules/            # 24 module nghiệp vụ
│   └── .env.example
├── frontend/                   # Frontend (React + Vite + TailwindCSS 4)
│   └── src/
│       ├── api/                # Axios API clients
│       ├── components/         # Reusable UI components
│       ├── pages/              # 11 nhóm trang
│       └── store/              # Zustand state management
└── README.md                   ← bạn đang ở đây
```

## 🧰 Công nghệ sử dụng

| Tầng | Công nghệ |
|------|-----------|
| **Frontend** | React 19, Vite 8, TailwindCSS 4, Zustand, React Router 7 |
| **Backend** | NestJS 10, Prisma ORM 6, Passport JWT |
| **Database** | PostgreSQL 16 (Supabase) |
| **File Storage** | Supabase Storage (S3-compatible) |
| **Thanh toán** | VNPay Sandbox |
| **Chuyển đổi file** | Gotenberg 8 (DOCX → PDF preview) |

---

## 🚀 Hướng dẫn chạy dự án

### Yêu cầu hệ thống

- **Node.js** ≥ 18 (khuyến nghị ≥ 20)
- **npm** ≥ 9
- **Docker Desktop** (đã cài và đang chạy — chỉ cần cho Gotenberg)
- **Git**
- **Tài khoản Supabase** (database + storage đã được setup sẵn)

---

### Bước 1 — Khởi động Docker (Gotenberg)

Mở terminal tại **thư mục root** của dự án (`STUDYDOCS/`):

```bash
docker compose up -d
```

Lệnh này sẽ khởi động **Gotenberg** — dịch vụ chuyển đổi DOCX → PDF để tạo preview:

| Service | Port | Mô tả |
|---------|------|-------|
| **Gotenberg** | `3000` | Chuyển đổi DOCX → PDF preview |

> **Lưu ý:** Database (PostgreSQL) và File Storage đều chạy trên **Supabase Cloud**, không cần Docker.

---

### Bước 2 — Cài đặt và chạy Backend

```bash
# 1. Di chuyển vào thư mục backend
cd backend

# 2. Cài đặt dependencies
npm install

# 3. Tạo file cấu hình môi trường
cp .env.example .env
```

Mở file `.env` và chỉnh sửa các giá trị:

```env
PORT=4000
FRONTEND_URL="http://localhost:5173"
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

JWT_ACCESS_SECRET="dev_access_secret"
JWT_REFRESH_SECRET="dev_refresh_secret"

# Supabase Storage (lấy từ Supabase Dashboard → Settings → API)
SUPABASE_URL="https://[project-ref].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
SUPABASE_STORAGE_BUCKET="studydocs"

# VNPay Sandbox (tùy chọn — để test thanh toán)
VNPAY_TMN_CODE="your-tmn-code"
VNPAY_HASH_SECRET="your-hash-secret"
VNPAY_URL="https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
```

Tiếp tục:

```bash
# 4. Sinh Prisma Client từ schema
npx prisma generate

# 5. Khởi động server ở chế độ development
npm run start:dev
```

✅ Backend sẽ chạy tại: **http://localhost:4000**
📖 Swagger API Docs: **http://localhost:4000/api-docs**

---

### Bước 3 — Cài đặt và chạy Frontend

Mở **terminal mới** (giữ terminal backend):

```bash
# 1. Di chuyển vào thư mục frontend
cd frontend

# 2. Cài đặt dependencies
npm install

# 3. Khởi động dev server
npm run dev
```

✅ Frontend sẽ chạy tại: **http://localhost:5173**

> Frontend tự động proxy tất cả request `/api/*` sang Backend `http://localhost:4000` thông qua Vite proxy config.

> File `.env` trong thư mục `frontend/` chứa biến `VITE_STORAGE_URL` trỏ tới Supabase Storage public URL.

---

### Cách lấy Supabase Service Role Key

1. Truy cập [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Chọn project đang sử dụng
3. Vào **Settings** → **API**
4. Copy giá trị **`service_role` key** (⚠️ không phải `anon` key)
5. Dán vào biến `SUPABASE_SERVICE_ROLE_KEY` trong file `.env`

### Cách tạo Storage Bucket

1. Trong Supabase Dashboard → **Storage**
2. Click **New bucket** → đặt tên `studydocs`
3. Chọn **Public bucket** → **Create**
4. Backend sẽ tự tạo bucket nếu chưa tồn tại (cần `service_role` key)

---

## 🗂️ Cấu trúc Backend Modules

```
src/modules/
├── auth/           # Đăng nhập, đăng ký, JWT, OAuth, OTP, 2FA
├── users/          # Quản lý hồ sơ người dùng
├── seller/         # Quản lý tài liệu của người bán
├── documents/      # Tìm kiếm, xem chi tiết tài liệu
├── categories/     # Danh mục tài liệu
├── tags/           # Tag / nhãn tài liệu
├── cart/           # Giỏ hàng
├── wishlists/      # Danh sách yêu thích
├── checkout/       # Thanh toán (VNPay, ví nội bộ)
├── orders/         # Quản lý đơn hàng
├── wallets/        # Ví thanh toán & ví doanh thu
├── downloads/      # Xử lý tải tài liệu (free / purchased / package)
├── library/        # Thư viện tài liệu đã mua & sinh link tải
├── reviews/        # Đánh giá & phản hồi người bán
├── reports/        # Báo cáo vi phạm
├── disputes/       # Tranh chấp đơn hàng
├── packages/       # Gói lượt tải
├── moderation/     # Phạt/Cảnh cáo tài liệu vi phạm
├── admin/          # Quản trị hệ thống
├── configs/        # Cấu hình hệ thống
├── policies/       # Chính sách & điều khoản
├── gateway/        # Socket.IO Gateway (Realtime)
├── notifications/  # Quản lý thông báo in-app
└── storage/        # Supabase Storage upload/download service
```

---

## 🖥️ Cấu trúc Frontend Pages

```
src/pages/
├── home/           # Trang chủ
├── auth/           # Đăng nhập / Đăng ký
├── documents/      # Danh sách & Chi tiết tài liệu
├── cart/           # Giỏ hàng & Thanh toán
├── orders/         # Lịch sử đơn hàng & Chi tiết đơn
├── library/        # Thư viện tài liệu đã mua
├── seller/         # Dashboard người bán (upload, quản lý tài liệu)
├── profile/        # Thông tin cá nhân, ví, bảo mật
├── payment/        # Nạp tiền (VNPay)
├── packages/       # Mua gói lượt tải
└── policies/       # Chính sách sử dụng
```

---

## 🔐 Tài khoản mặc định (sau khi seed)

| Vai trò  | Email | Mật khẩu |
|----------|-------|-----------|
| Admin    | `admin@studydocs.vn` | `admin123` |
| Customer | *(tự đăng ký tại /register)* | — |

> **Lưu ý:** Tài khoản mặc định có thể khác tùy vào file `prisma/seed.ts`. Hãy kiểm tra file đó để biết chính xác.

---

## 📋 Các lệnh hữu ích

### Backend (`backend/`)

```bash
npm run start:dev         # Chạy dev server (hot-reload)
npm run build             # Build production
npm run seed              # Seed dữ liệu mẫu
npx prisma studio         # Mở Prisma Studio (xem DB trực quan)
npx prisma db push        # Đồng bộ schema → DB
npx prisma generate       # Sinh lại Prisma Client
npm run test              # Chạy test suite
```

### Frontend (`frontend/`)

```bash
npm run dev               # Chạy dev server (port 5173)
npm run build             # Build production
npm run preview           # Preview bản build
npm run lint              # Kiểm tra code style
```

### Docker

```bash
docker compose up -d      # Khởi động Gotenberg
docker compose down       # Dừng services
docker compose logs -f    # Xem log realtime
```

---

## 🌐 Cổng mặc định

| Dịch vụ | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:4000 |
| Swagger Docs | http://localhost:4000/api-docs |
| Database | Supabase Cloud (xem Dashboard) |
| File Storage | Supabase Storage (xem Dashboard) |
| Gotenberg | localhost:3000 |

---

## ⚠️ Lưu ý quan trọng

1. **Docker Desktop phải đang chạy** trước khi thực hiện `docker compose up -d` (cho Gotenberg).
2. **Thứ tự khởi động:** Docker → Backend → Frontend.
3. Nếu thay đổi file `prisma/schema.prisma`, cần chạy lại:
   ```bash
   npx prisma generate && npx prisma db push
   ```
4. Để test thanh toán VNPay, cần cấu hình `VNPAY_TMN_CODE` và `VNPAY_HASH_SECRET` trong `.env` với thông tin từ [VNPay Sandbox](https://sandbox.vnpayment.vn).
5. Để nhận webhook IPN từ VNPay (xác nhận giao dịch tự động), Backend cần được expose ra internet bằng **ngrok** hoặc tương đương:
   ```bash
   ngrok http 4000
   ```
   Sau đó cập nhật IPN URL trên trang quản lý VNPay Sandbox.
6. **⚠️ Không commit file `.env` lên Git** — file này chứa secret keys. Chỉ commit `.env.example`.

---

## 👥 Thành viên

| Họ tên | MSSV | Vai trò |
|--------|------|---------|
| *(Điền thông tin)* | *(MSSV)* | *(Vai trò)* |

---

## 📄 Giấy phép

Dự án phục vụ mục đích học tập — môn **Phát triển hệ thống Thương mại điện tử**, Học kỳ 2, Năm 4.
