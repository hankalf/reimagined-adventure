-- Admins log in with a username; email becomes optional. Existing users keep logging in with their email.
ALTER TABLE "AdminUser" ADD COLUMN "username" TEXT,
                        ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
UPDATE "AdminUser" SET "username" = lower("email") WHERE "username" IS NULL;
ALTER TABLE "AdminUser" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "AdminUser" ALTER COLUMN "email" DROP NOT NULL;
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");
