-- Employee page look: background pattern/gradient/image, text contrast, font and card style.
ALTER TABLE "Campaign" ADD COLUMN "bgPattern" TEXT NOT NULL DEFAULT 'none',
                       ADD COLUMN "bgColor" TEXT NOT NULL DEFAULT '#f8fafc',
                       ADD COLUMN "bgColor2" TEXT NOT NULL DEFAULT '#e2e8f0',
                       ADD COLUMN "bgImageId" TEXT,
                       ADD COLUMN "bgOverlay" INTEGER NOT NULL DEFAULT 35,
                       ADD COLUMN "textMode" TEXT NOT NULL DEFAULT 'auto',
                       ADD COLUMN "fontStyle" TEXT NOT NULL DEFAULT 'modern',
                       ADD COLUMN "cardStyle" TEXT NOT NULL DEFAULT 'solid';
