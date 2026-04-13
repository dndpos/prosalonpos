/*
  Warnings:

  - You are about to drop the column `name` on the `MembershipPerk` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `MembershipPerk` table. All the data in the column will be lost.
  - You are about to drop the column `billing_interval` on the `MembershipPlan` table. All the data in the column will be lost.
  - You are about to drop the column `discount_pct` on the `MembershipPlan` table. All the data in the column will be lost.
  - You are about to drop the column `included_services` on the `MembershipPlan` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MembershipPerk" DROP COLUMN "name",
DROP COLUMN "value",
ADD COLUMN     "category_id" TEXT,
ADD COLUMN     "credit_amount_cents" INTEGER,
ADD COLUMN     "discount_percentage" INTEGER,
ADD COLUMN     "quantity_per_cycle" INTEGER,
ADD COLUMN     "service_catalog_id" TEXT,
ALTER COLUMN "type" SET DEFAULT 'percentage_discount';

-- AlterTable
ALTER TABLE "MembershipPlan" DROP COLUMN "billing_interval",
DROP COLUMN "discount_pct",
DROP COLUMN "included_services",
ADD COLUMN     "billing_cycle_days" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "credit_rollover" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "freeze_allowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "min_commitment_cycles" INTEGER,
ADD COLUMN     "missed_payment_action" TEXT NOT NULL DEFAULT 'pause',
ADD COLUMN     "missed_payment_threshold" INTEGER,
ADD COLUMN     "notice_period_days" INTEGER,
ADD COLUMN     "payment_method" TEXT NOT NULL DEFAULT 'in_person',
ADD COLUMN     "perk_apply_mode" TEXT NOT NULL DEFAULT 'auto',
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;
