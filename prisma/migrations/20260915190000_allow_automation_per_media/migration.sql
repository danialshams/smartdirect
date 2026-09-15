DROP INDEX IF EXISTS "Automation_instagramAccountId_keyword_key";

CREATE UNIQUE INDEX "Automation_instagramAccountId_keyword_mediaId_key"
  ON "Automation"("instagramAccountId", "keyword", "mediaId");
