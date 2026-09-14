CREATE TABLE "ConversationHandoff" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assignedToUserId" TEXT,
    "handedOffAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handedBackAt" TIMESTAMP(3),

    CONSTRAINT "ConversationHandoff_pkey" PRIMARY KEY ("conversationId"),
    CONSTRAINT "ConversationHandoff_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationHandoff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationHandoff_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ConversationHandoff_userId_active_idx" ON "ConversationHandoff"("userId", "active");
CREATE INDEX "ConversationHandoff_active_idx" ON "ConversationHandoff"("active");
