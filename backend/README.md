# StudyDocs Market BE

Skeleton backend cho StudyDocs Market dùng `NestJS + Prisma + PostgreSQL`.

## Cấu trúc chính

- `src/modules/auth`: đăng nhập/đăng ký (mock)
- `src/modules/users`: danh sách user (mock)
- `src/modules/documents`: danh sách tài liệu (mock)
- `src/modules/orders`: đơn hàng (mock)
- `src/modules/admin`: dashboard + duyệt tài liệu (mock)
- `src/database/prisma.service.ts`: Prisma client service
- `prisma/schema.prisma`: datasource + generator

## Chạy dự án

```bash
cd BE
npm install
cp .env.example .env
npm run start:dev
```

API base: `http://localhost:4000/api`

Ví dụ:

- `GET /api/admin/dashboard`
- `GET /api/admin/approvals/documents`
- `POST /api/auth/login`
- `GET /api/documents`

## Đồng bộ Prisma với DB hiện tại

Bạn đã có schema SQL ở root project.

1. Import SQL vào PostgreSQL trước.
2. Cập nhật `DATABASE_URL` trong `.env`.
3. Chạy:

```bash
npx prisma generate
```

Sau bước này bạn có thể bắt đầu thay mock service bằng truy vấn Prisma thật.
