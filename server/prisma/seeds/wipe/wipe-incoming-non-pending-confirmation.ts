/**
 * wipe-incoming-non-pending-confirmation.ts
 *
 * Testing utility: removes ALL incoming Grade 7 enrollment applications for
 * SY 2026-2027 that are NOT at PENDING_CONFIRMATION status, regardless of
 * admission channel (F2F or ONLINE) or learner type.
 *
 * This covers every intake path:
 *   - Walk-in F2F (BEEF / BEC lane)
 *   - Online / early-registration-converted applications
 *   - Any seeded batch-sectioning test data
 *
 * Preserved statuses (NOT touched):
 *   PENDING_CONFIRMATION
 *
 * Everything else is wiped — including SUBMITTED_BEEF, AWAITING_VERIFICATION,
 * VERIFIED, UNDER_REVIEW, READY_FOR_ENROLLMENT, FOR_REVISION,
 * READY_FOR_SECTIONING, ENROLLED, CANCELLED, etc.
 *
 * Learner records are also removed when the learner has no other enrollment
 * application remaining after the wipe (i.e. they were created solely for
 * this test cycle).
 *
 * Usage:
 *   pnpm --filter server run db:wipe-incoming-non-pending-confirmation
 */

import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(
    "Wiping ALL incoming Grade 7 non-PENDING_CONFIRMATION applications for SY 2026-2027...",
  );

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
  });

  if (!targetYear) {
    console.log("SY 2026-2027 not found. Nothing to wipe.");
    return;
  }

  const grade7 = await prisma.gradeLevel.findFirst({
    where: { name: "Grade 7" },
  });

  if (!grade7) {
    console.log("Grade 7 not found. Nothing to wipe.");
    return;
  }

  // Fetch ALL Grade 7 applications for SY 2026-2027 that are NOT PENDING_CONFIRMATION.
  // No channel or learner-type filter — covers F2F walk-in, ONLINE, and seeded data.
  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId: targetYear.id,
      gradeLevelId: grade7.id,
      NOT: { status: { equals: "PENDING_CONFIRMATION" } },
    },
    select: {
      id: true,
      learnerId: true,
      status: true,
      admissionChannel: true,
      learner: { select: { lrn: true, firstName: true, lastName: true } },
    },
  });

  if (applications.length === 0) {
    console.log("No matching applications found. Nothing to wipe.");
    return;
  }

  console.log(`Found ${applications.length} application(s) to remove:`);
  for (const a of applications) {
    console.log(
      `  #${a.id}  ${a.learner.lastName}, ${a.learner.firstName}` +
      `  (status: ${a.status}, channel: ${a.admissionChannel ?? "none"}, lrn: ${a.learner.lrn ?? "none"})`,
    );
  }

  const appIds = applications.map((a) => a.id);
  const candidateLearnerIds = Array.from(new Set(applications.map((a) => a.learnerId)));

  // A learner is safe to delete only if they have no remaining applications
  // after this wipe (e.g., no application in another school year or a kept
  // PENDING_CONFIRMATION record for the same year).
  const learnersWithRemainingApps = await prisma.enrollmentApplication.findMany({
    where: {
      learnerId: { in: candidateLearnerIds },
      id: { notIn: appIds }, // apps we are NOT deleting
    },
    select: { learnerId: true },
  });
  const keepLearnerIds = new Set(learnersWithRemainingApps.map((r) => r.learnerId));
  const learnerIdsToDelete = candidateLearnerIds.filter((id) => !keepLearnerIds.has(id));

  await prisma.$transaction(async (tx) => {
    // Remove child records manually (belt-and-suspenders; most have DB-level cascade)
    await tx.enrollmentRecord.deleteMany({
      where: { enrollmentApplicationId: { in: appIds } },
    });
    await tx.applicationFamilyMember.deleteMany({
      where: { enrollmentId: { in: appIds } },
    });
    await tx.applicationChecklist.deleteMany({
      where: { enrollmentId: { in: appIds } },
    });
    await tx.enrollmentPreviousSchool.deleteMany({
      where: { applicationId: { in: appIds } },
    });
    await tx.enrollmentProgramDetail.deleteMany({
      where: { applicationId: { in: appIds } },
    });
    await tx.applicationAddress.deleteMany({
      where: { enrollmentId: { in: appIds } },
    });

    // Remove the enrollment applications
    const deleted = await tx.enrollmentApplication.deleteMany({
      where: { id: { in: appIds } },
    });

    // Remove learners that have no other applications left
    let deletedLearners = 0;
    if (learnerIdsToDelete.length > 0) {
      const result = await tx.learner.deleteMany({
        where: { id: { in: learnerIdsToDelete } },
      });
      deletedLearners = result.count;
    }

    console.log(`\nDeleted ${deleted.count} application(s).`);
    console.log(`Deleted ${deletedLearners} learner record(s) with no remaining applications.`);
    console.log(`Kept ${keepLearnerIds.size} learner record(s) that have other applications.`);
  });

  console.log("Wipe complete!");
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
