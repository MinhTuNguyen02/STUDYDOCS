-- A regular composite unique constraint permits duplicate NULL customer_id values.
-- Financial system wallets must have exactly one row per wallet type.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "wallets"
    WHERE "customer_id" IS NULL
    GROUP BY "wallet_type"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate system wallets found; reconcile balances before applying this migration';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "wallets_unique_system_type"
  ON "wallets"("wallet_type")
  WHERE "customer_id" IS NULL;
