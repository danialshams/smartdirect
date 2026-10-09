ALTER TABLE "InstagramStorageObject"
ADD COLUMN "publicUrl" TEXT;

-- Recover URLs for legacy publishing objects where the publish-media row
-- already stores the same storage key and public URL.
UPDATE "InstagramStorageObject" AS storage
SET "publicUrl" = media."publicUrl"
FROM "InstagramPublishMedia" AS media
WHERE storage."storageKey" = media."storageKey"
  AND media."publicUrl" IS NOT NULL
  AND storage."publicUrl" IS NULL;

CREATE INDEX "InstagramStorageObject_userId_publicUrl_idx"
ON "InstagramStorageObject"("userId", "publicUrl");
