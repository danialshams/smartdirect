-- CreateEnum
CREATE TYPE "QueueFailureStatus" AS ENUM ('FAILED', 'REQUEUED', 'RESOLVED');

-- CreateTable
CREATE TABLE "QueueFailure" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "requeuedJobId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "priority" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "maxAttempts" INTEGER NOT NULL,
    "lastError" TEXT NOT NULL,
    "tenantId" TEXT,
    "idempotencyKey" TEXT,
    "idempotencyTenantId" TEXT,
    "idempotencyOperation" TEXT,
    "idempotencyResourceId" TEXT,
    "status" "QueueFailureStatus" NOT NULL DEFAULT 'FAILED',
    "failedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requeuedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QueueFailure_jobId_key" ON "QueueFailure"("jobId");
CREATE UNIQUE INDEX "QueueFailure_requeuedJobId_key" ON "QueueFailure"("requeuedJobId");
CREATE INDEX "QueueFailure_status_failedAt_idx" ON "QueueFailure"("status", "failedAt");
CREATE INDEX "QueueFailure_tenantId_status_idx" ON "QueueFailure"("tenantId", "status");
CREATE INDEX "QueueFailure_type_status_idx" ON "QueueFailure"("type", "status");
