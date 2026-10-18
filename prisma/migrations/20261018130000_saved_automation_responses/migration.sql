CREATE TABLE "SavedAutomationResponse" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "instagramAccountId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "messageType" TEXT NOT NULL,
  "text" TEXT,
  "mediaUrl" TEXT,
  "mediaId" TEXT,
  "showcaseId" TEXT,
  "formId" TEXT,
  "quickReplies" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedAutomationResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedAutomationResponse_userId_instagramAccountId_createdAt_idx"
ON "SavedAutomationResponse"("userId", "instagramAccountId", "createdAt");

CREATE INDEX "SavedAutomationResponse_instagramAccountId_messageType_idx"
ON "SavedAutomationResponse"("instagramAccountId", "messageType");

ALTER TABLE "SavedAutomationResponse"
ADD CONSTRAINT "SavedAutomationResponse_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedAutomationResponse"
ADD CONSTRAINT "SavedAutomationResponse_instagramAccountId_fkey"
FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
