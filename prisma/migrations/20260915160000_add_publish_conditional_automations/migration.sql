ALTER TABLE "InstagramPublishJob"
  ADD COLUMN "commentAutomationId" TEXT,
  ADD COLUMN "storyReplyAutomationId" TEXT;

CREATE INDEX "InstagramPublishJob_commentAutomationId_idx"
  ON "InstagramPublishJob"("commentAutomationId");

CREATE INDEX "InstagramPublishJob_storyReplyAutomationId_idx"
  ON "InstagramPublishJob"("storyReplyAutomationId");
