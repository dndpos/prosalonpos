-- cc19: per-station payment tagging + per-terminal salon config

-- 1. Add station_id to TicketPayment so reports can aggregate per-station.
ALTER TABLE "TicketPayment" ADD COLUMN "station_id" TEXT;
CREATE INDEX "TicketPayment_station_id_idx" ON "TicketPayment"("station_id");

-- 2. New SalonTerminal table (one row per physical PAX at a salon).
CREATE TABLE "SalonTerminal" (
    "id"           TEXT NOT NULL,
    "salon_id"    TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "station_key" TEXT,
    "station_id"  TEXT,
    "helper_host" TEXT NOT NULL DEFAULT '127.0.0.1',
    "helper_port" INTEGER NOT NULL DEFAULT 10009,
    "pax_ip"      TEXT NOT NULL,
    "pax_port"    INTEGER NOT NULL DEFAULT 10009,
    "cc_device_id" TEXT,
    "active"      BOOLEAN NOT NULL DEFAULT true,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalonTerminal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalonTerminal_station_key_key" ON "SalonTerminal"("station_key");
CREATE INDEX "SalonTerminal_salon_id_idx" ON "SalonTerminal"("salon_id");
CREATE INDEX "SalonTerminal_salon_id_station_id_idx" ON "SalonTerminal"("salon_id", "station_id");

ALTER TABLE "SalonTerminal" ADD CONSTRAINT "SalonTerminal_salon_id_fkey"
  FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
