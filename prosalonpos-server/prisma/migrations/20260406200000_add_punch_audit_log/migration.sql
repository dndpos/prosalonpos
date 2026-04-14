-- CreateTable
CREATE TABLE "PunchAuditLog" (
    "id" TEXT NOT NULL,
    "punch_id" TEXT,
    "staff_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by" TEXT,
    "changed_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PunchAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PunchAuditLog_staff_id_created_at_idx" ON "PunchAuditLog"("staff_id", "created_at");

-- CreateIndex
CREATE INDEX "PunchAuditLog_punch_id_idx" ON "PunchAuditLog"("punch_id");

-- AddForeignKey
ALTER TABLE "PunchAuditLog" ADD CONSTRAINT "PunchAuditLog_punch_id_fkey" FOREIGN KEY ("punch_id") REFERENCES "ClockPunch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
