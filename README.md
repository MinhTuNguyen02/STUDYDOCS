# 📚 StudyDocs Market

> A full-stack digital document marketplace with internal wallet accounting, VNPay payment integration, automated document processing, and multi-role administration.

**🔗 Live Demo:** [https://studydocs-lac.vercel.app/](https://studydocs-lac.vercel.app/)

**⚙️ API Base URL:** [https://studydocs-backend-minhtu.fly.dev](https://studydocs-backend-minhtu.fly.dev)

Students can **buy, sell, download, and review** academic documents through a transparent, commission-based platform with real-time notifications and financial audit trails.

---

## ✨ Key Features

- **Multi-Role System** — 4 roles (Customer, Moderator, Accountant, Admin) with granular RBAC on both backend and frontend
- **Double-Entry Accounting** — 5 wallet types (PAYMENT, REVENUE, GATEWAY_POOL, SYSTEM_REVENUE, TAX_PAYABLE) with debit-credit balance validation
- **Payment Integration** — VNPay gateway with HMAC-SHA512 signing, IPN webhook, and idempotent transaction processing
- **Document Processing Pipeline** — Upload → SHA256 dedup → DOCX/PPTX/XLSX-to-PDF conversion (Gotenberg) → watermarked preview generation (pdf-lib)
- **Real-Time Notifications** — Socket.IO WebSocket gateway with JWT auth and role-based broadcasting (multiple event types)
- **Anti-Fraud System** — File hash duplicate detection, progressive penalties (fine → ban), and comprehensive audit logging
- **Seller Dashboard** — Revenue analytics, daily/monthly trends, top documents, sales management
- **Admin Dashboard** — 18 management pages covering content moderation, financial oversight, user management, and system configuration
- **Download Packages** — Subscription-like download bundles with expiration and auto-activation queue

---

## 📸 Screenshots

| Homepage | Document Listing |
|----------|------------------|
| ![Homepage](docs/screenshots/01-homepage.png) | ![Document Listing](docs/screenshots/02-document-listing.png) |

| Document Detail | Seller Upload |
|-----------------|---------------|
| ![Document Detail](docs/screenshots/03-document-detail.png) | ![Seller Upload](docs/screenshots/04-seller-upload.png) |

| Seller Dashboard | Wallet & Transactions |
|------------------|-----------------------|
| ![Seller Dashboard](docs/screenshots/05-seller-dashboard.png) | ![Wallet Transactions](docs/screenshots/06-wallet-transactions.png) |

| Checkout & Payment | Moderation Queue |
|--------------------|------------------|
| ![Checkout & Payment](docs/screenshots/07-checkout-payment.png) | ![Moderation Queue](docs/screenshots/08-moderation-queue.png) |

| Admin Dashboard |
|-----------------|
| ![Admin Dashboard](docs/screenshots/09-admin-dashboard.png) |


## 🏗️ System Architecture

```mermaid
flowchart LR
    FE["React 19 + Vite Frontend\n(Vercel)"] -->|REST API| API["NestJS Backend API\n(Fly.io)"]
    FE <-->|WebSocket| WS["Socket.IO Gateway\n(NestJS)"]
    WS --> API

    API --> DB[(PostgreSQL\nSupabase Cloud)]
    API --> Storage["Supabase Storage\nS3-compatible"]
    API --> Gotenberg["Gotenberg 8\nFile Conversion\nFly.io / Docker"]
    API --> VNPay["VNPay\nPayment Gateway"]
    API --> Mail["Gmail SMTP\nEmail Service"]
```

```
STUDYDOCS/
├── docs/
│   ├── screenshots/                # README screenshots
│   ├── diagrams/                   # Architecture and flow diagrams
│   └── demo/ 
├── docker-compose.yml              # Gotenberg service (file conversion)
├── backend/                        # NestJS + Prisma (23 modules)
│   ├── prisma/schema.prisma        # 28 tables, 17 enums
│   ├── src/
│   │   ├── common/                 # Guards, filters, decorators, utils
│   │   ├── database/               # PrismaModule + PrismaService
│   │   └── modules/                # 23 business modules
│   ├── test/                       # 4 E2E test suites
│   ├── Dockerfile                  # Multi-stage production build
│   └── fly.toml                    # Fly.io deployment config
├── frontend/                       # React 19 + Vite 8 + TailwindCSS 4
│   └── src/
│       ├── api/                    # 14 Axios API clients
│       ├── components/             # Reusable UI (guards, layout, common)
│       ├── pages/                  # 12 page groups, 40+ routes
│       └── store/                  # Zustand state (auth, cart, notifications)
└── README.md
```

---

## 💰 Core Business Flows

### Wallet & Double-Entry Ledger

Every financial operation creates balanced ledger entries (total debit = total credit), validated at the service layer.

```
┌─────────────────────────────────────────────────────────────────┐
│                     WALLET ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Customer Wallets         System Wallets (no owner)             │
│  ┌──────────────┐         ┌──────────────────┐                  │
│  │   PAYMENT    │         │   GATEWAY_POOL   │  ← VNPay funds  │
│  │  (buy docs)  │         │   (escrow pool)  │                  │
│  ├──────────────┤         ├──────────────────┤                  │
│  │   REVENUE    │         │  SYSTEM_REVENUE  │  ← commissions  │
│  │ (sell docs)  │         │  (platform fee)  │                  │
│  └──────────────┘         ├──────────────────┤                  │
│                           │   TAX_PAYABLE    │  ← withdrawal   │
│                           │  (withheld tax)  │     tax          │
│                           └──────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

| Flow | Money Movement |
|------|---------------|
| **Top-up** | VNPay → `GATEWAY_POOL` ↑ → Buyer `PAYMENT` ↑ |
| **Purchase** | Buyer `PAYMENT` ↓ → Seller `REVENUE` ↑ + `SYSTEM_REVENUE` ↑ (commission) |
| **Withdrawal** | Seller `REVENUE` ↓ → `GATEWAY_POOL` ↓ (net) + `TAX_PAYABLE` ↑ (tax) |
| **Rejection** | Reversal: `GATEWAY_POOL` ↑ + `TAX_PAYABLE` ↓ → Seller `REVENUE` ↑ |

### Document Processing Pipeline

```
Seller uploads file
       │
       ▼
  SHA256 hash ──── Duplicate? ──→ Reject + Record violation
       │                          (auto-fine at 3rd, ban at 5th)
       │ unique
       ▼
  Is PDF? ─── No ──→ Gotenberg (LibreOffice) ──→ Convert to PDF
       │                                              │
       │ Yes                                          │
       ▼                                              ▼
  pdf-lib processing ◄────────────────────────────────┘
       │
       ├──→ Preview PDF (30% pages, strong red watermark) → Supabase Storage
       ├──→ Review PDF  (100% pages, light blue watermark) → Supabase Storage
       └──→ Original file → Supabase Storage
               │
               ▼
       Status: PENDING → Staff moderation
       Staff approves/rejects → Review PDF auto-deleted
```

### Payment Flow (VNPay)

```
Customer clicks "Top Up"
       │
       ▼
  Backend creates Payment record (PENDING)
  + generates VNPay URL with HMAC-SHA512 signature
       │
       ▼
  Customer redirected to VNPay → completes payment
       │
       ▼
  VNPay sends IPN webhook → Backend verifies signature
       │
       ├── Amount mismatch? → Reject (RspCode: 04)
       ├── Already processed? → Idempotent return (RspCode: 02)
       └── Valid? → Atomic transaction:
              • Update payment status → COMPLETED
              • Increment GATEWAY_POOL balance
              • Increment customer PAYMENT wallet
              • Record double-entry ledger
              • Push real-time notification via Socket.IO
```

---

## 🧰 Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, Vite 8, TailwindCSS 4, Zustand, React Router 7, Recharts, Socket.IO Client |
| **Backend** | NestJS 10, Prisma ORM 6, Passport JWT, Socket.IO, Swagger/OpenAPI |
| **Database** | PostgreSQL 16 (Supabase Cloud) |
| **File Storage** | Supabase Storage (S3-compatible) |
| **Payment** | VNPay (HMAC-SHA512) |
| **File Conversion** | Gotenberg 8 (LibreOffice engine — DOCX/PPTX/XLSX → PDF) |
| **Auth** | JWT (access + refresh), Google OAuth 2.0, Firebase Phone OTP, 2FA |
| **Email** | Nodemailer (Gmail SMTP) |
| **Security** | Helmet, Throttler (rate limiting), bcryptjs |
| **Testing** | Jest, Supertest (4 E2E suites) |
| **DevOps** | Docker (multi-stage), Fly.io, Vercel |

---

## 🌍 Deployment

| Service | Platform | Region | Link |
|---------|----------|--------|------|
| Frontend | [Vercel](https://vercel.com) | Auto (Edge) | [https://studydocs-lac.vercel.app/](https://studydocs-lac.vercel.app/) |
| Backend API | [Fly.io](https://fly.io) | Singapore (`sin`) | [https://studydocs-backend-minhtu.fly.dev](https://studydocs-backend-minhtu.fly.dev) |
| Database | [Supabase](https://supabase.com) | AP Southeast 1 | — |
| File Storage | Supabase Storage | S3-compatible | — |
| Gotenberg | Fly.io / Docker local | — | — |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18 (recommended ≥ 20)
- **npm** ≥ 9
- **Docker Desktop** (running — required for Gotenberg)
- **Git**
- A [Supabase](https://supabase.com) project with:
  - PostgreSQL database
  - A **public** storage bucket named `studydocs`
  - `service_role` API key (found in **Settings → API**)

### Environment Variables

#### Backend (`backend/.env`)

Copy the example and fill in your values:

```bash
cp backend/.env.example backend/.env
```

Required variables:

```env
PORT=4000
FRONTEND_URL="http://localhost:5173"
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"

# Supabase (Settings → API in your Supabase Dashboard)
SUPABASE_URL="https://[project-ref].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
SUPABASE_STORAGE_BUCKET="studydocs"

# VNPay (optional — for payment testing)
VNPAY_TMN_CODE="your-tmn-code"
VNPAY_HASH_SECRET="your-hash-secret"
VNPAY_URL="https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"

# Email (optional — for password reset)
MAIL_USER="your-gmail@gmail.com"
MAIL_PASS="your-app-password"
```

#### Frontend (`frontend/.env`)

```env
VITE_API_URL="/api"
VITE_STORAGE_URL="https://[project-ref].supabase.co/storage/v1/object/public/studydocs"
```

### Start Gotenberg

From the project root directory:

```bash
docker compose up -d
```

This starts Gotenberg on port `3000` for DOCX/PPTX/XLSX → PDF conversion.

> **Note:** Database and Storage run on Supabase Cloud — no local Docker needed for those.

### Start Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push        # Sync schema to database (see warning below)
npm run start:dev
```

> ⚠️ **Warning:** `prisma db push` directly modifies the database schema without migration history. Use it **only for local/development databases**. For shared or production databases, use `prisma migrate dev` instead to avoid accidental data loss.

✅ Backend runs at: **http://localhost:4000**

### Start Frontend

Open a **new terminal** (keep the backend running):

```bash
cd frontend
npm install
npm run dev
```

✅ Frontend runs at: **http://localhost:5173**

> The Vite dev server proxies all `/api/*` requests to the backend at `http://localhost:4000`.

---

## 📖 API Documentation

Swagger UI is auto-generated and available at:

**http://localhost:4000/api/docs**

All endpoints use the `/api` prefix and require `Bearer` token authentication (except public routes).

A Postman collection is also available at `backend/studydocs-be.postman_collection.json`.

---

## 🧪 Testing

The project includes 4 end-to-end test suites:

```bash
cd backend

# Run all tests
npm run test

# Run individual suites
npm run test:e2e:part1    # 01-auth — Registration, login, JWT, OAuth, OTP
npm run test:e2e:part2    # 02-documents — Upload, search, cart, checkout
npm run test:e2e:part3    # 03-financial — Wallets, top-up, withdrawal, packages
npm run test:e2e:part4    # 04-interaction — Reviews, reports, admin operations
```

---

## 🗂️ Project Structure

### Backend Modules (23 modules)

```
src/modules/
├── auth/           # Login, register, JWT, Google OAuth, OTP, 2FA, password reset
├── users/          # User profile management
├── seller/         # Seller document management, upload pipeline, dashboard analytics
├── documents/      # Public document search, detail, view counting
├── categories/     # Category tree (parent-child)
├── tags/           # Document tags
├── cart/           # Shopping cart
├── wishlists/      # Wishlist / favorites
├── checkout/       # Wallet payment + VNPay top-up + IPN webhook
├── orders/         # Order history and detail
├── wallets/        # Wallet management + ledger service + withdrawal
├── downloads/      # Download authorization (free / purchased / package)
├── library/        # Purchased documents library
├── reviews/        # Ratings, comments, seller replies
├── reports/        # Content violation reports
├── packages/       # Download packages (subscription bundles)
├── moderation/     # Content moderation + penalty/auto-ban system
├── admin/          # System admin (dashboard, users, configs, staff management)
├── configs/        # Dynamic system configuration (commission rate, fees)
├── policies/       # Terms & policies CMS (rich text)
├── gateway/        # Socket.IO WebSocket gateway
├── notifications/  # In-app notifications (multiple types) + cron cleanup
└── storage/        # Supabase Storage upload/download service
```

### Frontend Pages (12 groups, 40+ routes)

```
src/pages/
├── home/           # Landing page
├── auth/           # Login, Register, Verify Phone, Reset Password
├── documents/      # Document listing (search, filter) + detail page
├── cart/           # Cart + Wishlist
├── orders/         # Order history + Order detail
├── library/        # Purchased documents library
├── seller/         # Seller dashboard, document management, upload, sales
├── profile/        # User profile, wallet, security settings
├── payment/        # VNPay return handler
├── packages/       # Download package marketplace
├── policies/       # Terms & policies viewer
└── admin/          # 18 admin pages (dashboard, approvals, users, finances, ...)
```

---

## 📋 Useful Commands

### Backend (`backend/`)

```bash
npm run start:dev         # Dev server (hot-reload)
npm run build             # Production build
npm run seed              # Seed sample data
npx prisma studio         # Visual database browser
npx prisma generate       # Regenerate Prisma Client
npx prisma db push        # Sync schema → DB (dev only!)
npm run test              # Run E2E test suites
```

### Frontend (`frontend/`)

```bash
npm run dev               # Dev server (port 5173)
npm run build             # Production build
npm run preview           # Preview production build
npm run lint              # Code style check
```

### Docker

```bash
docker compose up -d      # Start Gotenberg
docker compose down       # Stop services
docker compose logs -f    # Stream logs
```

---

## 🌐 Default Ports

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:4000 |
| Swagger Docs | http://localhost:4000/api/docs |
| Gotenberg | http://localhost:3000 |
| Database | Supabase Cloud Dashboard |
| File Storage | Supabase Storage Dashboard |

---

## ⚠️ Important Notes

1. **Docker Desktop must be running** before `docker compose up -d` (for Gotenberg).
2. **Startup order:** Docker → Backend → Frontend.
3. **Schema changes** — after editing `prisma/schema.prisma`:
   ```bash
   npx prisma generate && npx prisma db push
   ```
   > ⚠️ Use `prisma db push` only for **local/dev** databases. For production or shared databases, use `prisma migrate dev` to create proper migration files.
4. **VNPay testing** — configure `VNPAY_TMN_CODE` and `VNPAY_HASH_SECRET` in `.env` from [VNPay Sandbox](https://sandbox.vnpayment.vn).
5. **VNPay IPN webhook** — to receive automatic payment confirmations, expose the backend via **ngrok**:
   ```bash
   ngrok http 4000
   ```
   Then update the IPN URL in your VNPay Sandbox merchant dashboard.
6. **Never commit `.env` files** — they contain secret keys. Only `.env.example` should be in version control.
7. **Supabase setup** — this project requires a configured Supabase project. See `backend/prisma/schema.prisma` for the database schema and `backend/prisma/seed.ts` for initial data.

---

## 📄 License

Academic project for **E-Commerce System Development** — Semester 2, Year 4.
