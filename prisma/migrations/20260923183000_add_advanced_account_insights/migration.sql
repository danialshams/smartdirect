-- Add advanced account-level Instagram insight metrics.
ALTER TABLE "InstagramInsightSnapshot"
  ADD COLUMN "follows" INTEGER,
  ADD COLUMN "unfollows" INTEGER,
  ADD COLUMN "profileLinksTaps" INTEGER;
