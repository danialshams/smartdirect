ALTER TABLE "InstagramStorageObject"
ADD COLUMN "publicUrl" TEXT;

CREATE INDEX "InstagramStorageObject_userId_publicUrl_idx"
ON "InstagramStorageObject"("userId", "publicUrl");
