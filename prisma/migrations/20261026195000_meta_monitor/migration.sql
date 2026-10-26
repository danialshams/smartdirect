CREATE TABLE "MetaMonitorNotice" (
 "id" TEXT NOT NULL,
 "fingerprint" TEXT NOT NULL,
 "sourceId" TEXT NOT NULL,
 "sourceUrl" TEXT NOT NULL,
 "originalTitle" TEXT NOT NULL,
 "titleFa" TEXT NOT NULL,
 "summaryFa" TEXT NOT NULL,
 "category" TEXT NOT NULL,
 "kind" TEXT NOT NULL,
 "apiVersion" TEXT,
 "publishedAt" TIMESTAMP(3),
 "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "isRead" BOOLEAN NOT NULL DEFAULT false,
 "readAt" TIMESTAMP(3),
 CONSTRAINT "MetaMonitorNotice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MetaMonitorNotice_fingerprint_key" ON "MetaMonitorNotice"("fingerprint");
CREATE INDEX "MetaMonitorNotice_isRead_detectedAt_idx" ON "MetaMonitorNotice"("isRead","detectedAt");
CREATE INDEX "MetaMonitorNotice_category_detectedAt_idx" ON "MetaMonitorNotice"("category","detectedAt");

CREATE TABLE "MetaMonitorSource" (
 "id" TEXT NOT NULL,
 "label" TEXT NOT NULL,
 "url" TEXT NOT NULL,
 "initializedAt" TIMESTAMP(3),
 "lastCheckedAt" TIMESTAMP(3),
 "lastSuccessAt" TIMESTAMP(3),
 "lastError" TEXT,
 "lastItemCount" INTEGER NOT NULL DEFAULT 0,
 CONSTRAINT "MetaMonitorSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetaMonitorRun" (
 "id" TEXT NOT NULL,
 "lastCheckedAt" TIMESTAMP(3),
 "lastSuccessAt" TIMESTAMP(3),
 "lockedUntil" TIMESTAMP(3),
 "lastError" TEXT,
 CONSTRAINT "MetaMonitorRun_pkey" PRIMARY KEY ("id")
);
