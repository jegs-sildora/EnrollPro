import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 Wiping EOSY mock grades for 2028-2029...");

  const activeSchoolYear = await prisma.schoolYear.findFirst({
    where: { yearLabel: "2028-2029" },
  });

  if (!activeSchoolYear) {
    console.error("❌ No school year found for 2028-2029.");
    return;
  }

  const result = await prisma.enrollmentRecord.updateMany({
    where: { schoolYearId: activeSchoolYear.id },
    data: {
      finalAverage: null,
      eosyStatus: null,
    },
  });

  const enrolledLearners = await prisma.enrollmentRecord.findMany({
    where: { schoolYearId: activeSchoolYear.id },
    select: { learnerId: true },
  });

  const learnerIds = enrolledLearners.map((r) => r.learnerId);

  const learnerResult = await prisma.learner.updateMany({
    where: { id: { in: learnerIds } },
    data: {
      status: "ACTIVE",
    },
  });

  const sectionsResult = await prisma.section.updateMany({
    where: { schoolYearId: activeSchoolYear.id },
    data: {
      isEosyFinalized: false,
    },
  });

  await prisma.schoolYear.update({
    where: { id: activeSchoolYear.id },
    data: {
      isEosyFinalized: false,
    },
  });

  console.log(`✅ Reset ${result.count} enrollment records for SY ${activeSchoolYear.yearLabel}.`);
  console.log(`✅ Reset ${learnerResult.count} learner statuses to ACTIVE.`);
  console.log(`✅ Reset finalization status for ${sectionsResult.count} sections and the school year.`);
}

main()
  .catch((e) => {
    console.error("❌ Failed to wipe EOSY mock data for 2028-2029:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
