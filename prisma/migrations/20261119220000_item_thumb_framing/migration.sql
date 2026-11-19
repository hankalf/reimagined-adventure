-- Per-gift thumbnail framing so every card in the catalog is the same size and photos fit the frame.
ALTER TABLE "Item" ADD COLUMN "thumbFit" TEXT NOT NULL DEFAULT 'contain',
                   ADD COLUMN "thumbZoom" INTEGER NOT NULL DEFAULT 100,
                   ADD COLUMN "thumbFocusX" INTEGER NOT NULL DEFAULT 50,
                   ADD COLUMN "thumbFocusY" INTEGER NOT NULL DEFAULT 50;
