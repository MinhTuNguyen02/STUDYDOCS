-- Backfill timestamps that have always had application/database defaults, then enforce the invariant.
UPDATE "accounts" SET "updated_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP);
UPDATE "staff_profiles" SET "updated_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP);
UPDATE "customer_profiles" SET "updated_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP);
UPDATE "documents" SET "updated_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP);
UPDATE "reviews" SET "created_at" = COALESCE("created_at", CURRENT_TIMESTAMP), "updated_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP);
UPDATE "carts" SET "created_at" = COALESCE("created_at", CURRENT_TIMESTAMP), "updated_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP);
UPDATE "cart_items" SET "add_at" = COALESCE("add_at", CURRENT_TIMESTAMP);
UPDATE "wishlists" SET "created_at" = COALESCE("created_at", CURRENT_TIMESTAMP);
UPDATE "payments" SET "created_at" = COALESCE("created_at", CURRENT_TIMESTAMP);
UPDATE "withdrawal_requests" SET "updated_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP);
UPDATE "reports" SET "created_at" = COALESCE("created_at", CURRENT_TIMESTAMP), "updated_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP);
UPDATE "configs" SET "created_at" = COALESCE("created_at", CURRENT_TIMESTAMP), "updated_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP);

ALTER TABLE "accounts" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "staff_profiles" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "customer_profiles" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "documents" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "reviews" ALTER COLUMN "created_at" SET NOT NULL, ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "carts" ALTER COLUMN "created_at" SET NOT NULL, ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "cart_items" ALTER COLUMN "add_at" SET NOT NULL;
ALTER TABLE "wishlists" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "withdrawal_requests" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "reports" ALTER COLUMN "created_at" SET NOT NULL, ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "configs" ALTER COLUMN "created_at" SET NOT NULL, ALTER COLUMN "updated_at" SET NOT NULL;

-- Auxiliary data follows its owner; financial and audit relations intentionally remain RESTRICT/NO ACTION.
ALTER TABLE "user_sessions" DROP CONSTRAINT "user_sessions_account_id_fkey",
  ADD CONSTRAINT "user_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_account_id_fkey",
  ADD CONSTRAINT "notifications_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "document_tags" DROP CONSTRAINT "document_tags_document_id_fkey",
  ADD CONSTRAINT "document_tags_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "document_tags" DROP CONSTRAINT "document_tags_tag_id_fkey",
  ADD CONSTRAINT "document_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("tag_id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "carts" DROP CONSTRAINT "carts_customer_id_fkey",
  ADD CONSTRAINT "carts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("customer_id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_cart_id_fkey",
  ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("cart_id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_document_id_fkey",
  ADD CONSTRAINT "cart_items_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "wishlists" DROP CONSTRAINT "wishlists_customer_id_fkey",
  ADD CONSTRAINT "wishlists_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("customer_id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "wishlists" DROP CONSTRAINT "wishlists_document_id_fkey",
  ADD CONSTRAINT "wishlists_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "documents" DROP CONSTRAINT "documents_staff_id_fkey",
  ADD CONSTRAINT "documents_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("staff_id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "withdrawal_requests" DROP CONSTRAINT "withdrawal_requests_accountant_id_fkey",
  ADD CONSTRAINT "withdrawal_requests_accountant_id_fkey" FOREIGN KEY ("accountant_id") REFERENCES "staff_profiles"("staff_id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "reports" DROP CONSTRAINT "reports_staff_id_fkey",
  ADD CONSTRAINT "reports_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("staff_id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "policies" DROP CONSTRAINT "policies_updated_by_fkey",
  ADD CONSTRAINT "policies_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "staff_profiles"("staff_id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "download_history" DROP CONSTRAINT "download_history_order_item_id_fkey",
  ADD CONSTRAINT "download_history_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("order_item_id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "download_history" DROP CONSTRAINT "download_history_user_package_id_fkey",
  ADD CONSTRAINT "download_history_user_package_id_fkey" FOREIGN KEY ("user_package_id") REFERENCES "user_packages"("user_package_id") ON DELETE SET NULL ON UPDATE NO ACTION;
