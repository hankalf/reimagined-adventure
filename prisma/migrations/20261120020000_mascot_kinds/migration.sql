-- More mascots (Santa, snowman, reindeer, gingerbread, dancing fruit) and extra face controls.
ALTER TABLE "Campaign" ADD COLUMN "mascotKind" TEXT NOT NULL DEFAULT 'elf',
                       ADD COLUMN "mascotFaceOffsetX" INTEGER NOT NULL DEFAULT 0,
                       ADD COLUMN "mascotFaceRotate" INTEGER NOT NULL DEFAULT 0,
                       ADD COLUMN "mascotFaceFlip" BOOLEAN NOT NULL DEFAULT false;
