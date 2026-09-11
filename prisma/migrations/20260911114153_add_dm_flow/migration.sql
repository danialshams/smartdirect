-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'QUICK_REPLY', 'IMAGE', 'VIDEO', 'AUDIO', 'STICKER', 'REACTION');

-- CreateTable
CREATE TABLE "AutomationMessage" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickReply" (
    "id" TEXT NOT NULL,
    "automationMessageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "replyText" TEXT,
    "nextMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "igUserId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "messageType" "MessageType" NOT NULL,
    "text" TEXT,
    "igMessageId" TEXT,
    "quickReplyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationMessage_automationId_idx" ON "AutomationMessage"("automationId");

-- CreateIndex
CREATE INDEX "AutomationMessage_automationId_order_idx" ON "AutomationMessage"("automationId", "order");

-- CreateIndex
CREATE INDEX "QuickReply_automationMessageId_idx" ON "QuickReply"("automationMessageId");

-- CreateIndex
CREATE INDEX "QuickReply_nextMessageId_idx" ON "QuickReply"("nextMessageId");

-- CreateIndex
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- CreateIndex
CREATE INDEX "Conversation_instagramAccountId_idx" ON "Conversation"("instagramAccountId");

-- CreateIndex
CREATE INDEX "Conversation_instagramAccountId_lastMessageAt_idx" ON "Conversation"("instagramAccountId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_instagramAccountId_participantId_key" ON "Conversation"("instagramAccountId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMessage_igMessageId_key" ON "ConversationMessage"("igMessageId");

-- CreateIndex
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationMessage_quickReplyId_idx" ON "ConversationMessage"("quickReplyId");

-- CreateIndex
CREATE INDEX "InstagramAccount_userId_idx" ON "InstagramAccount"("userId");

-- AddForeignKey
ALTER TABLE "AutomationMessage" ADD CONSTRAINT "AutomationMessage_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickReply" ADD CONSTRAINT "QuickReply_automationMessageId_fkey" FOREIGN KEY ("automationMessageId") REFERENCES "AutomationMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickReply" ADD CONSTRAINT "QuickReply_nextMessageId_fkey" FOREIGN KEY ("nextMessageId") REFERENCES "AutomationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_quickReplyId_fkey" FOREIGN KEY ("quickReplyId") REFERENCES "QuickReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;
