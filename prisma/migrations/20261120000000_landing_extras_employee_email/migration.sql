-- Landing page extras (video, pick-count nudge, pickup notifications) and optional employee email.
ALTER TABLE "Employee" ADD COLUMN "email" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "videoUrl" TEXT,
                       ADD COLUMN "showPickCount" BOOLEAN NOT NULL DEFAULT true,
                       ADD COLUMN "notifyEmployeesOnReceived" BOOLEAN NOT NULL DEFAULT false;
