-- Durable sync state — one row per sync kind (full | map | range | status).
-- UNIQUE(kind) + a conditional UPDATE claim = cross-tab / cross-instance lock;
-- the row doubles as the progress record the client polls while a detached
-- background sync runs ("updatedAt" is the liveness heartbeat).
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "rangeKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "pct" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT NOT NULL DEFAULT '',
    "counts" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SyncRun_kind_key" ON "SyncRun"("kind");
