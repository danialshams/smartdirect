-- Add independent storage lifecycle tracking and media expiry metadata.
ALTER TABLE "InstagramPublishMedia" ADD COLUMN "expiresAt" TIMESTAMP(3);

UPDATE "InstagramPublishMedia"
SET "expiresAt" = "createdAt" + INTERVAL '72 hours'
WHERE "expiresAt" IS NULL;

ALTER TABLE "InstagramPublishMedia" ALTER COLUMN "expiresAt" SET NOT NULL;

CREATE INDEX "InstagramPublishMedia_expiresAt_deletedAt_idx"
ON "InstagramPublishMedia"("expiresAt", "deletedAt");

CREATE TABLE "InstagramStorageObject" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InstagramStorageObject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstagramStorageObject_storageKey_key"
ON "InstagramStorageObject"("storageKey");

CREATE INDEX "InstagramStorageObject_userId_expiresAt_idx"
ON "InstagramStorageObject"("userId", "expiresAt");

CREATE INDEX "InstagramStorageObject_expiresAt_deletedAt_idx"
ON "InstagramStorageObject"("expiresAt", "deletedAt");

ALTER TABLE "InstagramStorageObject"
ADD CONSTRAINT "InstagramStorageObject_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
