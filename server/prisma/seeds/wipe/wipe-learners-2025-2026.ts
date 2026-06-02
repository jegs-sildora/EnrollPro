import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Wipes all learner/application data for SY 2025-2026.
 *
 * What is deleted:
 *   - EnrollmentRecord (schoolYearId = 2025-2026)
 *   - Sub-records of EnrollmentApplication (PreviousSchool, ProgramDetail,
 *     Address, FamilyMember, Checklist) scoped to 2025-2026 applications
 *   - EarlyRegistrationAssessment for 2025-2026 early-reg apps
 *   - EnrollmentApplication (schoolYearId = 2025-2026)
 *   - EarlyRegistrationApplication (schoolYearId = 2025-2026)
 *   - HealthRecord (schoolYearId = 2025-2026)
 *   - Learner records that have NO remaining applications in ANY school year
 *
 * What is preserved:
 *   - Learners that have applications in 2026-2027 (transition data)
 *   - Users, Teachers, SchoolYear, GradeLevel, Section, SCP configs
 */
async function main() {
  console.log("🗑️  Wiping SY 2025-2026 learner and application data...\n");

  const sy = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2025-2026" },
  });

  if (!sy) {
    console.log("⚠️  School year 2025-2026 not found. Nothing to wipe.");
    return;
  }

  // Pre-fetch application IDs so we can scope sub-record deletes
  const enrollmentAppIds = (
    await prisma.enrollmentApplication.findMany({
      where: { schoolYearId: sy.id },
      select: { id: true },
    })
  ).map((a) => a.id);

  const earlyRegAppIds = (
    await prisma.earlyRegistrationApplication.findMany({
      where: { schoolYearId: sy.id },
      select: { id: true },
    })
  ).map((a) => a.id);

  console.log(
    `Found ${enrollmentAppIds.length} enrollment applications and ${earlyRegAppIds.length} early-reg applications for 2025-2026.`,
  );

  await prisma.$transaction(
    async (tx) => {
      // 1. Enrollment records (depend on EnrollmentApplication + Section)
      const er = await tx.enrollmentRecord.deleteMany({
        where: { schoolYearId: sy.id },
      });
      console.log(`✓ Deleted ${er.count} enrollment records.`);

      // 2. EnrollmentApplication sub-records (field names from schema)
      const eps = await tx.enrollmentPreviousSchool.deleteMany({
        where: { applicationId: { in: enrollmentAppIds } },
      });
      console.log(`✓ Deleted ${eps.count} previous school records.`);

      const epd = await tx.enrollmentProgramDetail.deleteMany({
        where: { applicationId: { in: enrollmentAppIds } },
      });
      console.log(`✓ Deleted ${epd.count} program details.`);

      const aa = await tx.applicationAddress.deleteMany({
        where: { enrollmentId: { in: enrollmentAppIds } },
      });
      console.log(`✓ Deleted ${aa.count} enrollment application addresses.`);

      const afm = await tx.applicationFamilyMember.deleteMany({
        where: { enrollmentId: { in: enrollmentAppIds } },
      });
      console.log(`✓ Deleted ${afm.count} enrollment family member records.`);

      const ac = await tx.applicationChecklist.deleteMany({
        where: { enrollmentId: { in: enrollmentAppIds } },
      });
      console.log(`✓ Deleted ${ac.count} enrollment application checklists.`);

      // 3. EarlyRegistration sub-records (field names from schema)
      const era = await tx.earlyRegistrationAssessment.deleteMany({
        where: { applicationId: { in: earlyRegAppIds } },
      });
      console.log(`✓ Deleted ${era.count} early-reg assessments.`);

      const eaa = await tx.applicationAddress.deleteMany({
        where: { earlyRegistrationId: { in: earlyRegAppIds } },
      });
      console.log(`✓ Deleted ${eaa.count} early-reg application addresses.`);

      const eafm = await tx.applicationFamilyMember.deleteMany({
        where: { earlyRegistrationId: { in: earlyRegAppIds } },
      });
      console.log(`✓ Deleted ${eafm.count} early-reg family member records.`);

      const eac = await tx.applicationChecklist.deleteMany({
        where: { earlyRegistrationId: { in: earlyRegAppIds } },
      });
      console.log(`✓ Deleted ${eac.count} early-reg application checklists.`);

      // 4. Main application records
      const ea = await tx.enrollmentApplication.deleteMany({
        where: { schoolYearId: sy.id },
      });
      console.log(`✓ Deleted ${ea.count} enrollment applications.`);

      const erap = await tx.earlyRegistrationApplication.deleteMany({
        where: { schoolYearId: sy.id },
      });
      console.log(`✓ Deleted ${erap.count} early-reg applications.`);

      // 5. Health records scoped to this SY
      const hr = await tx.healthRecord.deleteMany({
        where: { schoolYearId: sy.id },
      });
      console.log(`✓ Deleted ${hr.count} health records.`);

      // 6. Delete learners that have NO remaining applications in any SY
      //    (i.e., orphaned after 2025-2026 data was removed)
      const remainingEnrollmentLearnerIds = (
        await tx.enrollmentApplication.findMany({
          select: { learnerId: true },
        })
      )
        .filter((a) => a.learnerId != null)
        .map((a) => a.learnerId as number);

      const remainingEarlyRegLearnerIds = (
        await tx.earlyRegistrationApplication.findMany({
          select: { learnerId: true },
        })
      )
        .filter((a) => a.learnerId != null)
        .map((a) => a.learnerId as number);

      const allRemainingLearnerIds = [
        ...new Set([
          ...remainingEnrollmentLearnerIds,
          ...remainingEarlyRegLearnerIds,
        ]),
      ];

      const lr = await tx.learner.deleteMany({
        where: { id: { notIn: allRemainingLearnerIds } },
      });
      console.log(
        `✓ Deleted ${lr.count} orphaned learners (no remaining applications).`,
      );
    },
    { timeout: 60000 },
  );

  console.log("\n✅ SY 2025-2026 learner data wiped successfully.");
  console.log(
    "   Learners with applications in other school years are preserved.",
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
