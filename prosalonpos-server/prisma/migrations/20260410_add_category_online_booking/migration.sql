-- Add show_on_online_booking to ServiceCategory (defaults true)
ALTER TABLE "ServiceCategory" ADD COLUMN "show_on_online_booking" BOOLEAN NOT NULL DEFAULT true;
