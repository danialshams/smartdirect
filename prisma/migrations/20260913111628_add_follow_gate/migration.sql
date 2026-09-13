-- CreateEnum
CREATE TYPE "FollowGateStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Automation" ADD COLUMN     "followGateText" TEXT,
ADD COLUMN     "requireFollow" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PendingFollowGate" (
    "id" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "status" "FollowGateStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingFollowGate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingFollowGate_instagramAccountId_participantId_status_idx" ON "PendingFollowGate"("instagramAccountId", "participantId", "status");

-- CreateIndex
CREATE INDEX "PendingFollowGate_automationId_idx" ON "PendingFollowGate"("automationId");

-- CreateIndex
CREATE INDEX "PendingFollowGate_expiresAt_idx" ON "PendingFollowGate"("expiresAt");

-- AddForeignKey
ALTER TABLE "PendingFollowGate" ADD CONSTRAINT "PendingFollowGate_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingFollowGate" ADD CONSTRAINT "PendingFollowGate_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
