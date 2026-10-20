-- Smart reminders: durable configuration and delivery records.
CREATE TABLE "SmartReminderRule" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "instagramAccountId" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "delayMinutes" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartReminderRule_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SmartReminderDelivery" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "anchorMessageId" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "queueJobId" TEXT,
  "igMessageId" TEXT,
  "sentAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartReminderDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SmartReminderRule_automationId_key" ON "SmartReminderRule"("automationId");
CREATE INDEX "SmartReminderRule_instagramAccountId_isActive_idx" ON "SmartReminderRule"("instagramAccountId","isActive");
CREATE INDEX "SmartReminderRule_userId_idx" ON "SmartReminderRule"("userId");
CREATE UNIQUE INDEX "SmartReminderDelivery_ruleId_anchorMessageId_key" ON "SmartReminderDelivery"("ruleId","anchorMessageId");
CREATE INDEX "SmartReminderDelivery_status_dueAt_idx" ON "SmartReminderDelivery"("status","dueAt");
CREATE INDEX "SmartReminderDelivery_conversationId_status_idx" ON "SmartReminderDelivery"("conversationId","status");
ALTER TABLE "SmartReminderRule" ADD CONSTRAINT "SmartReminderRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartReminderRule" ADD CONSTRAINT "SmartReminderRule_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartReminderRule" ADD CONSTRAINT "SmartReminderRule_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartReminderDelivery" ADD CONSTRAINT "SmartReminderDelivery_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "SmartReminderRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartReminderDelivery" ADD CONSTRAINT "SmartReminderDelivery_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
