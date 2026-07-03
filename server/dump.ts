import { PrismaClient } from "./src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const sys = await prisma.schoolYear.findMany({ select: { id: true, yearLabel: true, status: true, isEosyFinalized: true } });
  console.log(sys);
}
main().finally(() => prisma.$disconnect());
