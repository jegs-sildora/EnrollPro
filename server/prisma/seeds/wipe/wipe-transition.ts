import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Wipes the SY 2025-2026 → 2026-2027 transition data created by
 * seed-transition.ts.
 *
 * What is deleted (all scoped to SY 2026-2027, REG-2026- prefix):
 *   - EnrollmentRecord (linked to REG-2026- applications)
 *   - EnrollmentApplication (trackingNumber starts with "REG-2026-")
 *
 * What is reset:
 *   - Learner.status: "JHS_COMPLETER" → "ENROLLED"
 *     (Grade 10 graduates set by seed-transition are reverted so that
 *      re-running seed-transition will process them correctly)
 *
 * What is preserved:
 *   - SY 2025-2026 learner/enrollment data (the source for re-transition)
 *   - 2026-2027 sections and teacher designations (seeded by seed-2026-2027.ts)
 *   - SCP configs for 2026-2027 (seeded by seed-scp-configs.ts)
 *
 * After running this, you can safely re-run seed-transition.ts.
 */
async function main() {
  console.log("🗑️  Wiping SY 2025-2026 → 2026-2027 transition data...\n");

  const sy = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
  });

  if (!sy) {
    console.log("⚠️  School year 2026-2027 not found. Nothing to wipe.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    // 1. Enrollment records for REG-2026- applications in 2026-2027
    const er = await tx.enrollmentRecord.deleteMany({
      where: {
        schoolYearId: sy.id,
        enrollmentApplication: {
          trackingNumber: { startsWith: "REG-2026-" },
        },
      },
    });
    console.log(`✓ Deleted ${er.count} enrollment records.`);

    // 2. Enrollment applications (REG-2026- = created by seed-transition)
    const ea = await tx.enrollmentApplication.deleteMany({
      where: {
        schoolYearId: sy.id,
        trackingNumber: { startsWith: "REG-2026-" },
      },
    });
    console.log(`✓ Deleted ${ea.count} enrollment applications.`);

    // 3. Reset Grade 10 graduates that were marked JHS_COMPLETER back to ENROLLED
    //    so seed-transition.ts can process them again
    const lr = await tx.learner.updateMany({
      where: { status: "JHS_COMPLETER" },
      data: { status: "ACTIVE" },
    });
    console.log(`✓ Reset ${lr.count} JHS_COMPLETER learners → ACTIVE.`);
  });

  console.log(
    "\n✅ Transition data wiped. SY 2025-2026 learner data is intact.",
  );
  console.log("   2026-2027 sections and SCP configs are preserved.");
  console.log("   Re-run db:seed-transition to repopulate.");
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
