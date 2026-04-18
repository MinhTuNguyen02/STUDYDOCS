CREATE TABLE "notifications" (
    "notification_id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "link" VARCHAR(255),
    "metadata" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

CREATE INDEX "idx_notifications_account_created_at" ON "notifications"("account_id", "created_at" DESC);
CREATE INDEX "idx_notifications_account_is_read" ON "notifications"("account_id", "is_read");

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_account_id_fkey"
FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id")
ON DELETE CASCADE ON UPDATE NO ACTION;
