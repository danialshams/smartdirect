-- AlterTable
ALTER TABLE "Automation" ADD COLUMN     "likeIncomingDm" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sendDm" BOOLEAN NOT NULL DEFAULT false;
