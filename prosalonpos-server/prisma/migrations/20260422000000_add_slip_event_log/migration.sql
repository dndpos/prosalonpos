-- cc15: SlipEvent audit log. Every ticket lifecycle event is logged here,
-- keyed by the stable 8-hex short_id that appears on the check-in slip
-- barcode. Lets the cashier/debugger see the full from-print-to-close
-- timeline for any ticket.

CREATE TABLE "SlipEvent" (
  "id" TEXT NOT NULL,
  "salon_id" TEXT NOT NULL,
  "short_id" TEXT NOT NULL,
  "appointment_id" TEXT,
  "ticket_id" TEXT,
  "event_type" TEXT NOT NULL,
  "payload" JSONB,
  "station_id" TEXT,
  "staff_id" TEXT,
  "staff_name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SlipEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SlipEvent_salon_id_short_id_created_at_idx" ON "SlipEvent"("salon_id", "short_id", "created_at");
CREATE INDEX "SlipEvent_salon_id_created_at_idx" ON "SlipEvent"("salon_id", "created_at");
