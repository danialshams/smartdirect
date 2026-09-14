-- Add STORY publishing type
ALTER TYPE "InstagramPublishType" ADD VALUE IF NOT EXISTS 'STORY';

-- Prevent two scheduled publishing jobs for the same Instagram account
-- from using the exact same timestamp. PostgreSQL allows multiple NULLs,
-- so immediate-publish jobs remain unaffected.
CREATE UNIQUE INDEX "InstagramPublishJob_instagramAccountId_scheduledAt_key"
ON "InstagramPublishJob"("instagramAccountId", "scheduledAt");
