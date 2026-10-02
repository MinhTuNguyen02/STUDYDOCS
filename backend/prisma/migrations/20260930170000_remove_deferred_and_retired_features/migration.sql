-- Remove deferred 2FA and retired hold/dispute/refund concepts.
-- This migration intentionally aborts if legacy refund/dispute records require
-- a manual archive decision. Run it on a staging copy before production.

ALTER TABLE "accounts"
  DROP COLUMN IF EXISTS "two_factor_secret",
  DROP COLUMN IF EXISTS "is_two_factor_enabled";

DO $$
BEGIN
  IF to_regclass('public.disputes') IS NOT NULL
     AND EXISTS (SELECT 1 FROM "disputes" LIMIT 1) THEN
    RAISE EXCEPTION 'disputes contains legacy data; archive it before running this migration';
  END IF;
END $$;

DROP TABLE IF EXISTS "disputes";
DROP TYPE IF EXISTS "dispute_status";
DROP INDEX IF EXISTS "idx_order_items_hold_until";
DROP INDEX IF EXISTS "idx_order_items_seller_hold_until";
ALTER TABLE "order_items" DROP COLUMN IF EXISTS "hold_until";
ALTER TABLE "wallets" DROP COLUMN IF EXISTS "pending_balance";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "order_items"
    WHERE "status"::text IN ('REFUNDED', 'DISPUTED')
  ) THEN
    RAISE EXCEPTION 'order_items contains REFUNDED/DISPUTED data; archive it before running this migration';
  END IF;
END $$;

UPDATE "order_items"
SET "status" = 'PAID'
WHERE "status"::text IN ('HELD', 'RELEASED');

ALTER TYPE "order_item_status" RENAME TO "order_item_status_legacy";
CREATE TYPE "order_item_status" AS ENUM ('PENDING', 'PAID');
ALTER TABLE "order_items"
  ALTER COLUMN "status" TYPE "order_item_status"
  USING ("status"::text::"order_item_status");
DROP TYPE "order_item_status_legacy";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "orders" WHERE "status"::text IN ('REFUNDED', 'PARTIAL_REFUNDED')
  ) THEN
    RAISE EXCEPTION 'Cannot remove refunded order states while matching orders still exist';
  END IF;
END $$;

ALTER TYPE "order_status" RENAME TO "order_status_legacy";
CREATE TYPE "order_status" AS ENUM ('PENDING_PAYMENT', 'PAID', 'CANCELLED');
ALTER TABLE "orders"
  ALTER COLUMN "status" TYPE "order_status"
  USING ("status"::text::"order_status");
DROP TYPE "order_status_legacy";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "payments" WHERE "purpose"::text = 'REFUND'
  ) THEN
    RAISE EXCEPTION 'payments contains REFUND data; archive it before running this migration';
  END IF;
END $$;

ALTER TYPE "payment_purpose" RENAME TO "payment_purpose_legacy";
CREATE TYPE "payment_purpose" AS ENUM ('ORDER_PAYMENT', 'WALLET_TOPUP', 'PACKAGE_PURCHASE');
ALTER TABLE "payments"
  ALTER COLUMN "purpose" TYPE "payment_purpose"
  USING ("purpose"::text::"payment_purpose");
DROP TYPE "payment_purpose_legacy";

-- Rejected withdrawal reversals previously used REFUND. Preserve the ledger
-- rows and classify them as deposits/reversals instead of deleting history.
ALTER TYPE "ledger_transaction_type" RENAME TO "ledger_transaction_type_legacy";
CREATE TYPE "ledger_transaction_type" AS ENUM ('PURCHASE', 'WITHDRAW', 'DEPOSIT');
ALTER TABLE "ledger_transactions"
  ALTER COLUMN "type" TYPE "ledger_transaction_type"
  USING (
    CASE
      WHEN "type"::text = 'REFUND' THEN 'DEPOSIT'
      ELSE "type"::text
    END::"ledger_transaction_type"
  );
DROP TYPE "ledger_transaction_type_legacy";

-- Some deployed databases received notifications through db push before the
-- migration baseline was created. Create the missing baseline objects when
-- rebuilding a database from migration history.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE "notification_type" AS ENUM (
      'ORDER_NEW', 'DOC_APPROVED', 'DOC_REJECTED', 'DOC_HIDDEN', 'DOC_PENDING',
      'TOPUP_SUCCESS', 'WITHDRAWAL_PAID', 'WITHDRAWAL_REJECTED', 'WITHDRAWAL_NEW',
      'NEW_REVIEW', 'REVIEW_REPLY', 'REPORT_HANDLED', 'REPORT_NEW',
      'ACCOUNT_BANNED', 'ACCOUNT_UNBANNED', 'FUNDS_RELEASED', 'SYSTEM'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" SERIAL NOT NULL,
  "account_id" INTEGER NOT NULL,
  "type" "notification_type" NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "message" TEXT NOT NULL,
  "reference_id" INTEGER,
  "reference_type" VARCHAR(50),
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_account_id_fkey') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_account_id_fkey"
      FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;

UPDATE "notifications"
SET "type" = 'SYSTEM'
WHERE "type"::text = 'FUNDS_RELEASED';

ALTER TYPE "notification_type" RENAME TO "notification_type_legacy";
CREATE TYPE "notification_type" AS ENUM (
  'ORDER_NEW',
  'DOC_APPROVED',
  'DOC_REJECTED',
  'DOC_HIDDEN',
  'DOC_PENDING',
  'TOPUP_SUCCESS',
  'WITHDRAWAL_PAID',
  'WITHDRAWAL_REJECTED',
  'WITHDRAWAL_NEW',
  'NEW_REVIEW',
  'REVIEW_REPLY',
  'REPORT_HANDLED',
  'REPORT_NEW',
  'ACCOUNT_BANNED',
  'ACCOUNT_UNBANNED',
  'SYSTEM'
);
ALTER TABLE "notifications"
  ALTER COLUMN "type" TYPE "notification_type"
  USING ("type"::text::"notification_type");
DROP TYPE "notification_type_legacy";

ALTER TYPE "user_package_status" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "wallet_type" ADD VALUE IF NOT EXISTS 'GATEWAY_POOL';
ALTER TYPE "wallet_type" ADD VALUE IF NOT EXISTS 'SYSTEM_REVENUE';
ALTER TYPE "wallet_type" ADD VALUE IF NOT EXISTS 'TAX_PAYABLE';

ALTER TABLE "accounts"
  ADD COLUMN IF NOT EXISTS "banned_until" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "reset_password_expires" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "reset_password_token" VARCHAR(255);
ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "is_user_hidden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "review_url" VARCHAR(255);
ALTER TABLE "reviews"
  ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "replied_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "seller_reply" TEXT;
ALTER TABLE "user_packages" ALTER COLUMN "expires_at" DROP NOT NULL;
ALTER TABLE "user_packages" ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(100);
ALTER TABLE "wallets" ALTER COLUMN "customer_id" DROP NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS "orders_buyer_id_idempotency_key_key"
  ON "orders"("buyer_id", "idempotency_key");

CREATE INDEX IF NOT EXISTS "idx_user_sessions_account_active_expiry"
  ON "user_sessions"("account_id", "is_revoked", "expires_at");
CREATE INDEX IF NOT EXISTS "idx_documents_public_listing"
  ON "documents"("status", "delete_at", "published_at");
CREATE INDEX IF NOT EXISTS "idx_documents_seller_status"
  ON "documents"("seller_id", "status");
CREATE INDEX IF NOT EXISTS "idx_order_items_document_status"
  ON "order_items"("document_id", "status");
CREATE INDEX IF NOT EXISTS "idx_order_items_seller_status_created"
  ON "order_items"("seller_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "idx_reports_status_created"
  ON "reports"("status", "created_at");
CREATE INDEX IF NOT EXISTS "idx_reports_customer_document"
  ON "reports"("customer_id", "document_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_reports_open_customer_document_type"
  ON "reports"("customer_id", "document_id", "type")
  WHERE "status" IN ('PENDING', 'REVIEWING');
CREATE INDEX IF NOT EXISTS "idx_user_packages_customer_status_expiry"
  ON "user_packages"("customer_id", "status", "expires_at");
CREATE UNIQUE INDEX IF NOT EXISTS "user_packages_customer_id_idempotency_key_key"
  ON "user_packages"("customer_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "idx_notifications_account_read"
  ON "notifications"("account_id", "is_read");
CREATE INDEX IF NOT EXISTS "idx_notifications_created_at"
  ON "notifications"("created_at");

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_price_nonnegative" CHECK ("price" >= 0),
  ADD CONSTRAINT "documents_page_count_positive" CHECK ("page_count" > 0),
  ADD CONSTRAINT "documents_counters_nonnegative" CHECK ("view_count" >= 0 AND "download_count" >= 0),
  ADD CONSTRAINT "documents_rating_range" CHECK ("average_rating" >= 0 AND "average_rating" <= 5);
ALTER TABLE "packages"
  ADD CONSTRAINT "packages_values_valid" CHECK ("price" >= 0 AND "download_turns" > 0 AND "duration_days" > 0);
ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_balance_nonnegative" CHECK ("balance" >= 0);
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_amounts_valid" CHECK (
    "debit_amount" >= 0 AND "credit_amount" >= 0
    AND (("debit_amount" > 0 AND "credit_amount" = 0) OR ("credit_amount" > 0 AND "debit_amount" = 0))
  );
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_total_nonnegative" CHECK ("total_amount" >= 0);
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_amounts_valid" CHECK (
    "unit_price" >= 0 AND "commission_fee" >= 0 AND "seller_earning" >= 0
    AND "commission_fee" + "seller_earning" = "unit_price"
  );
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "withdrawal_requests"
  ADD CONSTRAINT "withdrawal_amounts_valid" CHECK (
    "amount" > 0 AND "tax_amount" >= 0 AND "net_amount" >= 0
    AND "tax_amount" + "net_amount" = "amount"
  );
ALTER TABLE "user_packages"
  ADD CONSTRAINT "user_packages_turns_nonnegative" CHECK ("turns_remaining" >= 0);
