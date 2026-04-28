-- cc25: ActivityLog. Server-side persistent log of appointment-level
-- actions (book/move/transfer/status/add_time/check_in/break/etc.).
-- Replaces the cc14-era client-only useState log that vanished on page
-- refresh. 60-day retention pruned nightly by server.js.

CREATE TABLE "ActivityLog" (
  "id" TEXT NOT NULL,
  "salon_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "action" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "client_name" TEXT,
  "client_phone" TEXT,
  "tech_name" TEXT,
  "tech_id" TEXT,
  "service_name" TEXT,
  "appointment_id" TEXT,
  "requested" BOOLEAN NOT NULL DEFAULT false,
  "changed_tech" BOOLEAN NOT NULL DEFAULT false,
  "payload" JSONB,

  CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityLog_salon_id_created_at_idx" ON "ActivityLog"("salon_id", "created_at");
CREATE INDEX "ActivityLog_salon_id_client_phone_idx" ON "ActivityLog"("salon_id", "client_phone");
CREATE INDEX "ActivityLog_salon_id_client_name_idx" ON "ActivityLog"("salon_id", "client_name");
