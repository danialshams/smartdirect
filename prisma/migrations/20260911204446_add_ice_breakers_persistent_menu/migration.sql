-- CreateTable
CREATE TABLE "IceBreaker" (
    "id" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IceBreaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersistentMenu" (
    "id" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersistentMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersistentMenuItem" (
    "id" TEXT NOT NULL,
    "persistentMenuId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "automationId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersistentMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IceBreaker_instagramAccountId_idx" ON "IceBreaker"("instagramAccountId");

-- CreateIndex
CREATE INDEX "IceBreaker_automationId_idx" ON "IceBreaker"("automationId");

-- CreateIndex
CREATE INDEX "IceBreaker_instagramAccountId_order_idx" ON "IceBreaker"("instagramAccountId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "IceBreaker_instagramAccountId_payload_key" ON "IceBreaker"("instagramAccountId", "payload");

-- CreateIndex
CREATE UNIQUE INDEX "PersistentMenu_instagramAccountId_key" ON "PersistentMenu"("instagramAccountId");

-- CreateIndex
CREATE INDEX "PersistentMenuItem_persistentMenuId_idx" ON "PersistentMenuItem"("persistentMenuId");

-- CreateIndex
CREATE INDEX "PersistentMenuItem_automationId_idx" ON "PersistentMenuItem"("automationId");

-- AddForeignKey
ALTER TABLE "IceBreaker" ADD CONSTRAINT "IceBreaker_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IceBreaker" ADD CONSTRAINT "IceBreaker_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersistentMenu" ADD CONSTRAINT "PersistentMenu_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersistentMenuItem" ADD CONSTRAINT "PersistentMenuItem_persistentMenuId_fkey" FOREIGN KEY ("persistentMenuId") REFERENCES "PersistentMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersistentMenuItem" ADD CONSTRAINT "PersistentMenuItem_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
