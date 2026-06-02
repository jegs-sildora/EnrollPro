import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Resets EOSY grade data for incoming enrolled learners (ENR-* tracking numbers)
 * seeded by seed-eosy-grades-incoming.ts.
 *
 * Targets the most recent non-archived school year and resets only
 * enrollment records linked to ENR- applications.
 *
 * What is reset (fields cleared, NOT records deleted):
 *   - EnrollmentRecord.eosyStatus → null
 *   - EnrollmentRecord.sf1Remarks → null
 *   - EnrollmentRecord.finalAverage → null
 *   - Learner.promotionStatus → null (for affected learners only)
 *
 * Sections are NOT reset here (seed-eosy-grades-incoming does not
 * finalize sections — that is handled by seed-eosy-grades.ts).
 */
async function main() {
  console.log(
    "🗑️  Resetting EOSY grades for incoming enrolled learners (ENR-*)...\n",
  );

  const activeYear = await prisma.schoolYear.findFirst({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { id: "desc" },
  });

  if (!activeYear) {
    console.log("⚠️  No active school year found. Nothing to reset.");
    return;
  }

  console.log(`Target SY: ${activeYear.yearLabel}`);

  // Find enrollment records for ENR- applications in the active SY
  const records = await prisma.enrollmentRecord.findMany({
    where: {
      schoolYearId: activeYear.id,
      enrollmentApplication: {
        trackingNumber: { startsWith: "ENR-" },
      },
    },
    select: {
      id: true,
      enrollmentApplication: { select: { learnerId: true } },
    },
  });

  if (records.length === 0) {
    console.log(
      "No ENR- enrollment records found for this school year. Nothing to reset.",
    );
    return;
  }

  const recordIds = records.map((r) => r.id);
  const learnerIds = [
    ...new Set(
      records
        .filter((r) => r.enrollmentApplication.learnerId != null)
        .map((r) => r.enrollmentApplication.learnerId as number),
    ),
  ];

  console.log(
    `Found ${recordIds.length} ENR- enrollment records across ${learnerIds.length} learners.`,
  );

  // 1. Reset EOSY fields on those specific enrollment records
  const er = await prisma.enrollmentRecord.updateMany({
    where: { id: { in: recordIds } },
    data: {
      eosyStatus: null,
      sf1Remarks: null,
      finalAverage: null,
    },
  });
  console.log(`✓ Reset EOSY fields on ${er.count} enrollment records.`);

  // 2. Reset promotionStatus on affected learners
  const lr = await prisma.learner.updateMany({
    where: { id: { in: learnerIds } },
    data: { promotionStatus: null },
  });
  console.log(`✓ Reset promotionStatus on ${lr.count} learners.`);

  console.log(
    "\n✅ EOSY grades for incoming enrolled learners reset successfully.",
  );
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
