-- PostgreSQL requires a newly added enum value to be committed before it can be used.
-- This migration intentionally follows the migration that adds user_package_status.PENDING.
WITH ranked_active_packages AS (
  SELECT "user_package_id",
         ROW_NUMBER() OVER (
           PARTITION BY "customer_id"
           ORDER BY "purchased_at", "user_package_id"
         ) AS position
  FROM "user_packages"
  WHERE "status" = 'ACTIVE'
)
UPDATE "user_packages" AS up
SET "status" = 'PENDING', "expires_at" = NULL
FROM ranked_active_packages AS ranked
WHERE up."user_package_id" = ranked."user_package_id"
  AND ranked.position > 1;

ALTER TABLE "user_packages" ADD COLUMN IF NOT EXISTS "active_slot" INTEGER;
UPDATE "user_packages"
SET "active_slot" = CASE WHEN "status" = 'ACTIVE' THEN 1 ELSE NULL END;
CREATE UNIQUE INDEX IF NOT EXISTS "user_packages_customer_id_active_slot_key"
  ON "user_packages"("customer_id", "active_slot");
ALTER TABLE "user_packages"
  ADD CONSTRAINT "user_packages_active_slot_matches_status" CHECK (
    ("status" = 'ACTIVE' AND "active_slot" = 1)
    OR ("status" <> 'ACTIVE' AND "active_slot" IS NULL)
  );

-- Keep the most recently updated review if a legacy db-push deployment allowed
-- more than one review for the same buyer/document pair.
WITH ranked_reviews AS (
  SELECT "review_id",
         ROW_NUMBER() OVER (
           PARTITION BY "buyer_id", "document_id"
           ORDER BY "updated_at" DESC NULLS LAST, "created_at" DESC NULLS LAST, "review_id" DESC
         ) AS position
  FROM "reviews"
)
DELETE FROM "reviews" AS review
USING ranked_reviews AS ranked
WHERE review."review_id" = ranked."review_id"
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "reviews_buyer_id_document_id_key"
  ON "reviews"("buyer_id", "document_id");
