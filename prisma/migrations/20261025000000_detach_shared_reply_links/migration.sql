-- Previous responses are now independent copies. Preserve content and templates, but remove live links.
UPDATE "AutomationMessage" SET "savedResponseId" = NULL WHERE "savedResponseId" IS NOT NULL;
