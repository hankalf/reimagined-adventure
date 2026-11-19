-- Holiday mascot: a dancing elf wearing an uploaded face photo.
ALTER TABLE "Campaign" ADD COLUMN "mascotEnabled" BOOLEAN NOT NULL DEFAULT false,
                       ADD COLUMN "mascotImageId" TEXT,
                       ADD COLUMN "mascotCaption" TEXT,
                       ADD COLUMN "mascotCaptionEs" TEXT,
                       ADD COLUMN "mascotShowOnDone" BOOLEAN NOT NULL DEFAULT true,
                       ADD COLUMN "mascotFaceZoom" INTEGER NOT NULL DEFAULT 100,
                       ADD COLUMN "mascotFaceOffsetY" INTEGER NOT NULL DEFAULT 0;
