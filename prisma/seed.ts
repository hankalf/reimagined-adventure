/* Demo data so the portal is useful on first start. Safe to re-run: it skips when a campaign already exists. */
import "dotenv/config";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function placeholder(label: string, bg: string): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900">
  <rect width="100%" height="100%" fill="${bg}"/>
  <circle cx="450" cy="380" r="170" fill="rgba(255,255,255,0.22)"/>
  <text x="50%" y="74%" font-family="Helvetica, Arial, sans-serif" font-size="56" font-weight="700" fill="#fff" text-anchor="middle">${label.replace(/&/g, "&amp;")}</text>
</svg>`;
  const base = sharp(Buffer.from(svg));
  const data = await base.clone().webp({ quality: 85 }).toBuffer();
  const thumb = await sharp(Buffer.from(svg)).resize(480, 480).webp({ quality: 80 }).toBuffer();
  const img = await db.image.create({ data: { mime: "image/webp", data: Uint8Array.from(data), thumb: Uint8Array.from(thumb), width: 900, height: 900 } });
  return img.id;
}

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMe-12345";
  if ((await db.adminUser.count()) === 0) {
    await db.adminUser.create({ data: { email: adminEmail, name: "Administrator", role: "ADMIN", passwordHash: await bcrypt.hash(adminPassword, 12) } });
    console.log(`Created admin ${adminEmail}`);
  }

  if ((await db.campaign.count()) > 0) {
    console.log("Campaign already exists; skipping demo data.");
    return;
  }

  const employees = [
    ["10001", "Maria", "García", "Operations", null],
    ["10002", "James", "Smith", "Finance", null],
    ["10003", "Ana", "de la Cruz", "Operations", null],
    ["10004", "Wei", "Chen", "Engineering", 150],
    ["10005", "Fatima", "Al-Sayed", "Engineering", null],
    ["10006", "Daniel", "O'Brien", "Sales", null],
    ["10007", "Priya", "Patel", "Human Resources", 150],
    ["10008", "Luis", "Hernández López", "Warehouse", null],
    ["10009", "Emily", "Johnson", "Marketing", null],
    ["10010", "Tomás", "Nuñez", "Warehouse", null],
    ["10011", "Grace", "Kim", "Customer Support", null],
    ["10012", "Omar", "Haddad", "Sales", 250],
  ] as const;

  const created = [] as { id: string; employeeNumber: string; budget: number | null }[];
  for (const [num, first, last, dept, budget] of employees) {
    const e = await db.employee.create({ data: { employeeNumber: num, firstName: first, lastName: last, department: dept } });
    created.push({ id: e.id, employeeNumber: num, budget });
  }

  const items = [
    { name: "Wireless Noise-Cancelling Earbuds", nameEs: "Audífonos inalámbricos con cancelación de ruido", description: "Compact true-wireless earbuds with active noise cancelling and a charging case.", descriptionEs: "Audífonos compactos con cancelación activa de ruido y estuche de carga.", category: "Tech", asin: "B0CHWRXH8B", productUrl: "https://www.amazon.com/dp/B0CHWRXH8B", unitCost: 69.99, color: "#2563eb", label: "Earbuds" },
    { name: "Insulated Travel Tumbler 40 oz", nameEs: "Vaso térmico de viaje 40 oz", description: "Keeps drinks cold for 11 hours and hot for 7. Fits most cup holders.", descriptionEs: "Mantiene las bebidas frías 11 horas y calientes 7. Cabe en la mayoría de portavasos.", category: "Home", asin: "B0BZYCJK89", productUrl: "https://www.amazon.com/dp/B0BZYCJK89", unitCost: 45.0, optionLabel: "Color", optionValues: ["Black", "Cream", "Teal", "Rose"], color: "#0f766e", label: "Tumbler" },
    { name: "Company Hoodie", nameEs: "Sudadera con capucha de la empresa", description: "Soft fleece hoodie with embroidered logo. Unisex sizing.", descriptionEs: "Sudadera de felpa suave con logo bordado. Tallas unisex.", category: "Apparel", asin: null, productUrl: "https://www.amazon.com/dp/B07P5RTMQ6", unitCost: 55.0, optionLabel: "Color", optionValues: ["Black", "Navy", "Heather Grey"], option2Label: "Size", option2Values: ["S", "M", "L", "XL", "2XL", "3XL"], color: "#7c3aed", label: "Hoodie" },
    { name: "Smart Speaker with Voice Assistant", nameEs: "Bocina inteligente con asistente de voz", description: "Compact smart speaker with rich sound. Great for the kitchen or desk.", descriptionEs: "Bocina inteligente compacta con sonido envolvente. Ideal para la cocina o el escritorio.", category: "Tech", asin: "B09B8V1LZ3", productUrl: "https://www.amazon.com/dp/B09B8V1LZ3", unitCost: 49.99, color: "#be123c", label: "Speaker" },
    { name: "Weekender Backpack", nameEs: "Mochila de fin de semana", description: "Water-resistant 30L backpack with laptop sleeve and shoe compartment.", descriptionEs: "Mochila de 30 L resistente al agua con funda para laptop y compartimento para zapatos.", category: "Travel", asin: "B08KFWF6GC", productUrl: "https://www.amazon.com/dp/B08KFWF6GC", unitCost: 72.5, optionLabel: "Color", optionValues: ["Black", "Navy", "Olive"], color: "#ca8a04", label: "Backpack" },
    { name: "Percussion Massage Gun", nameEs: "Pistola de masaje de percusión", description: "Deep-tissue massager with 5 heads and a quiet motor.", descriptionEs: "Masajeador de tejido profundo con 5 cabezales y motor silencioso.", category: "Wellness", asin: "B07ZK7ZRJ2", productUrl: "https://www.amazon.com/dp/B07ZK7ZRJ2", unitCost: 74.0, color: "#ea580c", label: "Massage" },
    { name: "Cast Iron Skillet Set", nameEs: "Juego de sartenes de hierro fundido", description: "Pre-seasoned 10\" and 12\" skillets. A kitchen classic.", descriptionEs: "Sartenes pre-curadas de 10\" y 12\". Un clásico de la cocina.", category: "Home", asin: "B00006JSUA", productUrl: "https://www.amazon.com/dp/B00006JSUA", unitCost: 59.95, color: "#475569", label: "Skillets" },
    { name: "Premium Wireless Headphones", nameEs: "Audífonos inalámbricos premium", description: "Over-ear headphones with 40-hour battery. For the audiophiles (manager tier).", descriptionEs: "Audífonos over-ear con 40 horas de batería. Para los audiófilos (nivel gerencial).", category: "Tech", asin: "B0863TXGM3", productUrl: "https://www.amazon.com/dp/B0863TXGM3", unitCost: 149.0, color: "#1e293b", label: "Headphones" },
  ];
  const itemIds: string[] = [];
  for (const it of items) {
    const imageId = await placeholder(it.label, it.color);
    const row = await db.item.create({
      data: {
        type: "PRODUCT",
        name: it.name,
        nameEs: it.nameEs,
        description: it.description,
        descriptionEs: it.descriptionEs,
        category: it.category,
        imageId,
        asin: it.asin,
        productUrl: it.productUrl,
        unitCost: it.unitCost,
        option1Label: it.optionLabel ?? null,
        option1Values: it.optionValues ?? [],
        option2Label: "option2Label" in it ? it.option2Label : null,
        option2Values: "option2Values" in it ? it.option2Values : [],
      },
    });
    itemIds.push(row.id);
  }
  const ptoImage = await placeholder("4h PTO", "#16a34a");
  const pto = await db.item.create({
    data: {
      type: "CUSTOM",
      name: "4 hours of paid time off",
      nameEs: "4 horas de tiempo libre pagado",
      description: "Take a long lunch, leave early on a Friday or sleep in. Coordinate the date with your manager.",
      descriptionEs: "Tómate un almuerzo largo, sal temprano un viernes o duerme más. Coordina la fecha con tu gerente.",
      category: "Perks",
      imageId: ptoImage,
      unitCost: 0,
      fulfillmentNote: "HR adds 4 hours of PTO to the employee's balance in the payroll system and emails the manager.",
    },
  });
  itemIds.push(pto.id);

  const campaign = await db.campaign.create({
    data: {
      slug: "holiday-2026",
      name: "Holiday Gifts 2026",
      status: "OPEN",
      closesAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      hrEmails: ["hr@example.com"],
      welcomeHeadline: "Happy holidays! Pick your gift",
      welcomeHeadlineEs: "¡Felices fiestas! Elige tu regalo",
      welcomeMessage: "Thank you for an amazing year. Choose one gift below as a small token of our appreciation.",
      welcomeMessageEs: "Gracias por un año increíble. Elige un regalo como una pequeña muestra de nuestro agradecimiento.",
      pickupInstructions: "Gifts will be available for pickup at the front desk starting December 15. Bring your badge.",
      pickupInstructionsEs: "Los regalos estarán disponibles para recoger en la recepción a partir del 15 de diciembre. Trae tu gafete.",
      leadershipMessage: "Your hard work made this year our best yet. Enjoy your gift, and enjoy the time with your families.",
      leadershipMessageEs: "Su esfuerzo hizo de este año el mejor hasta ahora. Disfruten su regalo y el tiempo con sus familias.",
      leadershipName: "Dana Reyes, CEO",
      primaryColor: "#0f766e",
      accentColor: "#f59e0b",
      companyName: "Acme Logistics",
      totalBudget: 1200,
      defaultEmployeeBudget: 75,
      hideItemsOverBudget: false,
      items: { create: itemIds.map((itemId, i) => ({ itemId, sortOrder: i, stockLimit: i === 5 ? 2 : null })) },
      employees: { create: created.filter((e) => e.budget !== null).map((e) => ({ employeeId: e.id, budgetOverride: e.budget })) },
    },
  });

  // A few existing selections so the dashboard and orders list have data.
  const byNum = Object.fromEntries(created.map((e) => [e.employeeNumber, e.id]));
  await db.selection.createMany({
    data: [
      { campaignId: campaign.id, employeeId: byNum["10002"], itemId: itemIds[1], option1Value: "Teal", confirmationCode: "DEMO01", costAtSelection: 45, status: "SELECTED" },
      { campaignId: campaign.id, employeeId: byNum["10005"], itemId: itemIds[0], confirmationCode: "DEMO02", costAtSelection: 69.99, status: "ORDERED", orderedAt: new Date() },
      { campaignId: campaign.id, employeeId: byNum["10009"], itemId: pto.id, confirmationCode: "DEMO03", costAtSelection: 0, status: "SELECTED" },
    ],
  });

  console.log(`Seeded campaign "${campaign.name}" at /g/${campaign.slug} with ${created.length} employees and ${itemIds.length} gifts.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
