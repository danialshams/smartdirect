ALTER TYPE "AutomationTriggerType" ADD VALUE IF NOT EXISTS 'LIVE_COMMENT_KEYWORD';
ALTER TABLE "Automation" ADD COLUMN "liveReplyMode" TEXT NOT NULL DEFAULT 'DIRECT', ADD COLUMN "liveReplyKeyword" TEXT;
CREATE TABLE "LiveCommentReply" (
  "id" TEXT NOT NULL, "instagramAccountId" TEXT NOT NULL, "automationId" TEXT NOT NULL,
  "commentId" TEXT NOT NULL, "liveMediaId" TEXT NOT NULL, "commenterId" TEXT, "participantId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RESERVED', "outboundMessageId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "LiveCommentReply_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LiveCommentReply_commentId_key" ON "LiveCommentReply"("commentId");
CREATE UNIQUE INDEX "LiveCommentReply_instagramAccountId_liveMediaId_commenterId_key" ON "LiveCommentReply"("instagramAccountId","liveMediaId","commenterId");
CREATE INDEX "LiveCommentReply_instagramAccountId_participantId_status_expiresAt_idx" ON "LiveCommentReply"("instagramAccountId","participantId","status","expiresAt");
CREATE INDEX "LiveCommentReply_automationId_idx" ON "LiveCommentReply"("automationId");
CREATE INDEX "LiveCommentReply_expiresAt_idx" ON "LiveCommentReply"("expiresAt");
ALTER TABLE "LiveCommentReply" ADD CONSTRAINT "LiveCommentReply_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveCommentReply" ADD CONSTRAINT "LiveCommentReply_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
