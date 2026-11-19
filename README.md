# Employee Gift Portal

A self-hosted, Snappy-style gift portal. Admins build a gift catalog (Amazon products with photos, plus custom perks like "4 hours of PTO"), run campaigns with their own branding and budget, and print a QR poster. Employees scan the code, enter their **employee number + last name**, browse a photo grid in **English or Spanish**, and pick **one gift**. HR gets the order list by email (with an **Excel workbook** attached), works it on the Orders screen (mark ordered / received / collected, mark items out of stock), and can point Excel or Google Sheets at a live, auto-updating feed.

Built with Next.js 16 (App Router), Prisma 7, PostgreSQL, Tailwind 4. Designed to run on [Railway](https://railway.com).

## Features

**Employees**
- QR code → campaign landing page with company logo, colours, hero image, welcome message and a message from leadership.
- Identity check: employee number + last name (case- and accent-insensitive; "cruz" matches "de la Cruz"). Rate-limited. Generic error for mismatches.
- Photo card grid with search and category filter; detail view with large photo, description, product link and option picker (size/colour).
- One pick per campaign. Locked after confirming (configurable: allow changes until HR orders). Confirmation code shown as text and as a QR code to present at pickup, plus pickup instructions.
- Budget-aware: items above the employee's budget are greyed out (or hidden). Stock limits show "Only N left" / "Sold out".
- If HR marks their gift out of stock, the employee is asked to re-pick on their next visit.
- English/Spanish toggle, defaulting to the browser language; campaign and item text can be entered in both languages.

**Admins / HR**
- Gift catalog: paste an Amazon link and the form fills itself in when the page can be read (name, price, description, category, every product photo, colour/size options; Amazon sometimes blocks this), upload a main photo plus a gallery of extra photos (resized + thumbnails generated automatically), a photo per colour that swaps in when the employee picks that colour, up to two option groups (e.g. Color and Size), cost, category. Custom non-purchase gifts with a "how HR fulfils this" note. Bulk import from an Excel/CSV spreadsheet with a downloadable template (see below).
- Campaigns: choose which gifts to show and in what order, and for gifts with options tick which colours/sizes are offered in that campaign; per-campaign stock limits and cost overrides; mark out of stock or untick a colour (affected employees flagged for re-pick).
- Employees: master list with CSV import (`employee_number, first_name, last_name, department, budget`), per-campaign eligibility and budget tiers, pick on behalf of a walk-up employee, reset a selection.
- Orders: main list grouped by gift (quantities, unit cost, subtotal, Amazon link), custom gifts in their own section, per-row and bulk status changes (to order → ordered → received → collected), pickup-day search by employee number.
- Pickup kiosk (`/admin/campaigns/<id>/kiosk`): full-screen page for the front desk. Scan the QR code on the employee's confirmation page with the device camera (BarcodeDetector where available, jsQR fallback), or type/USB-scan the confirmation code, employee number or name; see who they are and what they chose; mark collected in one tap with undo. Live collected/ready counters.
- Budget: total vs committed vs ordered, spend per gift, per-employee budget vs cost with over-budget flags.
- Orders spreadsheet (Settings): one live link for all campaigns that Excel ("Get Data → From Web") or Google Sheets (`IMPORTDATA`) refreshes automatically, plus a push webhook that POSTs every order change (chosen, changed, ordered, received, collected, reset, re-priced) to Power Automate, Zapier, Make or your own endpoint so a sheet fills itself. Per-campaign Excel downloads and live links on the campaign's "Excel & live sheet" tab.
- Order-time pricing: type the price actually paid on the Orders row before marking it ordered; the gift is re-priced everywhere and every change is kept in the gift's price history.
- QR poster: printable bilingual A4 page; PNG/SVG download.
- Branding per campaign: logo, hero image, primary/accent colours, bilingual headline, welcome, pickup instructions and leadership message.
- Admin users: ADMIN and HR roles, invite by email with a self-service set-password link (also shown to copy), deactivate/delete, forgot-password flow.
- Audit log of admin and employee actions (database table `AuditLog`).

## Deploy on Railway

1. **Create a project** on Railway and add a **PostgreSQL** database.
2. **Add a service from this GitHub repo.** `railway.json` selects Railway's Railpack builder, and `.node-version` / `engines` pin Node 22 (latest 22.x; Prisma 7 needs 22.12+, which the older Nixpacks builder cannot provide). Build is `npm ci && npm run build`; start is `npm run start:railway`, which runs `prisma migrate deploy` then `next start`. Set the variables below **before** the first build: `postinstall` runs `prisma generate`, which reads `DATABASE_URL`.
3. **Set variables** on the app service (Variables tab):

   | Variable | Required | Notes |
   | --- | --- | --- |
   | `DATABASE_URL` | yes | Use a reference to the Postgres service: `${{Postgres.DATABASE_URL}}` |
   | `SESSION_SECRET` | yes | Long random string (`openssl rand -hex 32`) |
   | `APP_URL` | yes | Public URL, e.g. `https://gifts.up.railway.app` (used in QR codes and email links) |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | first start | Creates the first admin when the users table is empty |
   | `EMAIL_TRANSPORT`, `EMAIL_FROM`, `SMTP_*` | optional | Only used to email admin invite / password-reset links; the links are also shown on screen |

4. **Generate a domain** (Settings → Networking) and put it in `APP_URL`.
5. Deploy, then open `https://your-domain/admin/login` and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Change the password afterwards via "Forgot your password?" or Settings → Admin users.
6. (Optional) **Demo data**: run `npm run db:seed` once from a Railway shell to load sample gifts, employees and an open campaign at `/g/holiday-2026`.
7. **Orders spreadsheet**: Admin → Settings → Orders spreadsheet. Paste the live link into Excel or Google Sheets, and/or paste a Power Automate / Zapier / Make webhook URL so each order change is pushed as it happens.

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
src/app/admin/(kiosk)/            pickup-day kiosk with camera scanning
src/app/api/                      images, QR, admin exports, live feed, cron digest, health
src/lib/selection.ts              identity check, availability, budget, transactional pick, re-pick, status changes
src/lib/report.ts                 one data builder behind Orders, Budget, CSV and Excel
src/lib/excel.ts                  exceljs workbook
src/lib/webhook.ts                orders webhook (push) + global live feed token
src/lib/pricing.ts                order-time price updates and price history
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

## Gift catalog import (Excel/CSV)

Admin → Gift catalog → "Import gifts from a spreadsheet". Download the Excel or CSV template, fill one row per gift, upload it back. Headers are matched loosely; only `name` is required.

| Column | Notes |
| --- | --- |
| `name`, `name_es` | Gift name (English; optional Spanish) |
| `description`, `description_es` | Descriptions |
| `category` | Used for the employee filter |
| `type` | `product` (default) or `custom` (HR arranges it, e.g. PTO) |
| `amazon_url` | Amazon/store link; the ASIN is extracted and the link normalised |
| `asin`, `sku` | Identifiers; re-imports match existing gifts by ASIN, then SKU, then name |
| `unit_cost` | Cost per unit |
| `option1_label`, `option1_values`, `option2_label`, `option2_values` | Option groups, values separated by commas or `\|` |
| `colors`, `sizes` | Shortcuts that fill the option groups with labels Color / Size |
| `image_url` | Photo links separated by `\|`; first = main picture, rest = gallery; the importer can download and store them |
| `color_images` | Photo per colour: `Teal=https://… \| Rose=https://…` |
| `fulfillment_note` | Custom gifts: how HR fulfils it |
| `active` | yes/no |

## Ideas for later

Scheduled reminder exports for people who haven't picked, employee notifications when gifts arrive, analytics by department, points-based multi-item campaigns, more languages, Amazon Product Advertising API for price sync, manager approval for custom perks, SSO for admins.
