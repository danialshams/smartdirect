-- Preserve existing accounts and their InstagramAccount relations.
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

CREATE TABLE "AuthSignupAttempt" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthSignupAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuthSignupAttempt_ipHash_createdAt_idx" ON "AuthSignupAttempt"("ipHash", "createdAt");

CREATE TABLE "AuthSmsChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" VARCHAR(16) NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    CONSTRAINT "AuthSmsChallenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuthSmsChallenge_phone_purpose_createdAt_idx" ON "AuthSmsChallenge"("phone", "purpose", "createdAt");
CREATE INDEX "AuthSmsChallenge_ipHash_createdAt_idx" ON "AuthSmsChallenge"("ipHash", "createdAt");
CREATE INDEX "AuthSmsChallenge_expiresAt_idx" ON "AuthSmsChallenge"("expiresAt");
ALTER TABLE "AuthSmsChallenge"
  ADD CONSTRAINT "AuthSmsChallenge_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
