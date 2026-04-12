-- AlterTable: Expand LoyaltyProgram to match Session 11 planning doc
-- Replaces old minimal fields (enabled, points_per_dollar) with full config

-- Step 1: Add new columns with defaults
ALTER TABLE "LoyaltyProgram" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LoyaltyProgram" ADD COLUMN IF NOT EXISTS "program_type" TEXT NOT NULL DEFAULT 'flat';
ALTER TABLE "LoyaltyProgram" ADD COLUMN IF NOT EXISTS "earn_per_dollar" DOUBLE PRECISION;
ALTER TABLE "LoyaltyProgram" ADD COLUMN IF NOT EXISTS "earn_per_visit" INTEGER;
ALTER TABLE "LoyaltyProgram" ADD COLUMN IF NOT EXISTS "expiration_months" INTEGER;
ALTER TABLE "LoyaltyProgram" ADD COLUMN IF NOT EXISTS "redemption_mode" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "LoyaltyProgram" ADD COLUMN IF NOT EXISTS "tier_reset" TEXT;
ALTER TABLE "LoyaltyProgram" ADD COLUMN IF NOT EXISTS "show_on_receipt" BOOLEAN NOT NULL DEFAULT true;

-- Step 2: Migrate existing data — copy enabled→active, points_per_dollar→earn_per_dollar
UPDATE "LoyaltyProgram" SET "active" = "enabled", "earn_per_dollar" = "points_per_dollar";

-- Step 3: Drop old columns
ALTER TABLE "LoyaltyProgram" DROP COLUMN IF EXISTS "enabled";
ALTER TABLE "LoyaltyProgram" DROP COLUMN IF EXISTS "points_per_dollar";
