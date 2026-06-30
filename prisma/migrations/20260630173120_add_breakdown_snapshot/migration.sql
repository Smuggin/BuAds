-- CreateTable
CREATE TABLE "BreakdownSnapshot" (
    "id" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakdownSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BreakdownSnapshot_adAccountId_window_key" ON "BreakdownSnapshot"("adAccountId", "window");

-- AddForeignKey
ALTER TABLE "BreakdownSnapshot" ADD CONSTRAINT "BreakdownSnapshot_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
