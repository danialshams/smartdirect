-- Preserve historic automation messages while recording explicitly reused response templates.
ALTER TABLE "AutomationMessage" ADD COLUMN "savedResponseId" TEXT;
CREATE INDEX "AutomationMessage_savedResponseId_idx" ON "AutomationMessage"("savedResponseId");
ALTER TABLE "AutomationMessage" ADD CONSTRAINT "AutomationMessage_savedResponseId_fkey" FOREIGN KEY ("savedResponseId") REFERENCES "SavedAutomationResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
