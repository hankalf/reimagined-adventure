-- Gift-change window: employees may change their pick for N hours after their first choice (default 4).
ALTER TABLE "Campaign" ADD COLUMN "changeWindowHours" INTEGER DEFAULT 4;

-- When each employee first picked. Existing picks: the earliest "selection.created" audit entry, else the latest pick time.
ALTER TABLE "Selection" ADD COLUMN "firstSelectedAt" TIMESTAMP(3);
UPDATE "Selection" s
SET "firstSelectedAt" = LEAST(
  s."selectedAt",
  (SELECT MIN(a."createdAt") FROM "AuditLog" a WHERE a."entityType" = 'Selection' AND a."entityId" = s."id" AND a."action" = 'selection.created')
);
ALTER TABLE "Selection" ALTER COLUMN "firstSelectedAt" SET NOT NULL;
ALTER TABLE "Selection" ALTER COLUMN "firstSelectedAt" SET DEFAULT CURRENT_TIMESTAMP;
