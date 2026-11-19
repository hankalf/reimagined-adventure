# Employee Gift Portal

A self-hosted, Snappy-style gift portal. Admins build a gift catalog (Amazon products with photos, plus custom perks like "4 hours of PTO"), run campaigns with their own branding and budget, and print a QR poster. Employees scan the code, enter their **employee number + last name**, browse a photo grid in **English or Spanish**, and pick **one gift**. HR gets the order list by email (with an **Excel workbook** attached), works it on the Orders screen (mark ordered / received / collected, mark items out of stock), and can point Excel or Google Sheets at a live, auto-updating feed.

Built with Next.js 16 (App Router), Prisma 7, PostgreSQL, Tailwind 4. Designed to run on [Railway](https://railway.com).

## Features

**Employees**
- QR code → campaign landing page with company logo, colours, hero image, welcome message and a message from leadership.
- Identity check: employee number + last name (case- and accent-insensitive; "cruz" matches "de la Cruz"). Rate-limited. Generic error for mismatches.
- Photo card grid with search and category filter; detail view with large photo, description, product link and option picker (size/colour).
- One pick per campaign. Locked after confirming (configurable: allow changes until HR orders). Confirmation code + pickup instructions.
- Budget-aware: items above the employee's budget are greyed out (or hidden). Stock limits show "Only N left" / "Sold out".
- If HR marks their gift out of stock, the employee is asked to re-pick on their next visit.
- English/Spanish toggle, defaulting to the browser language; campaign and item text can be entered in both languages.

**Admins / HR**
- Gift catalog: paste an Amazon link (ASIN extracted, canonical link stored, details prefilled when Amazon allows it), upload a photo (resized + thumbnail generated automatically), options, cost, category. Custom non-purchase gifts with a "how HR fulfils this" note.
- Campaigns: choose which gifts to show and in what order, per-campaign stock limits and cost overrides, mark out of stock (affected employees flagged for re-pick).
- Employees: master list with CSV import (`employee_number, first_name, last_name, department, budget`), per-campaign eligibility and budget tiers, pick on behalf of a walk-up employee, reset a selection.
- Orders: main list grouped by gift (quantities, unit cost, subtotal, Amazon link), custom gifts in their own section, per-row and bulk status changes (to order → ordered → received → collected), pickup-day search by employee number.
- Budget: total vs committed vs ordered, spend per gift, per-employee budget vs cost with over-budget flags.
- HR email: HTML summary + `orders.xlsx` (Summary, Detail, Budget, Not picked, Info) + two CSVs. Full list or only new since last email. Optional scheduled digest. Email history with preview.
- Live spreadsheet feed: a secret URL per campaign that Excel ("Get Data → From Web") or Google Sheets (`IMPORTDATA`) can refresh automatically.
- QR poster: printable bilingual A4 page; PNG/SVG download.
- Branding per campaign: logo, hero image, primary/accent colours, bilingual headline, welcome, pickup instructions and leadership message.
- Admin users: ADMIN and HR roles, invite by email with a self-service set-password link (also shown to copy), deactivate/delete, forgot-password flow.
- Audit log of admin and employee actions (database table `AuditLog`).

## Deploy on Railway

1. **Create a project** on Railway and add a **PostgreSQL** database.
2. **Add a service from this GitHub repo.** Railway detects Node and uses `railway.json` / `nixpacks.toml` (build: `npm run build`, start: `npm run start:railway`, which runs `prisma migrate deploy` then `next start`).
3. **Set variables** on the app service (Variables tab):

   | Variable | Required | Notes |
   | --- | --- | --- |
   | `DATABASE_URL` | yes | Use a reference to the Postgres service: `${{Postgres.DATABASE_URL}}` |
   | `SESSION_SECRET` | yes | Long random string (`openssl rand -hex 32`) |
   | `APP_URL` | yes | Public URL, e.g. `https://gifts.up.railway.app` (used in QR codes and email links) |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | first start | Creates the first admin when the users table is empty |
   | `EMAIL_TRANSPORT` | yes | `console` (log only) or `smtp` |
   | `EMAIL_FROM` | smtp | e.g. `Gift Portal <no-reply@company.com>` |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | smtp | Works with Office 365, Google Workspace, Resend, SendGrid, Postmark, etc. |
   | `CRON_SECRET` | optional | Enables `/api/cron/digest` for scheduled HR digests |

4. **Generate a domain** (Settings → Networking) and put it in `APP_URL`.
5. Deploy, then open `https://your-domain/admin/login` and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Change the password afterwards via "Forgot your password?" or Settings → Admin users.
6. (Optional) **Demo data**: run `npm run db:seed` once from a Railway shell to load sample gifts, employees and an open campaign at `/g/holiday-2026`.
7. (Optional) **Scheduled digest**: add a Railway cron service that runs
   `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/digest`
   and turn on "Automatic digest" in the campaign's HR emails tab.

Images are stored in Postgres (resized to ≤1200px plus a 480px thumbnail), so no object storage or volume is needed.

## Local development

```bash
cp .env.example .env         # edit DATABASE_URL etc.
npm install                  # also runs prisma generate
npm run db:migrate           # creates the schema
npm run db:seed              # demo data (admin@example.com / ChangeMe-12345 unless ADMIN_* set)
npm run dev
```

- Employee demo: http://localhost:3000/g/holiday-2026 (try employee `10001`, last name `García`).
- Admin: http://localhost:3000/admin
- Tests: `npm test` (unit) and, with the server running, `node tests/e2e/portal.e2e.mjs` (Playwright walkthrough).

## How the pieces fit

```
src/app/(employee)/g/[slug]/      landing (identity form), pick (photo grid), done (confirmation)
src/app/admin/(auth)/             login, forgot/set password
src/app/admin/(app)/              dashboard, campaigns/[id]/{items,employees,orders,budget,emails,branding,settings}, items, employees, settings/users
src/app/admin/(print)/            printable QR poster
src/app/api/                      images, QR, admin exports, live feed, cron digest, health
src/lib/selection.ts              identity check, availability, budget, transactional pick, re-pick, status changes
src/lib/report.ts                 one data builder behind Orders, Budget, HR email, CSV and Excel
src/lib/excel.ts                  exceljs workbook
src/lib/hr-email.ts               sends the HR order email with attachments
src/i18n/                         en/es dictionaries for the employee UI
prisma/schema.prisma              data model; prisma/seed.ts demo data
```

## Employee CSV format

Headers are matched loosely (`Emp No`, `Employee ID`, `Last Name`, `Dept` all work). A single `name` column is split into first/last. Example:

```csv
employee_number,first_name,last_name,department,budget
10001,Maria,García,Operations,
10004,Wei,Chen,Engineering,150
```

Uploading on a campaign's Employees tab marks those people eligible for that campaign (and sets per-person budgets); uploading on the global Employees page updates the master list.

## Ideas for later

Scheduled reminder exports for people who haven't picked, pickup-day kiosk mode with code scanning, employee notifications when gifts arrive, analytics by department, points-based multi-item campaigns, more languages, Amazon Product Advertising API for price sync, manager approval for custom perks, SSO for admins.
