-- Several mascots per campaign, each with its own placements (home page, thank-you page, poster).
CREATE TABLE "CampaignMascot" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'elf',
    "imageId" TEXT,
    "caption" TEXT,
    "captionEs" TEXT,
    "faceZoom" INTEGER NOT NULL DEFAULT 100,
    "faceOffsetX" INTEGER NOT NULL DEFAULT 0,
    "faceOffsetY" INTEGER NOT NULL DEFAULT 0,
    "faceRotate" INTEGER NOT NULL DEFAULT 0,
    "faceFlip" BOOLEAN NOT NULL DEFAULT false,
    "showOnLanding" BOOLEAN NOT NULL DEFAULT true,
    "showOnDone" BOOLEAN NOT NULL DEFAULT false,
    "showOnPoster" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignMascot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CampaignMascot_campaignId_sortOrder_idx" ON "CampaignMascot"("campaignId", "sortOrder");

ALTER TABLE "CampaignMascot" ADD CONSTRAINT "CampaignMascot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry over each campaign's existing single mascot (home page + poster, thank-you page as before).
INSERT INTO "CampaignMascot" ("id", "campaignId", "kind", "imageId", "caption", "captionEs", "faceZoom", "faceOffsetX", "faceOffsetY", "faceRotate", "faceFlip", "showOnLanding", "showOnDone", "showOnPoster", "sortOrder")
SELECT 'cm' || replace(gen_random_uuid()::text, '-', ''), "id", "mascotKind", "mascotImageId", "mascotCaption", "mascotCaptionEs",
       "mascotFaceZoom", "mascotFaceOffsetX", "mascotFaceOffsetY", "mascotFaceRotate", "mascotFaceFlip", true, "mascotShowOnDone", true, 0
FROM "Campaign"
WHERE "mascotEnabled" = true OR "mascotImageId" IS NOT NULL OR "mascotCaption" IS NOT NULL;

ALTER TABLE "Campaign" DROP COLUMN "mascotKind",
                       DROP COLUMN "mascotImageId",
                       DROP COLUMN "mascotCaption",
                       DROP COLUMN "mascotCaptionEs",
                       DROP COLUMN "mascotShowOnDone",
                       DROP COLUMN "mascotFaceZoom",
                       DROP COLUMN "mascotFaceOffsetX",
                       DROP COLUMN "mascotFaceOffsetY",
                       DROP COLUMN "mascotFaceRotate",
                       DROP COLUMN "mascotFaceFlip";
