-- CreateEnum
CREATE TYPE "InstagramPublishType" AS ENUM ('POST', 'CAROUSEL', 'REEL');

-- CreateEnum
CREATE TYPE "InstagramPublishStatus" AS ENUM ('DRAFT', 'UPLOADING', 'SCHEDULED', 'PROCESSING', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InstagramMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateTable
CREATE TABLE "InstagramPublishJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "type" "InstagramPublishType" NOT NULL,
    "status" "InstagramPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "caption" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "instagramContainerId" TEXT,
    "instagramMediaId" TEXT,
    "errorMessage" TEXT,
    "idempotencyKey" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramPublishJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramPublishMedia" (
    "id" TEXT NOT NULL,
    "publishJobId" TEXT NOT NULL,
    "type" "InstagramMediaType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramPublishMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstagramPublishJob_idempotencyKey_key" ON "InstagramPublishJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "InstagramPublishJob_userId_idx" ON "InstagramPublishJob"("userId");

-- CreateIndex
CREATE INDEX "InstagramPublishJob_instagramAccountId_idx" ON "InstagramPublishJob"("instagramAccountId");

-- CreateIndex
CREATE INDEX "InstagramPublishJob_status_idx" ON "InstagramPublishJob"("status");

-- CreateIndex
CREATE INDEX "InstagramPublishJob_scheduledAt_idx" ON "InstagramPublishJob"("scheduledAt");

-- CreateIndex
CREATE INDEX "InstagramPublishJob_instagramAccountId_status_idx" ON "InstagramPublishJob"("instagramAccountId", "status");

-- CreateIndex
CREATE INDEX "InstagramPublishJob_status_scheduledAt_idx" ON "InstagramPublishJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "InstagramPublishMedia_publishJobId_idx" ON "InstagramPublishMedia"("publishJobId");

-- CreateIndex
CREATE INDEX "InstagramPublishMedia_publishJobId_sortOrder_idx" ON "InstagramPublishMedia"("publishJobId", "sortOrder");

-- AddForeignKey
ALTER TABLE "InstagramPublishJob" ADD CONSTRAINT "InstagramPublishJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramPublishJob" ADD CONSTRAINT "InstagramPublishJob_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramPublishMedia" ADD CONSTRAINT "InstagramPublishMedia_publishJobId_fkey" FOREIGN KEY ("publishJobId") REFERENCES "InstagramPublishJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
