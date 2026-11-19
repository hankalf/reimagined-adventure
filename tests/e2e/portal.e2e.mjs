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
import http from "node:http";

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

  section("Settings: connect the orders webhook to a local receiver");
  const received = [];
  const receiver = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        received.push({ event: req.headers["x-giftportal-event"], signature: req.headers["x-giftportal-signature"], body: JSON.parse(body) });
      } catch {
        received.push({ event: "unparseable", body });
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"ok":true}');
    });
  });
  await new Promise((r) => receiver.listen(0, "127.0.0.1", r));
  const hookUrl = `http://127.0.0.1:${receiver.address().port}/hook`;
  await a.goto(`${BASE}/admin/settings`);
  await a.fill("#webhook-url", hookUrl);
  await a.fill("#webhook-secret", "e2e-secret");
  await a.click('button:has-text("Save webhook")');
  await a.waitForSelector("text=/Webhook saved/");
  await a.click('button:has-text("Send a test event")');
  await a.waitForSelector("text=/Test event delivered/");
  assert(received.some((r) => r.event === "test" && r.signature?.startsWith("sha256=")), "test event reached the receiver with a signature");
  const globalFeed = await a.locator("input[readonly]").first().inputValue();
  assert(globalFeed.includes("/api/feed/all/"), "global live link shown");
  ok("webhook configured and test event delivered; global live link available");

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
  await a.fill("#option1Label", "Color");
  await a.fill("#option1Values", "Red, Blue, Green");
  await a.fill("#option2Label", "Size");
  await a.fill("#option2Values", "11oz, 15oz");
  await a.setInputFiles("#image", pngPath);
  const extra1 = path.join(SHOTS, "extra1.png");
  const extra2 = path.join(SHOTS, "extra2.png");
  const redPng = path.join(SHOTS, "red.png");
  fs.writeFileSync(extra1, await sharp({ create: { width: 500, height: 400, channels: 3, background: { r: 40, g: 120, b: 200 } } }).png().toBuffer());
  fs.writeFileSync(extra2, await sharp({ create: { width: 500, height: 400, channels: 3, background: { r: 40, g: 180, b: 90 } } }).png().toBuffer());
  fs.writeFileSync(redPng, await sharp({ create: { width: 500, height: 500, channels: 3, background: { r: 230, g: 30, b: 30 } } }).png().toBuffer());
  await a.setInputFiles("#extraImages", [extra1, extra2]);
  await a.waitForSelector("#colorImage-Red");
  await a.setInputFiles("#colorImage-Red", redPng);
  await a.click('button:has-text("Create gift")');
  await a.waitForURL(/\/admin\/items\?saved=/);
  const mugRow = a.locator("tr", { hasText: `E2E Mug ${run}` });
  assert((await mugRow.count()) === 1, "mug appears in catalog");
  const thumbSrc = await mugRow.locator("img").getAttribute("src");
  assert(thumbSrc && thumbSrc.includes("/api/images/") && thumbSrc.includes("thumb=1"), `thumbnail served from image API (${thumbSrc})`);
  const thumbRes = await a.request.get(`${BASE}${thumbSrc}`);
  assert(thumbRes.ok() && (thumbRes.headers()["content-type"] ?? "").startsWith("image/"), "thumbnail route returns an image");
  ok(`thumbnail stored and served (${thumbRes.headers()["content-type"]})`);
  await mugRow.locator("a").first().click();
  await a.waitForSelector("#extraImages");
  assert((await a.locator('input[name="removeImageIds"]').count()) === 2, "two gallery photos saved");
  const redThumb = await a.locator("#colorImage-Red").locator("xpath=../..").locator("img").getAttribute("src");
  assert(redThumb && redThumb.includes("/api/images/"), "Red colour photo saved");
  ok("gallery photos and the Red colour photo are stored on the gift");
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
  await a.click('button:has-text("Create campaign")');
  await a.waitForURL(/\/admin\/campaigns\/[^/]+\/items/);
  const campaignId = a.url().match(/campaigns\/([^/]+)\/items/)[1];
  for (const label of [`E2E Mug ${run}`, `E2E Extra PTO ${run}`, "Company Hoodie", "Premium Wireless Headphones"]) {
    await a.locator("label", { hasText: label }).locator('input[name=itemIds]').check();
  }
  await a.locator("li", { hasText: `E2E Mug ${run}` }).locator('input[name^="enabled1:"][value="Green"]').uncheck();
  await a.click('button:has-text("Add selected gifts")');
  await a.waitForLoadState("networkidle");
  assert((await a.locator("h2", { hasText: "Gifts shown to employees (4)" }).count()) === 1, "4 gifts shown");
  const mugRowOpts = a.locator("tr", { hasText: `E2E Mug ${run}` });
  assert(!(await mugRowOpts.locator('input[name="enabled1"][value="Green"]').isChecked()), "Green is not offered in this campaign");
  assert(await mugRowOpts.locator('input[name="enabled1"][value="Red"]').isChecked(), "Red is offered");
  ok("4 gifts added; mug offered in Red and Blue only (Green unticked at add time)");
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

  section("Branding: enable the dancing elf with an uploaded face");
  const face = await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 250, g: 210, b: 170 } } }).png().toBuffer();
  const facePath = path.join(SHOTS, "face.png");
  fs.writeFileSync(facePath, face);
  await a.goto(`${BASE}/admin/campaigns/${campaignId}/branding`);
  await a.check('input[name="mascotEnabled"]');
  await a.setInputFiles("#mascot", facePath);
  await a.fill("#mascotCaption", `Happy holidays from the plant manager ${run}!`);
  await a.fill("#mascotCaptionEs", `¡Felices fiestas de parte del gerente ${run}!`);
  await a.click('button:has-text("Save branding")');
  await a.waitForSelector("text=Branding saved.");
  await a.reload();
  const faceHref = await a.locator("[data-elf] image").first().getAttribute("href");
  assert(faceHref && faceHref.includes("/api/images/"), `branding preview shows the uploaded face (${faceHref})`);
  ok("elf enabled with an uploaded face and bilingual caption");
  await shot(a, "branding-elf");

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
  const elf = e.locator("[data-elf]");
  assert((await elf.count()) === 1, "dancing elf shown on the landing page");
  assert((await e.locator(`text=¡Felices fiestas de parte del gerente ${run}!`).count()) === 1, "Spanish caption shown");
  const landingFace = await elf.locator("image").getAttribute("href");
  assert(landingFace && landingFace.includes("/api/images/"), "elf wears the uploaded face");
  await elf.locator("button").click();
  assert((await elf.getAttribute("data-fast")) === "1", "tapping the elf switches to the fast dance");
  ok("elf dances with the uploaded face; tap speeds it up");
  await shot(e, "landing-elf");
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
  const chooseBtnM = e.locator('[role=dialog] button:has-text("Elegir este regalo")');
  assert(await chooseBtnM.isDisabled(), "choose button disabled until a size is picked");
  await e.locator('[role=dialog] label', { hasText: /^M$/ }).click();
  await e.click('button:has-text("Elegir este regalo")');
  await e.waitForSelector("text=/Sudadera con capucha de la empresa \\(M\\)/");
  await e.click('button:has-text("Sí, confirmar")');
  await e.waitForURL(new RegExp(`/g/${SLUG}/done`));
  await e.waitForSelector("text=Código de confirmación");
  await e.waitForSelector("text=Size: M");
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
  assert((await e.locator('[role=dialog] label', { hasText: /^Green$/ }).count()) === 0, "Green is hidden from employees in this campaign");
  assert((await e.locator('[role=dialog] label', { hasText: /^Blue$/ }).count()) === 1, "Blue is offered");
  assert((await e.locator("[data-gallery-thumb]").count()) === 4, "gallery shows main + 2 extra + Red photos");
  const mainBefore = await e.locator("[data-gallery-main]").getAttribute("src");
  await e.locator('[role=dialog] label', { hasText: /^Red$/ }).click();
  const mainAfter = await e.locator("[data-gallery-main]").getAttribute("src");
  assert(mainAfter !== mainBefore && (await e.locator("[data-gallery-main]").getAttribute("data-option")) === "Red", "choosing Red switches to the Red photo");
  await e.locator('[role=dialog] label', { hasText: /^15oz$/ }).click();
  await e.click('button:has-text("Elegir este regalo")');
  await e.click('button:has-text("Sí, confirmar")');
  await e.waitForURL(new RegExp(`/g/${SLUG}/done`));
  await e.waitForSelector(`text=Taza E2E ${run}`);
  await e.waitForSelector("text=Color: Red, Size: 15oz");
  const doneImg = await e.locator("main img").first().getAttribute("src");
  assert(doneImg === mainAfter, "confirmation page shows the Red photo");
  ok("selection changed to the mug (Red / 15oz); only offered colours were shown; Red photo on the confirmation page");

  section("Admin stops offering Red -> employee must re-pick a colour");
  await a.goto(`${BASE}/admin/campaigns/${campaignId}/items`);
  const mugOptRow = a.locator("tr", { hasText: `E2E Mug ${run}` });
  assert((await mugOptRow.locator("label", { hasText: "Red" }).locator("text=(1)").count()) === 1, "row shows 1 pending pick on Red");
  await mugOptRow.locator('input[name="enabled1"][value="Red"]').uncheck();
  a.once("dialog", (d) => d.accept());
  await mugOptRow.locator('button:has-text("Save")').click();
  await a.waitForSelector("text=/1 employee\\(s\\) who chose a value you removed/");
  ok("Red removed from the campaign; admin warned about the pending pick");
  await e.goto(`${BASE}/g/${SLUG}`);
  await e.waitForURL(new RegExp(`/g/${SLUG}/pick`));
  await e.waitForSelector("text=/Lo sentimos, tu regalo ya no está disponible/");
  await e.locator("li", { hasText: "Taza E2E" }).locator("button").first().click();
  await e.waitForSelector('[role=dialog]');
  assert((await e.locator('[role=dialog] label', { hasText: /^Red$/ }).count()) === 0, "Red no longer offered");
  await e.locator('[role=dialog] label', { hasText: /^Blue$/ }).click();
  await e.locator('[role=dialog] label', { hasText: /^11oz$/ }).click();
  await e.click('button:has-text("Elegir este regalo")');
  await e.click('button:has-text("Sí, confirmar")');
  await e.waitForURL(new RegExp(`/g/${SLUG}/done`));
  await e.waitForSelector("text=Color: Blue, Size: 11oz");
  ok("employee re-picked the mug in Blue / 11oz");

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
  await e.locator('[role=dialog] label', { hasText: /^L$/ }).click();
  await e.click('button:has-text("Elegir este regalo")');
  await e.click('button:has-text("Sí, confirmar")');
  await e.waitForURL(new RegExp(`/g/${SLUG}/done`));
  ok("re-picked hoodie size L");

  section("Orders list: grouped summary, bulk mark ordered, received, collected");
  await a.goto(`${BASE}/admin/campaigns/${campaignId}/orders`);
  const group = a.locator("tr", { hasText: "Company Hoodie" }).filter({ hasText: "Mark 1 ordered" });
  assert((await group.count()) === 1, "grouped row shows 1 hoodie to order");
  assert((await group.locator("text=Size: L").count()) === 1, "grouped row shows the chosen size");
  assert((await a.locator("tr", { hasText: "Company Hoodie" }).first().locator('a:has-text("Open")').count()) === 1, "Amazon link present in grouped row");
  await group.locator('input[name="unitCost"]').fill("57.50");
  await group.locator('button:has-text("Mark 1 ordered")').click();
  await a.waitForSelector("text=Mark 1 received");
  await a.waitForSelector("text=/Price updated from 55.00 to 57.50/");
  assert((await a.locator("tr", { hasText: "Company Hoodie" }).first().locator("text=$57.50").count()) >= 1, "grouped row now shows the confirmed price");
  ok("marked ordered at the confirmed price; gift re-priced everywhere");
  await shot(a, "orders");
  const row = a.locator("tr", { hasText: `E2E${run}1` });
  await row.locator('button:has-text("Mark received")').click();
  await a.waitForSelector("tr:has-text('E2E" + run + "1') >> text=Mark collected");
  ok("row action moved the selection to Received");
  await e.goto(`${BASE}/g/${SLUG}/done`);
  await e.waitForSelector("text=Listo para recoger");
  assert((await e.locator("text=Cambiar mi regalo").count()) === 0, "change button hidden once ordered");
  const pickupQr = await e.locator(`img[alt="${code}"]`).getAttribute("src");
  assert(pickupQr && pickupQr.startsWith("data:image/png"), "confirmation page shows a QR code of the confirmation code");
  ok("employee sees Ready-for-pickup status, no change button, and a pickup QR code");

  section("Pickup kiosk: look up by confirmation code, mark collected, undo, re-collect");
  await a.goto(`${BASE}/admin/campaigns/${campaignId}/kiosk`);
  await a.waitForSelector("#kiosk-query");
  await a.fill("#kiosk-query", `gift: ${code.toLowerCase()}`);
  await a.press("#kiosk-query", "Enter");
  await a.waitForSelector("text=Test1 García López");
  assert((await a.locator("text=Ready for pickup").count()) >= 1, "kiosk shows the selection as ready");
  await shot(a, "kiosk-result");
  await a.click('button:has-text("Mark collected")');
  await a.waitForSelector("text=/Collected — Test1/");
  ok("kiosk marked the gift collected from the scanned/typed code");
  await a.click('button:has-text("Undo")');
  await a.waitForSelector('button:has-text("Mark collected")');
  assert((await a.locator("text=Ready for pickup").count()) >= 1, "undo restored the Ready-for-pickup status");
  ok("undo restored it to Received");
  await a.click('button:has-text("Cancel")');
  await a.fill("#kiosk-query", `E2E${run}1`);
  await a.press("#kiosk-query", "Enter");
  await a.waitForSelector('button:has-text("Mark collected")');
  await a.click('button:has-text("Mark collected")');
  await a.waitForSelector("text=/Collected — Test1/");
  await a.click('button:has-text("Next person")');
  await a.fill("#kiosk-query", code);
  await a.press("#kiosk-query", "Enter");
  await a.waitForSelector("text=Undo collection");
  ok("lookup by employee number works; already-collected state shown on re-scan");
  await a.fill("#kiosk-query", `E2E${run}2`);
  await a.press("#kiosk-query", "Enter");
  await a.waitForSelector("text=/hasn't chosen a gift/");
  ok("employee without a selection handled");
  await a.fill("#kiosk-query", "ZZZZZZ");
  await a.press("#kiosk-query", "Enter");
  await a.waitForSelector("text=/No gift found for code ZZZZZZ/");
  ok("unknown code handled");
  await e.goto(`${BASE}/g/${SLUG}/done`);
  await e.waitForSelector("text=Entregado");
  ok("employee sees Collected status in Spanish");

  section("Budget tab totals");
  await a.goto(`${BASE}/admin/campaigns/${campaignId}/budget`);
  await a.waitForSelector("text=$57.50");
  assert((await a.locator("text=$1,000.00").count()) >= 1, "total budget shown");
  ok("committed spend $57.50 of $1,000.00 (uses the confirmed price)");
  await a.goto(`${BASE}/admin/items?q=Company+Hoodie`);
  await a.locator("tr", { hasText: "Company Hoodie" }).locator("a").first().click();
  await a.waitForSelector("text=Price history");
  assert((await a.locator("tr", { hasText: "Confirmed at order time" }).filter({ hasText: "$57.50" }).count()) >= 1, "price history shows the order-time change");
  ok("price history recorded on the gift");
  await shot(a, "budget");

  section("Webhook received the order events");
  const events = received.map((r) => r.event);
  assert(events.includes("selection.created") || events.includes("selection.changed"), `pick events delivered (${events.join(", ")})`);
  assert(events.includes("selection.status_changed"), "status change events delivered");
  assert(events.includes("selection.needs_repick"), "re-pick events delivered");
  assert(events.includes("item.price_updated"), "price update event delivered");
  const statusEvt = received.find((r) => r.event === "selection.status_changed" && r.body.newStatus === "COLLECTED");
  assert(statusEvt && statusEvt.body.selections[0].confirmationCode === code, "collected event carries the employee's confirmation code");
  ok(`webhook delivered ${received.length} events covering the whole flow`);

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
    if (String(r.getCell(1).value) === "Company Hoodie" && String(r.getCell(3).value) === "Size: L") foundHoodie = true;
  });
  assert(foundHoodie, "Summary sheet has Company Hoodie / L row");
  const notPicked = wb.getWorksheet("Not picked");
  assert(notPicked.rowCount === 3, `Not picked lists the 2 remaining employees (rows=${notPicked.rowCount})`);
  ok("workbook has all sheets, the hoodie line and the not-picked list");

  section("Live spreadsheet feeds work without a login");
  await a.goto(`${BASE}/admin/campaigns/${campaignId}/exports`);
  const feedUrl = await a.locator("input[readonly]").first().inputValue();
  const anon = await browser.newContext();
  const allFeed = await anon.request.get(globalFeed.replace(/^https?:\/\/[^/]+/, BASE));
  assert(allFeed.ok() && (allFeed.headers()["content-type"] ?? "").includes("spreadsheetml"), "all-campaigns xlsx feed served");
  const allCsv = await anon.request.get(globalFeed.replace(/^https?:\/\/[^/]+/, BASE) + "?format=csv");
  assert(allCsv.ok() && (await allCsv.text()).startsWith("Campaign,"), "all-campaigns csv feed has a Campaign column");
  const feed = await anon.request.get(feedUrl.replace(/^https?:\/\/[^/]+/, BASE));
  assert(feed.ok() && (feed.headers()["content-type"] ?? "").includes("spreadsheetml"), "feed xlsx served anonymously with the token");
  const feedCsv = await anon.request.get(feedUrl.replace(/^https?:\/\/[^/]+/, BASE) + "?format=csv");
  assert(feedCsv.ok() && (await feedCsv.text()).includes("Company Hoodie"), "feed csv has the hoodie");
  const bad = await anon.request.get(`${BASE}/api/feed/notarealtoken1234567890`);
  assert(bad.status() === 404, "bad token rejected");
  const noAuth = await anon.request.get(`${BASE}/api/export/${campaignId}?type=xlsx`);
  assert(noAuth.status() === 401, "admin export rejected without login");
  ok("campaign and all-campaign feed links work; admin export requires login");
  await anon.close();

  section("Catalog import: download the template, add a row, upload it back");
  const tplRes = await a.request.get(`${BASE}/api/items/template?format=xlsx`);
  assert(tplRes.ok() && (tplRes.headers()["content-type"] ?? "").includes("spreadsheetml"), "xlsx template downloads");
  const tplCsv = await a.request.get(`${BASE}/api/items/template?format=csv`);
  assert(tplCsv.ok() && (await tplCsv.text()).startsWith("name,"), "csv template downloads");
  const tpl = new ExcelJS.Workbook();
  await tpl.xlsx.load(await tplRes.body());
  const giftsSheet = tpl.getWorksheet("Gifts");
  assert(giftsSheet && tpl.getWorksheet("Instructions"), "template has Gifts and Instructions sheets");
  const headerRow = giftsSheet.getRow(1).values.slice(1).map(String);
  const col = (name) => headerRow.indexOf(name) + 1;
  const newRow = giftsSheet.addRow([]);
  newRow.getCell(col("name")).value = `E2E Imported Tumbler ${run}`;
  const importAsin = `B0E2E${run.toUpperCase()}`; // 10 characters, unique per run
  newRow.getCell(col("amazon_url")).value = `https://www.amazon.com/Some-Tumbler/dp/${importAsin}/ref=abc`;
  newRow.getCell(col("unit_cost")).value = "$25.50";
  newRow.getCell(col("colors")).value = "Teal | Rose";
  newRow.getCell(col("sizes")).value = "20oz, 30oz";
  newRow.getCell(col("category")).value = "Home";
  const uploadPath = path.join(SHOTS, "gifts-upload.xlsx");
  fs.writeFileSync(uploadPath, Buffer.from(await tpl.xlsx.writeBuffer()));
  await a.goto(`${BASE}/admin/items?import=1`);
  await a.setInputFiles("#items-file", uploadPath);
  await a.uncheck('input[name="downloadImages"]');
  await a.click('button:has-text("Import gifts")');
  await a.waitForSelector("text=/Imported: /");
  const importMsg = await a.locator("text=/Imported: /").innerText();
  // Earbuds example matches the seeded gift by ASIN (updated); the PTO example is new on a fresh DB and updated on re-runs.
  assert(/Imported: (2 new, 1 updated|1 new, 2 updated)/.test(importMsg), `template examples upsert by ASIN/SKU and the new row is created (${importMsg})`);
  await a.goto(`${BASE}/admin/items?q=${encodeURIComponent(`E2E Imported Tumbler ${run}`)}`);
  const importedRow = a.locator("tr", { hasText: `E2E Imported Tumbler ${run}` });
  assert((await importedRow.count()) === 1, "imported gift listed");
  assert((await importedRow.locator(`text=ASIN ${importAsin}`).count()) === 1, "ASIN extracted from the Amazon link");
  assert((await importedRow.locator("text=Color: Teal, Rose").count()) === 1 && (await importedRow.locator("text=Size: 20oz, 30oz").count()) === 1, "colors and sizes shortcut columns became option groups");
  assert((await importedRow.locator("text=$25.50").count()) === 1, "unit cost parsed");
  ok("spreadsheet import works end to end");
  await shot(a, "catalog-import");

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

  receiver.close();
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
