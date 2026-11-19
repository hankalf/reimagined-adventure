-- Price history per gift (catalog edits, imports, and HR corrections at order time).
CREATE TABLE "ItemPriceHistory" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "campaignId" TEXT,
    "oldPrice" DECIMAL(12,2),
    "newPrice" DECIMAL(12,2) NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "changedById" TEXT,
    "changedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ItemPriceHistory_itemId_createdAt_idx" ON "ItemPriceHistory"("itemId", "createdAt");

ALTER TABLE "ItemPriceHistory" ADD CONSTRAINT "ItemPriceHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
