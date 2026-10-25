-- Legacy scheduled story replies were marked active while using a pending
-- marker. Keep them dormant until their associated publish succeeds.
UPDATE "Automation"
SET "isActive" = FALSE
WHERE "triggerType" = 'STORY_REPLY_KEYWORD'
  AND "isActive" = TRUE
  AND "mediaId" LIKE 'pending:%';

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
