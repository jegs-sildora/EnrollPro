import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TRACKING_PREFIX = "STE-2026";
const EARLY_REG_PREFIX = "STE-2026";
const LEGACY_TRACKING_PREFIX = "STE70-DEMO-2627";
const LEGACY_EARLY_REG_PREFIX = "STE70-ER-2627";

async function main() {
  console.log("Wiping STE Top 70 incoming demo seed data...");

  const seededEnrollments = await prisma.enrollmentApplication.findMany({
    where: {
      OR: [
        { trackingNumber: { startsWith: `${TRACKING_PREFIX}-` } },
        { trackingNumber: { startsWith: `${LEGACY_TRACKING_PREFIX}-` } },
      ],
    },
    select: {
      id: true,
      learnerId: true,
      earlyRegistrationId: true,
    },
  });

  const seededEarlyRegs = await prisma.earlyRegistrationApplication.findMany({
    where: {
      OR: [
        { trackingNumber: { startsWith: `${EARLY_REG_PREFIX}-` } },
        { trackingNumber: { startsWith: `${LEGACY_EARLY_REG_PREFIX}-` } },
      ],
    },
    select: {
      id: true,
      learnerId: true,
    },
  });

  if (seededEnrollments.length === 0 && seededEarlyRegs.length === 0) {
    console.log("No STE Top 70 demo rows found. Nothing to wipe.");
    return;
  }

  const enrollmentIds = seededEnrollments.map((row) => row.id);
  const earlyRegIds = Array.from(
    new Set([
      ...seededEarlyRegs.map((row) => row.id),
      ...seededEnrollments
        .map((row) => row.earlyRegistrationId)
        .filter((id): id is number => id !== null),
    ]),
  );

  const candidateLearnerIds = Array.from(
    new Set([
      ...seededEnrollments.map((row) => row.learnerId),
      ...seededEarlyRegs.map((row) => row.learnerId),
    ]),
  );

  const remainingEnrollmentLearners = candidateLearnerIds.length
    ? await prisma.enrollmentApplication.findMany({
        where: {
          learnerId: { in: candidateLearnerIds },
          id: { notIn: enrollmentIds.length > 0 ? enrollmentIds : [-1] },
        },
        select: { learnerId: true },
      })
    : [];

  const remainingEarlyRegLearners = candidateLearnerIds.length
    ? await prisma.earlyRegistrationApplication.findMany({
        where: {
          learnerId: { in: candidateLearnerIds },
          id: { notIn: earlyRegIds.length > 0 ? earlyRegIds : [-1] },
        },
        select: { learnerId: true },
      })
    : [];

  const keepLearnerIds = new Set<number>([
    ...remainingEnrollmentLearners.map((row) => row.learnerId),
    ...remainingEarlyRegLearners.map((row) => row.learnerId),
  ]);

  const learnerIdsToDelete = candidateLearnerIds.filter(
    (id) => !keepLearnerIds.has(id),
  );

  await prisma.$transaction(async (tx) => {
    if (enrollmentIds.length > 0) {
      await tx.enrollmentRecord.deleteMany({
        where: { enrollmentApplicationId: { in: enrollmentIds } },
      });

      await tx.applicationFamilyMember.deleteMany({
        where: { enrollmentId: { in: enrollmentIds } },
      });

      await tx.applicationChecklist.deleteMany({
        where: { enrollmentId: { in: enrollmentIds } },
      });

      await tx.enrollmentPreviousSchool.deleteMany({
        where: { applicationId: { in: enrollmentIds } },
      });

      await tx.enrollmentProgramDetail.deleteMany({
        where: { applicationId: { in: enrollmentIds } },
      });

      await tx.applicationAddress.deleteMany({
        where: { enrollmentId: { in: enrollmentIds } },
      });

      await tx.enrollmentApplication.deleteMany({
        where: { id: { in: enrollmentIds } },
      });
    }

    if (earlyRegIds.length > 0) {
      await tx.earlyRegistrationAssessment.deleteMany({
        where: { applicationId: { in: earlyRegIds } },
      });

      await tx.applicationFamilyMember.deleteMany({
        where: { earlyRegistrationId: { in: earlyRegIds } },
      });

      await tx.applicationChecklist.deleteMany({
        where: { earlyRegistrationId: { in: earlyRegIds } },
      });

      await tx.applicationAddress.deleteMany({
        where: { earlyRegistrationId: { in: earlyRegIds } },
      });

      await tx.earlyRegistrationApplication.deleteMany({
        where: { id: { in: earlyRegIds } },
      });
    }

    if (learnerIdsToDelete.length > 0) {
      await tx.learner.deleteMany({
        where: { id: { in: learnerIdsToDelete } },
      });
    }
  });

  console.log(`Deleted enrollment applications: ${enrollmentIds.length}`);
  console.log(`Deleted early registration applications: ${earlyRegIds.length}`);
  console.log(`Deleted learners (no remaining apps): ${learnerIdsToDelete.length}`);
  console.log("Wipe complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
