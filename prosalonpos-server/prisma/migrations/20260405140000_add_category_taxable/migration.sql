-- AlterTable: Add taxable flag to ProductCategory (defaults to true)
ALTER TABLE "ProductCategory" ADD COLUMN "taxable" BOOLEAN NOT NULL DEFAULT true;
