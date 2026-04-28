-- v2.3.2: V2.3 Phase 3c offline-write idempotency.
-- Every renderer write carries X-Client-Op-Id (UUID4). Server caches the
-- first response by (salon_id, key) so a replayed/retried write returns
-- the cached body instead of re-running the route. Additive table only —
-- no FKs, no touches to existing rows. Safe zero-downtime deploy.

CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyKey_salon_id_key_key" ON "IdempotencyKey"("salon_id", "key");

CREATE INDEX "IdempotencyKey_salon_id_created_at_idx" ON "IdempotencyKey"("salon_id", "created_at");
