import "dotenv/config";
import {
  PrismaClient,
  ApplicationStatus,
  LearnerType,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Reverts all CONTINUING learner applications in SY 2026-2027 back to
 * PENDING_CONFIRMATION so the full BOSY confirmation flow can be re-tested.
 *
 * Steps performed (in a single transaction):
 *  1. Delete EnrollmentRecord rows linked to CONTINUING applications in 2026-2027
 *     (removes any sectioning/enrollment that happened after confirmation).
 *  2. Reset EnrollmentApplication.status  → PENDING_CONFIRMATION
 *     Reset EnrollmentApplication.confirmationConsent → false
 *     for every CONTINUING learner in 2026-2027.
 */
async function main() {
  console.log(
    "🔄 Reverting SY 2026-2027 CONTINUING learners to PENDING_CONFIRMATION...",
  );

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
    select: { id: true, yearLabel: true },
  });

  if (!targetYear) {
    throw new Error(
      "School year 2026-2027 not found. Run the 2026-2027 infrastructure seed first.",
    );
  }

  const syId = targetYear.id;
  console.log(`🎯 Target SY: ${targetYear.yearLabel} (id=${syId})`);

  const { deletedRecords, resetCount } = await prisma.$transaction(
    async (tx) => {
      // 1. Remove EnrollmentRecord entries for CONTINUING applications so that
      //    sectioned learners are returned to an un-sectioned state.
      const { count: deletedRecords } = await tx.enrollmentRecord.deleteMany({
        where: {
          schoolYearId: syId,
          enrollmentApplication: {
            learnerType: LearnerType.CONTINUING,
          },
        },
      });

      // 2. Reset all CONTINUING applications back to PENDING_CONFIRMATION.
      const { count: resetCount } = await tx.enrollmentApplication.updateMany({
        where: {
          schoolYearId: syId,
          learnerType: LearnerType.CONTINUING,
        },
        data: {
          status: ApplicationStatus.PENDING_CONFIRMATION,
          confirmationConsent: false,
        },
      });

      return { deletedRecords, resetCount };
    },
  );

  console.log(`🗑️  Deleted ${deletedRecords} EnrollmentRecord(s).`);
  console.log(
    `✅ Reset ${resetCount} CONTINUING application(s) to PENDING_CONFIRMATION.`,
  );
  console.log("Done. BOSY confirmation list is ready for testing.");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
