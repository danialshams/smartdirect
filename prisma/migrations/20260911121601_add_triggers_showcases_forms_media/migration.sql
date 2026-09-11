-- CreateEnum
CREATE TYPE "AutomationTriggerType" AS ENUM ('COMMENT_KEYWORD', 'DM', 'STORY_REPLY_KEYWORD');

-- CreateEnum
CREATE TYPE "AutomationMessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'SHOWCASE', 'FORM');

-- CreateEnum
CREATE TYPE "FormFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'PHONE', 'EMAIL', 'NUMBER', 'SELECT', 'RADIO', 'CHECKBOX');

-- DropIndex
DROP INDEX "Automation_instagramAccountId_keyword_key";

-- AlterTable
ALTER TABLE "Automation" ADD COLUMN     "triggerType" "AutomationTriggerType" NOT NULL DEFAULT 'COMMENT_KEYWORD',
ALTER COLUMN "keyword" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AutomationMessage" ADD COLUMN     "formId" TEXT,
ADD COLUMN     "mediaId" TEXT,
ADD COLUMN     "mediaUrl" TEXT,
ADD COLUMN     "messageType" "AutomationMessageType" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "showcaseId" TEXT,
ALTER COLUMN "text" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ConversationMessage" ADD COLUMN     "mediaId" TEXT,
ADD COLUMN     "mediaUrl" TEXT;

-- CreateTable
CREATE TABLE "Showcase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Showcase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowcaseItem" (
    "id" TEXT NOT NULL,
    "showcaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "price" DECIMAL(65,30),
    "originalPrice" DECIMAL(65,30),
    "linkUrl" TEXT,
    "buttonText" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowcaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormField" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FormFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "placeholder" TEXT,
    "options" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "igUserId" TEXT,
    "username" TEXT,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Showcase_userId_idx" ON "Showcase"("userId");

-- CreateIndex
CREATE INDEX "Showcase_instagramAccountId_idx" ON "Showcase"("instagramAccountId");

-- CreateIndex
CREATE INDEX "ShowcaseItem_showcaseId_idx" ON "ShowcaseItem"("showcaseId");

-- CreateIndex
CREATE INDEX "ShowcaseItem_showcaseId_order_idx" ON "ShowcaseItem"("showcaseId", "order");

-- CreateIndex
CREATE INDEX "Form_userId_idx" ON "Form"("userId");

-- CreateIndex
CREATE INDEX "Form_instagramAccountId_idx" ON "Form"("instagramAccountId");

-- CreateIndex
CREATE INDEX "FormField_formId_idx" ON "FormField"("formId");

-- CreateIndex
CREATE INDEX "FormField_formId_order_idx" ON "FormField"("formId", "order");

-- CreateIndex
CREATE INDEX "FormSubmission_formId_idx" ON "FormSubmission"("formId");

-- CreateIndex
CREATE INDEX "FormSubmission_igUserId_idx" ON "FormSubmission"("igUserId");

-- CreateIndex
CREATE INDEX "Automation_instagramAccountId_triggerType_idx" ON "Automation"("instagramAccountId", "triggerType");

-- CreateIndex
CREATE INDEX "Automation_instagramAccountId_keyword_idx" ON "Automation"("instagramAccountId", "keyword");

-- CreateIndex
CREATE INDEX "AutomationMessage_showcaseId_idx" ON "AutomationMessage"("showcaseId");

-- CreateIndex
CREATE INDEX "AutomationMessage_formId_idx" ON "AutomationMessage"("formId");

-- CreateIndex
CREATE INDEX "QuickReply_payload_idx" ON "QuickReply"("payload");

-- AddForeignKey
ALTER TABLE "AutomationMessage" ADD CONSTRAINT "AutomationMessage_showcaseId_fkey" FOREIGN KEY ("showcaseId") REFERENCES "Showcase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationMessage" ADD CONSTRAINT "AutomationMessage_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showcase" ADD CONSTRAINT "Showcase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showcase" ADD CONSTRAINT "Showcase_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowcaseItem" ADD CONSTRAINT "ShowcaseItem_showcaseId_fkey" FOREIGN KEY ("showcaseId") REFERENCES "Showcase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
