ALTER TABLE "DataDeletionRequest" ADD COLUMN "verifiedUserId" TEXT;
ALTER TABLE "DataDeletionRequest" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "DataDeletionRequest" ADD COLUMN "completedAt" TIMESTAMP(3);
CREATE INDEX "DataDeletionRequest_verifiedUserId_idx" ON "DataDeletionRequest"("verifiedUserId");