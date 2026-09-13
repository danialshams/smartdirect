-- CreateTable
CREATE TABLE "InstagramInsightSnapshot" (
    "id" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "reach" INTEGER,
    "views" INTEGER,
    "accountsEngaged" INTEGER,
    "totalInteractions" INTEGER,
    "profileViews" INTEGER,
    "followerCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramInsightSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstagramInsightSnapshot_instagramAccountId_idx" ON "InstagramInsightSnapshot"("instagramAccountId");

-- CreateIndex
CREATE INDEX "InstagramInsightSnapshot_instagramAccountId_snapshotDate_idx" ON "InstagramInsightSnapshot"("instagramAccountId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramInsightSnapshot_instagramAccountId_snapshotDate_key" ON "InstagramInsightSnapshot"("instagramAccountId", "snapshotDate");

-- AddForeignKey
ALTER TABLE "InstagramInsightSnapshot" ADD CONSTRAINT "InstagramInsightSnapshot_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
