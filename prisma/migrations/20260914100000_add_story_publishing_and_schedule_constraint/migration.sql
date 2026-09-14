-- Add STORY publishing type
ALTER TYPE "InstagramPublishType" ADD VALUE IF NOT EXISTS 'STORY';

-- Prevent two active publishing jobs for the same Instagram account
-- from using the exact same scheduled timestamp. Cancelled jobs release
-- their timestamp, and immediate-publish jobs with NULL scheduledAt are unaffected.
CREATE UNIQUE INDEX "InstagramPublishJob_instagramAccountId_scheduledAt_key"
ON "InstagramPublishJob"("instagramAccountId", "scheduledAt")
WHERE "scheduledAt" IS NOT NULL AND "status" <> 'CANCELLED';
