-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'HR');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('PRODUCT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CampaignItemStatus" AS ENUM ('AVAILABLE', 'OUT_OF_STOCK');

-- CreateEnum
CREATE TYPE "SelectionStatus" AS ENUM ('SELECTED', 'NEEDS_REPICK', 'ORDERED', 'RECEIVED', 'COLLECTED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED', 'LOGGED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('ADMIN', 'EMPLOYEE', 'SYSTEM');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "inviteToken" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "department" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "requireLastName" BOOLEAN NOT NULL DEFAULT true,
    "allEmployeesEligible" BOOLEAN NOT NULL DEFAULT true,
    "allowChangeUntilOrdered" BOOLEAN NOT NULL DEFAULT true,
    "showSoldOutItems" BOOLEAN NOT NULL DEFAULT true,
    "hrEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "welcomeHeadline" TEXT NOT NULL DEFAULT 'Choose your gift',
    "welcomeHeadlineEs" TEXT,
    "welcomeMessage" TEXT NOT NULL DEFAULT '',
    "welcomeMessageEs" TEXT,
    "pickupInstructions" TEXT NOT NULL DEFAULT '',
    "pickupInstructionsEs" TEXT,
    "leadershipMessage" TEXT,
    "leadershipMessageEs" TEXT,
    "leadershipName" TEXT,
    "logoImageId" TEXT,
    "heroImageId" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1d4ed8',
    "accentColor" TEXT NOT NULL DEFAULT '#f59e0b',
    "companyName" TEXT,
    "totalBudget" DECIMAL(12,2),
    "defaultEmployeeBudget" DECIMAL(12,2),
    "hideItemsOverBudget" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "feedToken" TEXT NOT NULL,
    "digestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastHrEmailAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignEmployee" (
    "campaignId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "budgetOverride" DECIMAL(12,2),

    CONSTRAINT "CampaignEmployee_pkey" PRIMARY KEY ("campaignId","employeeId")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "type" "ItemType" NOT NULL DEFAULT 'PRODUCT',
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "descriptionEs" TEXT,
    "category" TEXT,
    "imageId" TEXT,
    "imageUrl" TEXT,
    "productUrl" TEXT,
    "asin" TEXT,
    "sku" TEXT,
    "unitCost" DECIMAL(12,2),
    "fulfillmentNote" TEXT,
    "optionLabel" TEXT,
    "optionValues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignItem" (
    "campaignId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "CampaignItemStatus" NOT NULL DEFAULT 'AVAILABLE',
    "stockLimit" INTEGER,
    "unitCostOverride" DECIMAL(12,2),

    CONSTRAINT "CampaignItem_pkey" PRIMARY KEY ("campaignId","itemId")
);

-- CreateTable
CREATE TABLE "Selection" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "optionValue" TEXT,
    "confirmationCode" TEXT NOT NULL,
    "costAtSelection" DECIMAL(12,2),
    "status" "SelectionStatus" NOT NULL DEFAULT 'SELECTED',
    "language" TEXT NOT NULL DEFAULT 'en',
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Selection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "thumb" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "to" TEXT[],
    "subject" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "error" TEXT,
    "body" TEXT NOT NULL,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_inviteToken_key" ON "AdminUser"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_feedToken_key" ON "Campaign"("feedToken");

-- CreateIndex
CREATE UNIQUE INDEX "Selection_confirmationCode_key" ON "Selection"("confirmationCode");

-- CreateIndex
CREATE INDEX "Selection_campaignId_status_idx" ON "Selection"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Selection_campaignId_itemId_idx" ON "Selection"("campaignId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Selection_campaignId_employeeId_key" ON "Selection"("campaignId", "employeeId");

-- CreateIndex
CREATE INDEX "EmailLog_campaignId_sentAt_idx" ON "EmailLog"("campaignId", "sentAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "CampaignEmployee" ADD CONSTRAINT "CampaignEmployee_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEmployee" ADD CONSTRAINT "CampaignEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignItem" ADD CONSTRAINT "CampaignItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignItem" ADD CONSTRAINT "CampaignItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
