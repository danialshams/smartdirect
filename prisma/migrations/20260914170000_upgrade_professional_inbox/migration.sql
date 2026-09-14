ALTER TABLE "Conversation"
ADD COLUMN "participantUsername" TEXT,
ADD COLUMN "participantName" TEXT,
ADD COLUMN "participantProfilePicture" TEXT;

ALTER TABLE "ConversationMessage"
ADD COLUMN "readAt" TIMESTAMP(3),
ADD COLUMN "seenAt" TIMESTAMP(3);

CREATE INDEX "ConversationMessage_conversationId_readAt_idx"
ON "ConversationMessage"("conversationId", "readAt");
