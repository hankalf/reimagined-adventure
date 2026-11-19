import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var __gpPrisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg({ connectionString, max: 10 });
  return new PrismaClient({ adapter, log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
}

export const db: PrismaClient = globalThis.__gpPrisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__gpPrisma = db;

export * from "@/generated/prisma/enums";
export type { Prisma } from "@/generated/prisma/client";
