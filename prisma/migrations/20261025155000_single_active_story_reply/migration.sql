-- Keep all replies; only the newest enabled story reply per account stays active.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "instagramAccountId"
    ORDER BY "updatedAt" DESC, "createdAt" DESC, id DESC
  ) AS ord
  FROM "Automation"
  WHERE "triggerType" = 'STORY_REPLY_KEYWORD' AND "isActive" = TRUE
)
UPDATE "Automation" AS a SET "isActive" = FALSE
FROM ranked WHERE a.id = ranked.id AND ranked.ord > 1;
