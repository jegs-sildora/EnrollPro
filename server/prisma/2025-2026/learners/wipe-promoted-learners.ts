import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("≡ƒº╣ Wiping seeded promoted learners for 2026-2027...");

  // 1. Get Target School Year
  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
  });

  if (!targetYear) {
    console.log("School year 2026-2027 not found, nothing to wipe.");
    return;
  }

  // 2. Delete enrollment applications with 'PROM-' tracking prefix in target year
  const { count } = await prisma.enrollmentApplication.deleteMany({
    where: {
      schoolYearId: targetYear.id,
      trackingNumber: { startsWith: "PROM-" },
    },
  });

  console.log(`\nΓ£à Successfully wiped ${count} promoted enrollment applications from ${targetYear.yearLabel}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
