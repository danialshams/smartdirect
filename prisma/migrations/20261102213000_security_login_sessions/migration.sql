ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS "AuthPasswordAttempt" (
  "id" TEXT NOT NULL,
  "identifierHash" VARCHAR(64) NOT NULL,
  "ipHash" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthPasswordAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AuthPasswordAttempt_identifierHash_createdAt_idx" ON "AuthPasswordAttempt"("identifierHash","createdAt");

CREATE INDEX IF NOT EXISTS "AuthPasswordAttempt_ipHash_createdAt_idx" ON "AuthPasswordAttempt"("ipHash","createdAt");
