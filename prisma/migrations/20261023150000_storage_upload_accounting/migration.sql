-- Track reserved storage bytes even when direct uploads have not finalized.
-- Existing rows have unknown size; reconciliation must populate legacy sizes.
ALTER TABLE "InstagramStorageObject"
  ADD COLUMN "fileSize" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'UNKNOWN';
CREATE INDEX "InstagramStorageObject_userId_deletedAt_idx"
  ON "InstagramStorageObject" ("userId", "deletedAt");
