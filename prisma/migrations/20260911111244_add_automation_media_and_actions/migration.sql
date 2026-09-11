-- AlterTable
ALTER TABLE "Automation" ADD COLUMN     "likeComment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mediaId" TEXT,
ALTER COLUMN "replyText" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Automation_mediaId_idx" ON "Automation"("mediaId");
