CREATE TABLE "FreeTrialClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "igUserId" TEXT NOT NULL,
    "igUsername" TEXT,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FreeTrialClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FreeTrialClaim_userId_key" ON "FreeTrialClaim"("userId");
CREATE UNIQUE INDEX "FreeTrialClaim_igUserId_key" ON "FreeTrialClaim"("igUserId");
