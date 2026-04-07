-- AlterTable
ALTER TABLE "PackageRedemption" ALTER COLUMN "service_redeemed_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PackageRedemption" ALTER COLUMN "package_service_id" DROP NOT NULL;
