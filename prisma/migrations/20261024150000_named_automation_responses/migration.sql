-- Existing automations keep their current behavior and can be named later.
ALTER TABLE "Automation" ADD COLUMN "title" VARCHAR(80);
