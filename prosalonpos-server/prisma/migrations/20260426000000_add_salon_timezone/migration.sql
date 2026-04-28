-- v2.0.6: Per-salon timezone. Set at salon creation in provider admin.
-- Default 'America/New_York' applies to all existing salons (Eastern customers).
-- Used by dayBounds, auto-clockout cron, SMS formatters, timesheet display.

ALTER TABLE "Salon" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/New_York';
