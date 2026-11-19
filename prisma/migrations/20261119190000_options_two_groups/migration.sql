-- Rename the single option group to "group 1" and add "group 2" (existing data is preserved).
ALTER TABLE "Item" RENAME COLUMN "optionLabel" TO "option1Label";
ALTER TABLE "Item" RENAME COLUMN "optionValues" TO "option1Values";
ALTER TABLE "Item" ADD COLUMN "option2Label" TEXT,
                   ADD COLUMN "option2Values" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Per-campaign subset of offered option values (empty = all catalog values).
ALTER TABLE "CampaignItem" ADD COLUMN "enabledOption1Values" TEXT[] DEFAULT ARRAY[]::TEXT[],
                           ADD COLUMN "enabledOption2Values" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Selections store one value per group.
ALTER TABLE "Selection" RENAME COLUMN "optionValue" TO "option1Value";
ALTER TABLE "Selection" ADD COLUMN "option2Value" TEXT;
