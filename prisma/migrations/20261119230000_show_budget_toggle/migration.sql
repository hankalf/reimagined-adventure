-- Employees never see item prices; this toggle controls whether their own budget amount is shown.
ALTER TABLE "Campaign" ADD COLUMN "showBudgetToEmployees" BOOLEAN NOT NULL DEFAULT false;
