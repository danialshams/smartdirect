CREATE TABLE "WebhookInboxEvent" (
  "id" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "instagramAccountId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "queueJobId" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseUntil" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "WebhookInboxEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WebhookInboxEvent_eventKey_key" ON "WebhookInboxEvent"("eventKey");
CREATE INDEX "WebhookInboxEvent_status_nextAttemptAt_idx" ON "WebhookInboxEvent"("status","nextAttemptAt");
CREATE INDEX "WebhookInboxEvent_instagramAccountId_createdAt_idx" ON "WebhookInboxEvent"("instagramAccountId","createdAt");
ALTER TABLE "WebhookInboxEvent" ADD CONSTRAINT "WebhookInboxEvent_instagramAccountId_fkey"
FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
