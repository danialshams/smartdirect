/*
  Warnings:

  - A unique constraint covering the columns `[instagramAccountId,keyword]` on the table `Automation` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Automation_instagramAccountId_keyword_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Automation_instagramAccountId_keyword_key" ON "Automation"("instagramAccountId", "keyword");
