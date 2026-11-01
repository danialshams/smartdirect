ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;
CREATE TABLE IF NOT EXISTS "DataDeletionRequest" (
    "id" TEXT NOT NULL,
    "contact" VARCHAR(190) NOT NULL,
    "instagramName" VARCHAR(80),
    "details" VARCHAR(600),
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "ipHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataDeletionRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DataDeletionRequest_ipHash_createdAt_idx" ON "DataDeletionRequest"("ipHash","createdAt");
CREATE INDEX IF NOT EXISTS "DataDeletionRequest_status_createdAt_idx" ON "DataDeletionRequest"("status","createdAt");
