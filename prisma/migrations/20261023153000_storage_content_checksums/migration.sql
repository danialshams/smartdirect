ALTER TABLE "InstagramStorageObject" ADD COLUMN "checksum" TEXT;
CREATE INDEX "InstagramStorageObject_userId_checksum_deletedAt_idx" ON "InstagramStorageObject" ("userId", "checksum", "deletedAt");
