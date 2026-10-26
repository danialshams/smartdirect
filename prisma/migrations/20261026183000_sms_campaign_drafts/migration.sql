CREATE TABLE IF NOT EXISTS "SmsCampaign" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "selection" JSONB NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "verifiedRecipientCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SmsCampaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SmsCampaign_createdAt_idx" ON "SmsCampaign"("createdAt");
