import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Resets EOSY grade data for SY 2025-2026 seeded by seed-eosy-grades.ts.
 *
 * What is reset (fields cleared, NOT records deleted):
 *   - EnrollmentRecord.eosyStatus → null
 *   - EnrollmentRecord.sf1Remarks → null
 *   - EnrollmentRecord.finalAverage → null
 *   - Section.isEosyFinalized → false
 *   - Learner.promotionStatus → null (for learners in this SY)
 *
 * After running this, seed-eosy-grades.ts can be re-applied cleanly.
 */
async function main() {
  console.log("🗑️  Resetting EOSY grades for SY 2025-2026...\n");

  const sy = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2025-2026" },
  });

  if (!sy) {
    console.log("⚠️  School year 2025-2026 not found. Nothing to reset.");
    return;
  }

  // Collect affected learner IDs before resetting enrollment records
  const affectedRecords = await prisma.enrollmentRecord.findMany({
    where: { schoolYearId: sy.id },
    select: {
      enrollmentApplication: { select: { learnerId: true } },
    },
  });

  const learnerIds = [
    ...new Set(
      affectedRecords
        .filter((r) => r.enrollmentApplication.learnerId != null)
        .map((r) => r.enrollmentApplication.learnerId as number),
    ),
  ];

  // 1. Reset EOSY fields on enrollment records
  const er = await prisma.enrollmentRecord.updateMany({
    where: { schoolYearId: sy.id },
    data: {
      eosyStatus: null,
      sf1Remarks: null,
      finalAverage: null,
    },
  });
  console.log(`✓ Reset EOSY fields on ${er.count} enrollment records.`);

  // 2. Reset isEosyFinalized on all sections for this SY
  const sec = await prisma.section.updateMany({
    where: { schoolYearId: sy.id },
    data: { isEosyFinalized: false },
  });
  console.log(`✓ Reset isEosyFinalized on ${sec.count} sections.`);

  // 3. Reset promotionStatus on affected learners
  const lr = await prisma.learner.updateMany({
    where: { id: { in: learnerIds } },
    data: { promotionStatus: null },
  });
  console.log(`✓ Reset promotionStatus on ${lr.count} learners.`);

  console.log("\n✅ EOSY grades for SY 2025-2026 reset successfully.");
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
