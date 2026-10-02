# StudyDocs Technical & Functional Remediation Plan

> Tài liệu theo dõi duy nhất cho chương trình khắc phục sau technical & functional audit.
>
> Quy ước: `[ ]` chưa làm, `[-]` đang làm, `[x]` đã triển khai **và** vượt qua kiểm tra tương ứng.

## 0. Phạm vi đã chốt

- [x] Loại bỏ hoàn toàn 2FA đang dang dở/mock khỏi UI, API, service, dependency, schema, migration mới, test và tài liệu.
- [x] Loại bỏ cơ chế phạt/trừ tiền do vi phạm; giữ cảnh báo, strike, hạn chế và khóa tài khoản phi tài chính.
- [x] Loại bỏ hoàn toàn hold/dispute/refund và các trạng thái/nhãn/dữ liệu mồ côi liên quan.
- [x] Giữ thanh toán mua tài liệu/gói, doanh thu người bán và withdrawal trừ khi có quyết định sản phẩm khác.
- [x] Chuẩn hóa order: `PENDING_PAYMENT -> PAID | CANCELLED`; order item: `PENDING -> PAID`.
- [x] Không chạy migration hoặc E2E có ghi dữ liệu lên Supabase production.

## 1. Baseline và migration safety — P0

- [-] Có database test/staging riêng và biến `TEST_DATABASE_URL` bắt buộc cho integration/E2E. Guard đã có; còn cấp hạ tầng staging/test lâu dài.
- [ ] Backup schema/dữ liệu trước mọi migration production.
- [x] Thay `prisma db push` trong workflow bằng migration có review.
- [x] Tạo migration forward-only để dọn schema cũ trên database đã tồn tại.
- [-] Kiểm tra migration trên database rỗng và bản sao staging có dữ liệu. PostgreSQL 16 rỗng đã pass và không còn drift; staging có dữ liệu chưa chạy.
- [x] Seed idempotent, không chứa credential production và không chạy nhầm production. Seed roles, cấu hình nền và system wallets; có advisory lock + partial unique index chống tạo ví hệ thống trùng; chỉ chạy khi `ALLOW_SEED=true` và không phải production.
- [x] Cập nhật `.env.example` và runbook local/test/staging/production, gồm backup/restore/deploy/rollback/incident response.

## 2. Loại bỏ chức năng ngoài phạm vi — P0/P1

### 2.1. 2FA

- [x] Xóa tab/state/form/QR 2FA khỏi `ProfilePage`.
- [x] Xóa client API `setup2FA` và `verify2FA`.
- [x] Xóa endpoint `/auth/2fa/setup` và `/auth/2fa/verify`.
- [x] Xóa logic 2FA khỏi `AuthService`, `AuthModule` và service riêng.
- [x] Xóa package `otplib`, `qrcode`, `react-qr-code` nếu không còn được dùng.
- [x] Tạo migration xóa `two_factor_secret` và `is_two_factor_enabled`.
- [x] Xóa test, README và tài liệu nhắc tới 2FA.

### 2.2. Phạt/trừ tiền do vi phạm

- [x] Gỡ coupling `PenaltyService -> LedgerService/WalletsModule`.
- [x] Xóa `applyFine` và `manualPenalty`.
- [x] Giữ và mô hình hóa strike/sanction phi tài chính.
- [x] Thay rule vi phạm bằng cảnh báo và ban phi tài chính theo ngưỡng.
- [x] Ghi audit log và notification rõ lý do và luồng thực hiện.
- [x] Xóa `PENALTY_APPLIED` và mọi báo cáo/nhãn tài chính liên quan.

### 2.3. Hold/dispute/refund

- [x] Backfill `order_items.RELEASED` thành `PAID` trước khi đổi enum.
- [x] Xóa `RELEASED`, `HELD`, `REFUNDED`, `DISPUTED` và `hold_until` khỏi schema thực tế.
- [x] Xóa bảng/foreign key/index/type `disputes` còn tồn tại.
- [x] Xóa `REFUND` khỏi payment purpose, ledger transaction type và notification type.
- [x] Xóa nhánh/label refund trong Gateway, Revenue, Tax và seller sales.
- [x] Xóa nội dung quảng bá hold/dispute/refund khỏi UI và README.
- [x] Cập nhật test, query thống kê, review eligibility và checkout theo trạng thái mới.
- [x] `rg` và GitNexus không còn reference nghiệp vụ mồ côi.

## 3. Authentication & Security — P0/P1

- [x] Production thiếu JWT/SMTP/Supabase/Firebase/VNPay secret phải fail-fast; không dùng secret mặc định.
- [x] Không chấp nhận mật khẩu plaintext legacy.
- [x] Đồng nhất cost bcrypt và password policy ở register/reset/change password và frontend.
- [x] Forgot-password không làm lộ email tồn tại hay không, kể cả khi SMTP lỗi.
- [x] Reset token được hash, single-use, hết hạn và revoke toàn bộ session sau đổi mật khẩu.
- [x] Refresh-token rotation, reuse detection và session revoke/cleanup.
- [x] Refresh token chỉ nằm trong cookie HttpOnly/Secure/SameSite; access token chỉ ở memory. Refresh/logout có double-submit CSRF token, rotation và reuse detection; OAuth không đưa token vào URL.
- [x] CORS HTTP và WebSocket dùng allowlist; không dùng wildcard với credentials.
- [x] Swagger bị tắt mặc định trên production.
- [x] Rate-limit riêng cho login/register/forgot-password/OTP/report/upload/download; payment callback dùng chữ ký, atomic claim, idempotency và replay protection thay vì throttle có thể làm mất callback hợp lệ.
- [x] Kiểm thử authorization/IDOR cho order, document, review, report, download và seller/admin action. RBAC admin controller đã tách quyền theo endpoint; document/download/cart kiểm tra is_user_hidden/delete_at.
- [x] Rich text được sanitize ở backend và frontend; Helmet cung cấp security headers.
- [x] Error response production không lộ stack, SQL hoặc secret; response có request ID.

## 4. File upload, preview và storage — P0/P1

- [x] Kiểm tra magic bytes/MIME và allowlist định dạng phía server.
- [x] Giới hạn file size, page count, thời gian convert, số lần retry và response size.
- [x] Không tin page count/extension do frontend gửi.
- [ ] File mới ở trạng thái quarantine cho đến khi kiểm tra xong.
- [ ] Có malware scanning trước khi publish/download công khai.
- [x] Rollback object storage nếu DB transaction/upload pipeline thất bại.
- [x] Preview 30% và staff review file được tạo nhất quán cho PDF/Office.
- [x] Không fallback im lặng sang placeholder cho tài liệu hỏng; trả lỗi chuyển đổi rõ ràng.
- [-] Download/staff review URL có TTL ngắn và chỉ cấp sau authorization. Danh sách duyệt chỉ trả preview 30% + cờ có file; URL review đầy đủ được cấp on-demand trong 10 phút qua endpoint có RBAC/audit. Còn chuyển original/review object sang bucket private để signed URL không bị vô hiệu bởi public bucket policy.
- [ ] Tách bucket private cho original/review và bucket public cho preview; có migration object + Supabase policy được kiểm thử trên staging.
- [x] Object key được tạo từ slug đã validate, có timestamp và upload không `upsert`.

## 5. Backend/API/business rules — P1

- [x] Xóa workflow report trùng trong `ModerationModule`; `ReportsModule` là API duy nhất, moderation chỉ giữ sanction.
- [x] Body/param/query quan trọng có DTO, enum/độ dài/range và `ParseIntPipe`; pagination bị chặn ở 1..100, date range kiểm tra định dạng lẫn thứ tự. VNPay IPN giữ raw query có chủ đích để xác minh chữ ký.
- [ ] Chuẩn hóa success/error/pagination response contract.
- [-] Server-side pagination/filter/search/sort cho list endpoint chính. Documents, orders, seller documents/sales và admin documents/users/audit/approvals/reports/withdrawals đã chạy tại DB; metadata và các ledger report còn cần chiến lược phân trang/cache phù hợp.
- [-] Payment, package activation/download entitlement và withdrawal đã có atomic claim/transaction/advisory lock; còn lập state-machine test đầy đủ cho document/report/order.
- [x] Payment webhook/callback có signature validation, claim trạng thái atomically, idempotency và replay protection.
- [x] Checkout/package/download có idempotency/transaction/conditional update; migration bảo đảm một package ACTIVE. Concurrent/replay test xác nhận package chỉ trừ tiền một lần và hai download đồng thời cùng tài liệu chỉ tiêu thụ một lượt/cộng counter một lần.
- [-] Download counter cập nhật atomically cùng entitlement; view counter có throttle và local dedupe nhưng còn cần chiến lược dedupe server-side theo account/IP/time-window.
- [x] Report mở, wishlist và review có unique rule; download history ghi đúng một record cho mỗi entitlement consumption hợp lệ.
- [-] Notification trực tiếp có retry và không làm hỏng request nghiệp vụ; còn thiếu outbox/queue để bảo đảm giao hàng bền vững khi process chết.
- [ ] Xóa business logic duplicate và logic nằm sai controller/UI.
- [ ] Chuẩn hóa HTTP status code và mapping exception.

## 6. Database — P1

- [x] Schema Prisma và migration history không drift (`prisma migrate diff`: no difference).
- [x] Unique constraint cho wishlist, report đang mở, review `(buyer_id, document_id)`, checkout/package idempotency, một package ACTIVE/customer và một system wallet/type.
- [x] Check constraint cho giá/balance/count/page/rating/debit/credit và các amount tài chính chính.
- [x] Index cho document `status/delete_at/published_at`, `seller_id/status`.
- [x] Index cho session `account_id/is_revoked/expires_at`.
- [x] Index cho order item `document_id/status`, `seller_id/status/created_at`.
- [x] Index cho user package `customer_id/status/expires_at`.
- [x] Index cho report `status/created_at`, `customer_id/document_id`.
- [ ] `onDelete` được chọn có chủ đích: transaction/audit RESTRICT; relation phụ có thể CASCADE.
- [ ] Nullable/default/timestamp được chuẩn hóa và `updated_at` cập nhật đúng.
- [x] Có job cleanup session, notification, OTP và reset token hết hạn.

## 7. Frontend/UX/accessibility — P1/P2

- [x] Có trang 404, 403 và global error boundary.
- [x] Seller/admin routes dùng role guard cả UI lẫn API; forbidden có đích rõ ràng.
- [x] Mỗi page có loading/skeleton, empty, error+retry và success state. AdminReportsPage, DocumentsListPage, SellerSalesPage, SellerDocumentsPage, WishlistPage, OrdersPage, OrderDetailPage, LibraryPage, DocumentDetailPage, AdminDocumentsPage, AdminWithdrawalsPage, AdminUsersPage, AdminApprovalsPage, PolicyPage đã hoàn thiện.
- [x] Không còn silent catch làm lỗi trông giống empty state. Tất cả các trang đã có state `error` rõ ràng, hiển thị thông báo lỗi và nút "Thử lại".
- [x] Filter/search/sort/page được lưu vào URL cho refresh/back/deep-link ở documents, orders, seller documents/sales, admin documents/users/audit/approvals/reports/withdrawals và các báo cáo tài chính revenue/gateway/tax.
- [ ] Form validation hiển thị lỗi theo field và khớp backend.
- [ ] Double-submit bị chặn; action nguy hiểm có confirmation dialog thống nhất.
- [ ] Toast/notification có feedback success/failure rõ ràng.
- [-] Modal có focus trap, Escape, restore focus và accessible label. Phone verification đã hoàn thiện; các modal khác còn phải chuẩn hóa.
- [ ] Icon button có accessible name; keyboard navigation và `aria-live` hoạt động.
- [ ] Kiểm tra contrast, heading hierarchy, table và form labels.
- [ ] Responsive được xác minh ở 360/390/768/1024/1440px.
- [-] Menu chỉ hiển thị action role có quyền; forbidden không redirect mơ hồ. Guard đã chuẩn hóa; cần browser regression theo từng role.
- [x] Loại bỏ placeholder page/import/dead UI đã xác định trong audit.

## 8. Performance & reliability — P2

- [x] Lazy-load theo route và chia chunk vendor hợp lý.
- [x] Sửa dynamic import không tạo chunk của notification/wishlist store.
- [x] Giảm entry JS từ khoảng 1,78 MB xuống 468 KB và đặt bundle budget trong CI.
- [ ] Chuyển ảnh lớn sang WebP/AVIF và responsive image.
- [ ] Chuyển convert PDF/Office sang BullMQ + Redis background job.
- [ ] Upload trả job ID/progress/retry; Gotenberg có timeout/circuit breaker.
- [x] Duyệt category không dùng recursive N+1.
- [ ] Public categories/tags/policies/configs có cache/ETag hợp lý.
- [x] Chưa thêm search engine ngoài khi chưa có số liệu chứng minh nhu cầu.
- [-] Search documents/seller/admin users/audit đã debounce và đồng bộ URL; còn bổ sung AbortController/cancel stale request và rà các màn hình admin khác.
- [x] Có liveness và readiness cho DB, Supabase Storage và Gotenberg; Redis chưa tham gia runtime hiện tại.

## 9. Architecture & maintainability — P1/P2

- [ ] Tách `AdminService` theo dashboard/users/documents/finance/audit.
- [ ] Tách `CheckoutService`, `AuthService`, `SellerService` theo use case.
- [ ] Tách các React component/page quá lớn, đặc biệt Profile/MainLayout/SellerUpload/AdminDashboard.
- [ ] Có shared typed API contracts; giảm `any` ở API/store/page.
- [ ] Chuẩn hóa naming/casing DTO và response field.
- [ ] Loại hard-coded timeout, fee, threshold, URL và status string.
- [x] Xóa dependency không dùng/duplicate: 2FA, MinIO, Facebook Passport, `uuid`, `sharp`.
- [x] Pin Node 22 và dùng lockfile reproducible trong CI.
- [ ] Đồng bộ TypeScript/toolchain FE/BE theo compatibility matrix.
- [-] GitNexus index/check trước đó pass và không có circular import; lần re-index hiện tại bị Windows Application Control chặn native LadybugDB, cần allowlist/repair môi trường trước khi chạy lại.

### 9.1. Dependency remediation còn lại

- [x] Áp dụng toàn bộ bản vá audit không breaking có thể áp dụng; production tree không còn advisory Critical.
- [ ] Lập nhánh nâng cấp đồng bộ NestJS 10 lên version được hỗ trợ, cùng Swagger/Config/WebSocket/CLI; chạy compatibility và E2E trước khi merge.
- [ ] Nâng Firebase Web/Admin theo major tương thích để xử lý advisory còn lại; kiểm thử lại phone OTP.
- [ ] Thay hoặc cô lập Quill/`quill-blot-formatter`; hiện đã sanitize hai lớp nhưng dependency vẫn còn advisory XSS không có bản vá trực tiếp.
- [ ] Nâng Prisma theo migration guide riêng; không nâng major cùng đợt sửa nghiệp vụ.

## 10. Logging, monitoring và vận hành — P1/P2

- [-] Logging có request/correlation ID và đã bỏ log VNPay/OTP/email nhạy cảm; còn chuẩn hóa structured logger toàn hệ thống.
- [x] Loại `console.log/error` rải rác khỏi production path. Backend đã chuyển toàn bộ log sang NestJS `Logger`; frontend không còn console.error âm thầm nuốt lỗi mà hiển thị UI lỗi và nút thử lại cho người dùng.
- [ ] Error tracking FE/BE có source map và environment/release tagging.
- [ ] Metrics cho latency/error rate/upload conversion/payment/download/queue depth.
- [ ] Alert cho lỗi auth tăng cao, queue kẹt, Gotenberg/storage/DB unavailable.
- [ ] Có backup/restore drill và retention policy.
- [x] Có runbook deploy, rollback, migration, backup/restore và incident response.

## 11. Testing & CI/CD — P0/P1

- [x] ESLint frontend hiểu TypeScript/TSX và chạy không parsing error (còn warning debt được theo dõi).
- [x] Backend có lint config/script hoạt động.
- [x] Có script `typecheck` riêng cho FE và BE.
- [-] Unit test cho auth, entitlement, status transition, moderation và storage pipeline. Đã có unit test env validation (src/config/env.validation.spec.ts) và moderation sanction evaluation (src/modules/moderation/penalty.service.spec.ts) pass 100%.
- [-] Prisma được kiểm thử qua E2E trên PostgreSQL test cô lập bắt buộc; còn tách suite integration cấp repository/service riêng.
- [x] API E2E cho customer/mod/accountant/admin và negative authorization; toàn bộ 4 suite đạt 121/121.
- [ ] Playwright E2E cho route public/private, form/modal và responsive.
- [ ] Test đủ loading/empty/error/success/401/403/404/409/422/429.
- [-] Migration smoke test trên DB rỗng và DB có dữ liệu mẫu. DB rỗng PostgreSQL 16 + drift check đã pass; DB có dữ liệu mẫu chưa chạy.
- [x] CI chạy install, Prisma validate/generate, migration deploy/seed trên PostgreSQL service, lint, typecheck, unit test, toàn bộ API E2E, build và bundle budget.
- [x] Dependency/security scan mức Critical chạy trong CI; upgrade major vẫn tách nhánh và chỉ merge sau compatibility test.
- [x] E2E bị fail-fast nếu thiếu `TEST_DATABASE_URL` và test storage riêng; remote test DB cần opt-in rõ ràng.

## 12. Production release gate

- [x] Frontend/backend build, lint sạch (0 error, 0 warning), typecheck, 7/7 unit test và 121/121 API E2E đều pass.
- [x] Không còn mock/placeholder security behavior trong production; mock phone OTP bị cấm bởi env validation.
- [x] Không còn reference 2FA/fine/hold/dispute/refund ngoài migration archival có chú thích.
- [ ] Migration staging pass, có backup và rollback/runbook.
- [ ] Browser regression pass trên desktop/mobile cho mọi role.
- [-] Security negative/authorization test và upload giả MIME/magic-byte đã pass; còn file quá lớn, decompression bomb/malware và conversion-timeout test trong môi trường staging.
- [-] Performance budget pass; health/readiness đã triển khai nhưng cần probe trong môi trường staging đầy đủ.
- [-] README, `.env.example` và runbook đã cập nhật; Swagger/response contract còn cần rà soát đồng bộ cuối.
- [-] GitNexus index gần nhất có 2.590 nodes/6.431 edges và cycle check pass; re-index hiện tại bị Windows Application Control chặn LadybugDB nên chưa thể xác nhận lại sau commit cuối.

## Nhật ký triển khai

- 2026-09-30: Tạo kế hoạch từ audit; GitNexus index bao phủ 226 file, không phát hiện circular import.
- 2026-09-30: Loại bỏ 2FA, tiền phạt, hold/dispute/refund; thêm forward migration và hardening auth/upload/checkout.
- 2026-10-01: Migration smoke trên PostgreSQL 16 pass; `prisma migrate diff` xác nhận không còn schema drift.
- 2026-10-01: Frontend/backend lint (0 error), typecheck, unit test và build pass. Route lazy-loading giảm entry chunk còn khoảng 468 KB; bundle budget pass.
- 2026-10-01: GitNexus re-index 238 file, 2.590 node/6.431 edge; không có circular import. `rg` xác nhận không còn reference nghiệp vụ bị loại trong active source.
- 2026-10-01: Dependency audit sau remediation: frontend production 7 advisory (0 critical), backend production 28 advisory (0 critical); các phần còn lại cần major upgrade có kiểm thử, không dùng `--force`.
- 2026-10-01: RBAC admin controller tách quyền theo endpoint; accountant không còn truy cập document/user management, moderator không còn truy cập tài chính.
- 2026-10-01: Sửa lỗi orders controller không nhận query params; documents/cart/download kiểm tra is_user_hidden; package download kiểm tra expires_at; AdminReportsPage/DocumentsListPage sửa silent error; seed thêm system wallets.
- 2026-10-01: Thay thế `prisma db push` trong Dockerfile và fly.toml bằng `prisma migrate deploy` an toàn; loại bỏ console.log khỏi backend src chuyển sang NestJS Logger; xóa triệt để silent catch trên 12+ page frontend với state loading/empty/error+retry; viết unit test cho moderation sanction evaluation pass 100%.
- 2026-10-01: Chuyển refresh session sang HttpOnly cookie + CSRF, bỏ token khỏi OAuth URL/localStorage; production cookie dùng `Secure; SameSite=None`, development dùng `Lax`.
- 2026-10-01: Harden package/download/withdrawal bằng idempotency key, serializable transaction, advisory lock và conditional update; thêm unique review, single-active-package và unique system-wallet migration.
- 2026-10-01: PostgreSQL 16 sạch áp đủ 5 migration, seed chạy lặp an toàn, `prisma migrate diff` không drift; toàn bộ 4 API E2E suite đạt 104/104 test. Test không còn phụ thuộc tài khoản seed production hoặc silently skip admin/mod flow.
- 2026-10-01: Backend lint sạch; frontend giảm từ 69 xuống 15 warning bằng TypeScript-aware lint, xóa dead code/log rải rác, bổ sung Home/DocumentsList error+retry và sửa URL/debounce. Build và bundle budget tiếp tục pass.
- 2026-10-01: GitNexus lần chạy mới bị Windows Application Control chặn `lbugjs.node`; giữ kết quả index/cycle gần nhất và không tuyên bố re-index mới thành công.
- 2026-10-01: Frontend lint sạch 0 warning sau khi chuẩn hóa callback/effect; sửa lỗi pagination seller bị reset về trang 1 và lưu filter/page vào URL cho documents, orders, seller documents/sales, admin documents.
- 2026-10-01: Chuẩn hóa query DTO/range cho documents, orders, seller, notifications, admin và tags; date range sai/thứ tự ngược trả 400. Admin documents chuyển từ tải toàn bộ + client pagination sang `count/findMany skip/take` tại PostgreSQL.
- 2026-10-01: Thêm test upload giả PDF, query invalid, role accountant/mod và package purchase đồng thời. Package idempotency xử lý transaction conflict bằng bounded winner lookup.
- 2026-10-01: Test download đồng thời phát hiện `pg_advisory_xact_lock` trả `void` không tương thích Prisma và transaction P2034 khi tranh chấp; đã cast kết quả khóa, retry bounded và xác nhận chỉ trừ một lượt/cộng một download. Toàn bộ 7/7 unit và 113/113 API E2E pass.
- 2026-10-02: Admin users và audit logs chuyển sang count/skip/take, filter/sort/search tại PostgreSQL và lưu state trong URL; loại bỏ lọc email audit trên tập dữ liệu đã cắt ngắn. API chặn moderator truy vấn danh sách staff thay vì chỉ ẩn tab ở UI. Toàn bộ 7/7 unit và 116/116 API E2E pass.
- 2026-10-02: Approvals, reports và withdrawals chuyển sang `{ meta, data }`, count/skip/take và filter/search tại PostgreSQL; frontend lưu filter/page trong URL, tự quay về trang trước khi action làm rỗng trang cuối. Validation query và regression đạt 7/7 unit, 120/120 API E2E; build/bundle budget pass.
- 2026-10-02: Loại URL review đầy đủ khỏi payload danh sách phê duyệt; frontend chỉ yêu cầu signed URL 10 phút khi staff bấm xem và backend ghi audit log. Regression đạt 7/7 unit, 121/121 API E2E; lint/typecheck/build và bundle budget đều pass.
- 2026-10-02: Đồng bộ khoảng ngày và trang hiện tại của báo cáo revenue/gateway/tax vào URL; mở rộng hook pagination dùng được ở controlled mode để back/forward/deep-link giữ đúng trạng thái. Frontend lint/typecheck/build và bundle budget pass.
