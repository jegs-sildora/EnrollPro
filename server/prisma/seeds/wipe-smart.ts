import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const result2 = await prisma.smartLearningAreaResult.deleteMany();
  const result = await prisma.smartAcademicOutcome.deleteMany();
  console.log(`Deleted ${result.count} smart academic outcomes and ${result2.count} learning area results`);
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
