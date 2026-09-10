-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "replyText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Automation_instagramAccountId_idx" ON "Automation"("instagramAccountId");

-- CreateIndex
CREATE INDEX "Automation_instagramAccountId_keyword_idx" ON "Automation"("instagramAccountId", "keyword");

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
