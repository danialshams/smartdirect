ALTER TABLE "Ticket" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "TicketMessage" ADD COLUMN "readAt" TIMESTAMP(3);
-- Do not surface historic conversations as newly-arrived notifications.
UPDATE "TicketMessage" SET "readAt" = "createdAt"
WHERE "senderUserId" <> (SELECT "userId" FROM "Ticket" WHERE "Ticket"."id" = "TicketMessage"."ticketId");
CREATE INDEX "TicketMessage_ticketId_readAt_idx" ON "TicketMessage"("ticketId", "readAt");
CREATE TABLE "TicketAttachment" (
  "id" TEXT NOT NULL,
  "ticketMessageId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "bytes" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TicketAttachment_ticketMessageId_idx" ON "TicketAttachment"("ticketMessageId");
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticketMessageId_fkey" FOREIGN KEY ("ticketMessageId") REFERENCES "TicketMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;