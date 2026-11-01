CREATE TABLE "AdminMfa" (
 "userId" TEXT NOT NULL,
 "encryptedSecret" TEXT NOT NULL,
 "enabledAt" TIMESTAMP(3),
 "pendingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "failedAttempts" INTEGER NOT NULL DEFAULT 0,
 "lastFailedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "AdminMfa_pkey" PRIMARY KEY("userId")
);
CREATE TABLE "AdminRecoveryCode" (
 "id" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "codeHash" VARCHAR(64) NOT NULL,
 "usedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AdminRecoveryCode_pkey" PRIMARY KEY("id")
);
CREATE INDEX "AdminRecoveryCode_userId_usedAt_idx" ON "AdminRecoveryCode"("userId","usedAt");
ALTER TABLE "AdminMfa" ADD CONSTRAINT "AdminMfa_userId_fkey" FOREIGN KEY("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminRecoveryCode" ADD CONSTRAINT "AdminRecoveryCode_userId_fkey" FOREIGN KEY("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
