-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "is_two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone_otp_code" VARCHAR(10),
ADD COLUMN     "phone_otp_expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "two_factor_secret" VARCHAR(255);
