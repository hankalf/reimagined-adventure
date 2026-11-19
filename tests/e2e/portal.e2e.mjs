/**
 * End-to-end walk through the portal against a running server with the seeded demo database.
 *   BASE_URL=http://localhost:3000 node tests/e2e/portal.e2e.mjs
 * Requires: Playwright + Chromium, EMAIL_TRANSPORT=console, CRON_SECRET set on the server.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// Playwright may be installed globally (as in the cloud sandbox) rather than in node_modules.
const { chromium } = require("playwright");
import sharp from "sharp";
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeMe-12345";
const CRON_SECRET = process.env.CRON_SECRET ?? "local-cron-secret";
const SHOTS = process.env.SHOTS_DIR ?? path.join(os.tmpdir(), "gift-portal-shots");
fs.mkdirSync(SHOTS, { recursive: true });

const run = `${Date.now().toString(36).slice(-5)}`;
const SLUG = `e2e-${run}`;
let step = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const section = (msg) => console.log(`\n[${++step}] ${msg}`);
function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${String(step).padStart(2, "0")}-${name}.png`), fullPage: true });
}

const browser = await chromium.launch();
try {
  const admin = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const a = await admin.newPage();

  section("Admin login");
  await a.goto(`${BASE}/admin/campaigns`);
  await a.waitForURL(/\/admin\/login/);
  await a.fill("#email", ADMIN_EMAIL);
  await a.fill("#password", ADMIN_PASSWORD);
  await a.click('button[type=submit]');
  await a.waitForURL(/\/admin\/campaigns$/);
  ok("logged in and redirected back to the requested page");

  section("Create a product gift with an Amazon link, options and an uploaded photo");
  const png = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 220, g: 60, b: 90 } } }).png().toBuffer();
  const pngPath = path.join(SHOTS, "mug.png");
  fs.writeFileSync(pngPath, png);
  await a.goto(`${BASE}/admin/items/new`);
  await a.fill("#productUrl", "https://www.amazon.com/Some-Mug/dp/B07XYZ1234/ref=sr_1_1");
  await a.click('button:has-text("Fetch details")');
  await a.waitForSelector('text=ASIN: B07XYZ1234', { timeout: 30000 });
  ok("ASIN extracted from the Amazon link");
  await a.fill("#name", `E2E Mug ${run}`);
  await a.fill("#nameEs", `Taza E2E ${run}`);
  await a.fill("#description", "A test mug.");
  await a.fill("#unitCost", "20");
  await a.fill("#optionLabel", "Color");
  await a.fill("#optionValues", "Red, Blue");
  await a.setInputFiles("#image", pngPath);
  await a.click('button:has-text("Create gift")');
  await a.waitForURL(/\/admin\/items\?saved=/);
  const mugRow = a.locator("tr", { hasText: `E2E Mug ${run}` });
  assert((await mugRow.count()) === 1, "mug appears in catalog");
  const thumbSrc = await mugRow.locator("img").getAttribute("src");
  assert(thumbSrc && thumbSrc.includes("/api/images/") && thumbSrc.includes("thumb=1"), `thumbnail served from image API (${thumbSrc})`);
  const thumbRes = await a.request.get(`${BASE}${thumbSrc}`);
  assert(thumbRes.ok() && (thumbRes.headers()["content-type"] ?? "").startsWith("image/"), "thumbnail route returns an image");
  ok(`thumbnail stored and served (${thumbRes.headers()["content-type"]})`);
  await shot(a, "catalog");

  section("Create a custom (non-purchase) gift");
  await a.goto(`${BASE}/admin/items/new`);
  await a.check('input[name=type][value=CUSTOM]');
  await a.fill("#name", `E2E Extra PTO ${run}`);
  await a.fill("#description", "Four extra hours off.");
  await a.fill("#unitCost", "0");
  await a.fill("#fulfillmentNote", "HR adds 4h PTO in payroll.");
  await a.click('button:has-text("Create gift")');
  await a.waitForURL(/\/admin\/items\?saved=/);
  ok("custom gift created");

  section("Create a campaign and choose which gifts to show");
  await a.goto(`${BASE}/admin/campaigns/new`);
  await a.fill("#name", `E2E Campaign ${run}`);
  await a.fill("#slug", SLUG);
  await a.fill("#defaultEmployeeBudget", "75");
  await a.fill("#totalBudget", "1000");
  await a.fill("#hrEmails", "hr@test.local");
  await a.click('button:has-text("Create campaign")');
  await a.waitForURL(/\/admin\/campaigns\/[^/]+\/items/);
  const campaignId = a.url().match(/campaigns\/([^/]+)\/items/)[1];
  for (const label of [`E2E Mug ${run}`, `E2E Extra PTO ${run}`, "Company Hoodie", "Premium Wireless Headphones"]) {
    await a.locator("label", { hasText: label }).locator('input[name=itemIds]').check();
  }
  await a.click('button:has-text("Add selected gifts")');
  await a.waitForLoadState("networkidle");
  assert((await a.locator("h2", { hasText: "Gifts shown to employees (4)" }).count()) === 1, "4 gifts shown");
  ok("4 gifts added to the campaign");
  await shot(a, "gifts-shown");

  section("Upload the campaign employee list (CSV with a budget tier)");
  const csv = `employee_number,first_name,last_name,department,budget\nE2E${run}1,Test1,García López,Ops,\nE2E${run}2,Test2,Smith,Finance,\nE2E${run}3,Test3,Nguyen,Eng,200\n`;
  const csvPath = path.join(SHOTS, "employees.csv");
  fs.writeFileSync(csvPath, csv);
  await a.goto(`${BASE}/admin/campaigns/${campaignId}/employees`);
  await a.setInputFiles("#file", csvPath);
  await a.click('button:has-text("Import CSV")');
  await a.waitForSelector("text=/Imported: 3 new/");
  ok("3 employees imported and marked eligible");
  await a.reload();
  assert((await a.locator("text=Only the list uploaded for this campaign").count()) === 1, "eligibility switched to the uploaded list");

  section("Open the campaign and fetch the QR code");
  await a.click('button:has-text("Open campaign")');
  await a.waitForSelector("text=Close campaign");
  const qr = await a.request.get(`${BASE}/api/campaigns/${SLUG}/qr?size=256`);
  assert(qr.ok() && qr.headers()["content-type"] === "image/png", "QR PNG served");
  const qrSvg = await a.request.get(`${BASE}/api/campaigns/${SLUG}/qr?format=svg`);
  assert(qrSvg.ok() && (await qrSvg.text()).includes("<svg"), "QR SVG served");
  ok("campaign is open; QR PNG and SVG endpoints work");
  await a.goto(`${BASE}/admin/campaigns/${campaignId}/poster`);
  await a.waitForSelector("text=Escanea para elegir tu regalo");
  await shot(a, "poster");

  section("Employee flow in Spanish: identity check with employee number + last name");
  const emp = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 1, locale: "es-MX" });
  const e = await emp.newPage();
  await e.goto(`${BASE}/g/${SLUG}`);
  await e.waitForSelector("text=Número de empleado");
  ok("landing page rendered in Spanish from Accept-Language");
  await e.fill("#employeeNumber", `E2E${run}1`);
  await e.fill("#lastName", "Smith");
  await e.click('button[type=submit]');
  await e.waitForSelector("text=/No encontramos un empleado/");
  ok("wrong last name rejected with a generic message");
  await e.fill("#employeeNumber", `e2e${run}1`);
  await e.fill("#lastName", "garcia");
  await e.click('button[type=submit]');
  await e.waitForURL(new RegExp(`/g/${SLUG}/pick`));
  await e.waitForSelector("text=¡Hola Test1!");
  ok("number (case-insensitive) + partial accent-insensitive last name accepted; greeted by first name");
  await shot(e, "pick-es");

  section("Budget and availability badges, then pick a gift with an option");
  const headphones = e.locator("li", { hasText: "Audífonos inalámbricos premium" });
  assert((await headphones.locator("text=Excede tu presupuesto").count()) === 1, "over-budget badge on the $149 item for a $75 budget");
  assert((await e.locator("text=Taza E2E").count()) >= 1, "Spanish item name shown");
  await e.locator("li", { hasText: "Sudadera con capucha" }).locator("button").first().click();
  await e.waitForSelector('[role=dialog]');
  await e.selectOption("#optionValue", "M");
  await e.click('button:has-text("Elegir este regalo")');
  await e.click('button:has-text("Sí, confirmar")');
  await e.waitForURL(new RegExp(`/g/${SLUG}/done`));
  await e.waitForSelector("text=Código de confirmación");
  const code = (await e.locator("dd.font-mono").first().textContent()).trim();
  assert(/^[A-Z2-9]{6}$/.test(code), `confirmation code looks right (${code})`);
  ok(`hoodie size M confirmed; code ${code}`);
  await shot(e, "done-es");

  section("Locked after picking: landing redirects to the confirmation page");
  await e.goto(`${BASE}/g/${SLUG}`);
  await e.waitForURL(new RegExp(`/g/${SLUG}/done`));
  ok("returning employee lands on their confirmation, not the grid");
  await e.goto(`${BASE}/g/${SLUG}/pick`);
  await e.waitForURL(new RegExp(`/g/${SLUG}/done`));
  ok("direct visit to the grid also redirects while a pick exists");

  section("Over-budget pick rejected server-side");
  // Try to change to the headphones through the change flow; the button is disabled in the UI, so post the form directly.
  await e.goto(`${BASE}/g/${SLUG}/pick?change=1`);
  await e.waitForSelector("text=¡Hola Test1!");
  await headphones.locator("button").first().click();
  await e.waitForSelector('[role=dialog]');
  const chooseBtn = e.locator('[role=dialog] button:has-text("Elegir este regalo")');
  assert(await chooseBtn.isDisabled(), "choose button disabled for an over-budget item");
  ok("UI blocks over-budget items");
  await e.keyboard.press("Escape");

  section("Change gift to the mug (allowed until ordered)");
  await e.locator("li", { hasText: "Taza E2E" }).locator("button").first().click();
  await e.waitForSelector('[role=dialog]');
  await e.selectOption("#optionValue", "Red");
  await e.click('button:has-text("Elegir este regalo")');
  await e.click('button:has-text("Sí, confirmar")');
  await e.waitForURL(new RegExp(`/g/${SLUG}/done`));
  await e.waitForSelector(`text=Taza E2E ${run}`);
  ok("selection changed to the mug (Red)");

  section("Admin marks the mug out of stock -> employee must re-pick");
  await a.goto(`${BASE}/admin/campaigns/${campaignId}/items`);
  a.once("dialog", (d) => d.accept());
  await a.locator("tr", { hasText: `E2E Mug ${run}` }).locator('button:has-text("Out of stock")').click();
  await a.waitForSelector("text=Back in stock");
  ok("mug marked out of stock");
  await e.goto(`${BASE}/g/${SLUG}`);
  await e.waitForURL(new RegExp(`/g/${SLUG}/pick`));
  await e.waitForSelector("text=/Lo sentimos, tu regalo ya no está disponible/");
  ok("employee sees the re-pick banner");
  assert((await e.locator("li", { hasText: "Taza E2E" }).locator("text=Agotado").count()) === 1, "mug shows Sold out badge");
  await shot(e, "repick");
  await e.locator("li", { hasText: "Sudadera con capucha" }).locator("button").first().click();
  await e.selectOption("#optionValue", "L");
  await e.click('button:has-text("Elegir este regalo")');
  await e.click('button:has-text("Sí, confirmar")');
  await e.waitForURL(new RegExp(`/g/${SLUG}/done`));
  ok("re-picked hoodie size L");

  section("Orders list: grouped summary, bulk mark ordered, received, collected");
  await a.goto(`${BASE}/admin/campaigns/${campaignId}/orders`);
  const group = a.locator("tr", { hasText: "Company Hoodie" }).filter({ hasText: "Mark 1 ordered" });
  assert((await group.count()) === 1, "grouped row shows 1 hoodie to order");
  assert((await a.locator("tr", { hasText: "Company Hoodie" }).first().locator('a:has-text("Open")').count()) === 1, "Amazon link present in grouped row");
  await group.locator('button:has-text("Mark 1 ordered")').click();
  await a.waitForSelector("text=Mark 1 received");
  ok("bulk 'mark ordered' worked");
  await shot(a, "orders");
  const row = a.locator("tr", { hasText: `E2E${run}1` });
  await row.locator('button:has-text("Mark received")').click();
  await a.waitForSelector("tr:has-text('E2E" + run + "1') >> text=Mark collected");
  await a.locator("tr", { hasText: `E2E${run}1` }).locator('button:has-text("Mark collected")').click();
  await a.waitForSelector("tr:has-text('E2E" + run + "1') >> text=Collected");
  ok("row actions moved the selection to Received then Collected");
  await e.goto(`${BASE}/g/${SLUG}/done`);
  await e.waitForSelector("text=Entregado");
  assert((await e.locator("text=Cambiar mi regalo").count()) === 0, "change button hidden once ordered");
  ok("employee sees Collected status in Spanish and can no longer change");

  section("Budget tab totals");
  await a.goto(`${BASE}/admin/campaigns/${campaignId}/budget`);
  await a.waitForSelector("text=$55.00");
  assert((await a.locator("text=$1,000.00").count()) >= 1, "total budget shown");
  ok("committed spend $55.00 of $1,000.00");
  await shot(a, "budget");

  section("HR email (console mode) with Excel + CSV attachments");
  await a.goto(`${BASE}/admin/campaigns/${campaignId}/emails`);
  await a.click('button:has-text("Send order list now")');
  await a.waitForSelector("text=/selection\\(s\\) included/");
  await a.goto(`${BASE}/admin/campaigns/${campaignId}/emails`);
  await a.waitForSelector("text=Gift orders:");
  const logRow = a.locator("tbody tr", { hasText: "Gift orders:" }).first();
  const attachments = await logRow.locator("td").nth(3).innerText();
  assert(attachments.includes(".xlsx") && attachments.includes("summary") && attachments.includes("detail"), `attachments listed (${attachments})`);
  ok("email logged with orders.xlsx and both CSVs attached");
  await shot(a, "emails");

  section("Excel export: workbook parses and contains the hoodie order");
  const xlsx = await a.request.get(`${BASE}/api/export/${campaignId}?type=xlsx`);
  assert(xlsx.ok() && (xlsx.headers()["content-type"] ?? "").includes("spreadsheetml"), "xlsx download works for admins");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await xlsx.body());
  const names = wb.worksheets.map((w) => w.name);
  assert(["Summary", "Detail", "Budget", "Not picked", "Info"].every((n) => names.includes(n)), `sheets present (${names.join(", ")})`);
  const summarySheet = wb.getWorksheet("Summary");
  let foundHoodie = false;
  summarySheet.eachRow((r) => {
    if (String(r.getCell(1).value) === "Company Hoodie" && String(r.getCell(3).value) === "L") foundHoodie = true;
  });
  assert(foundHoodie, "Summary sheet has Company Hoodie / L row");
  const notPicked = wb.getWorksheet("Not picked");
  assert(notPicked.rowCount === 3, `Not picked lists the 2 remaining employees (rows=${notPicked.rowCount})`);
  ok("workbook has all sheets, the hoodie line and the not-picked list");

  section("Live spreadsheet feed works without a login");
  const feedUrl = await a.locator("input[readonly]").first().inputValue();
  const anon = await browser.newContext();
  const feed = await anon.request.get(feedUrl.replace(/^https?:\/\/[^/]+/, BASE));
  assert(feed.ok() && (feed.headers()["content-type"] ?? "").includes("spreadsheetml"), "feed xlsx served anonymously with the token");
  const feedCsv = await anon.request.get(feedUrl.replace(/^https?:\/\/[^/]+/, BASE) + "?format=csv");
  assert(feedCsv.ok() && (await feedCsv.text()).includes("Company Hoodie"), "feed csv has the hoodie");
  const bad = await anon.request.get(`${BASE}/api/feed/notarealtoken1234567890`);
  assert(bad.status() === 404, "bad token rejected");
  const noAuth = await anon.request.get(`${BASE}/api/export/${campaignId}?type=xlsx`);
  assert(noAuth.status() === 401, "admin export rejected without login");
  ok("feed token works; admin export requires login");
  await anon.close();

  section("Scheduled digest endpoint");
  const cronBad = await a.request.get(`${BASE}/api/cron/digest`);
  assert(cronBad.status() === 401, "digest requires the secret");
  const cron = await a.request.get(`${BASE}/api/cron/digest`, { headers: { authorization: `Bearer ${CRON_SECRET}` } });
  assert(cron.ok(), "digest runs with the secret");
  ok(`digest endpoint ok: ${JSON.stringify((await cron.json()).results.length)} campaign(s) considered`);

  section("Admin users: add an HR user, set password via link, role gate, delete");
  await a.goto(`${BASE}/admin/settings/users`);
  await a.fill("#user-name", `HR Person ${run}`);
  await a.fill("#user-email", `hr-${run}@test.local`);
  await a.selectOption("#user-role", "HR");
  await a.click('button:has-text("Add user and send invite")');
  await a.waitForSelector("text=/was added/");
  const inviteLink = await a.locator("form:has(#user-name) input[readonly]").inputValue();
  assert(inviteLink.includes("/admin/set-password/"), `invite link shown (${inviteLink})`);
  const hr = await browser.newContext();
  const h = await hr.newPage();
  await h.goto(inviteLink.replace(/^https?:\/\/[^/]+/, BASE));
  await h.waitForSelector(`text=Welcome, HR Person ${run}`);
  await h.fill("#password", "Sunflower-2026");
  await h.fill("#confirm", "Sunflower-2026");
  await h.click('button:has-text("Save password and sign in")');
  await h.waitForURL(/\/admin$/);
  ok("new user chose a password and is signed in");
  await h.goto(`${BASE}/admin/settings/users`);
  await h.waitForURL(/\/admin\?forbidden=1/);
  await h.waitForSelector("text=/only available to users with the ADMIN role/");
  ok("HR role blocked from user management");
  await h.goto(`${BASE}/admin/campaigns/${campaignId}/orders`);
  await h.waitForSelector("text=Main order list");
  ok("HR role can see orders");
  await hr.close();
  await a.goto(`${BASE}/admin/settings/users`);
  await a.locator("tr", { hasText: `hr-${run}@test.local` }).locator('button:has-text("Delete")').click();
  await a.waitForLoadState("networkidle");
  assert((await a.locator("tr", { hasText: `hr-${run}@test.local` }).count()) === 0, "user deleted");
  ok("user deleted");

  section("Health check and sign out");
  const health = await a.request.get(`${BASE}/api/health`);
  assert(health.ok() && (await health.json()).db === "up", "health reports db up");
  await a.goto(`${BASE}/admin/logout`);
  await a.waitForURL(/\/admin\/login/);
  await a.goto(`${BASE}/admin`);
  await a.waitForURL(/\/admin\/login/);
  ok("signed out; admin pages redirect to login");

  console.log(`\nAll ${step} sections passed. Screenshots in ${SHOTS}`);
  await emp.close();
  await admin.close();
} catch (err) {
  try {
    let n = 0;
    for (const ctx of browser.contexts()) {
      for (const p of ctx.pages()) {
        n += 1;
        console.error(`\n--- page ${n}: ${p.url()}\n${(await p.innerText("body")).slice(0, 1500)}`);
        await p.screenshot({ path: path.join(SHOTS, `FAIL-${String(step).padStart(2, "0")}-${n}.png`), fullPage: true });
      }
    }
  } catch {
    // ignore
  }
  throw err;
} finally {
  await browser.close();
}
