-- CreateTable
CREATE TABLE "StaffPresence" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPresence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffPresence_staff_id_salon_id_key" ON "StaffPresence"("staff_id", "salon_id");

-- CreateIndex
CREATE INDEX "StaffPresence_salon_id_status_idx" ON "StaffPresence"("salon_id", "status");
