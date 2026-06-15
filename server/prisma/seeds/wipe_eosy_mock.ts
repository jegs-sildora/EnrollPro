import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 Wiping EOSY mock grades...");

  const activeSchoolYear = await prisma.schoolYear.findFirst({
    where: { status: "ACTIVE" },
  });

  if (!activeSchoolYear) {
    console.error("❌ No ACTIVE school year found.");
    return;
  }

  const result = await prisma.enrollmentRecord.updateMany({
    where: { schoolYearId: activeSchoolYear.id },
    data: {
      finalAverage: null,
      eosyStatus: null,
    },
  });

  console.log(`✅ Reset ${result.count} enrollment records for SY ${activeSchoolYear.yearLabel}.`);
}

main()
  .catch((e) => {
    console.error("❌ Failed to wipe EOSY mock data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
