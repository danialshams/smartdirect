CREATE TABLE IF NOT EXISTS "PublicFormSubmissionAttempt" (
  "id" TEXT NOT NULL,
  "ipHash" VARCHAR(64) NOT NULL,
  "formId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicFormSubmissionAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PublicFormSubmissionAttempt_ipHash_createdAt_idx" ON "PublicFormSubmissionAttempt"("ipHash","createdAt");
CREATE INDEX IF NOT EXISTS "PublicFormSubmissionAttempt_formId_createdAt_idx" ON "PublicFormSubmissionAttempt"("formId","createdAt");