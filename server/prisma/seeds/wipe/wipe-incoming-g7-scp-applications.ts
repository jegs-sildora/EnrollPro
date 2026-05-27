/**
 * wipe-incoming-g7-scp-applications.ts
 *
 * Removes incoming Grade 7 SCP enrollment applications for SY 2026-2027.
 *
 * Scope:
 * - school year: 2026-2027
 * - grade level: Grade 7
 * - learner type: NEW_ENROLLEE, TRANSFEREE
 * - status: PENDING_CONFIRMATION, READY_FOR_ENROLLMENT
 * - applicant type (SCP):
 *   - SCIENCE_TECHNOLOGY_AND_ENGINEERING
 *   - SPECIAL_PROGRAM_IN_THE_ARTS
 *   - SPECIAL_PROGRAM_IN_SPORTS
 *   - SPECIAL_PROGRAM_IN_JOURNALISM
 *   - SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE
 *   - SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION
 *
 * Usage:
 *   pnpm --filter server run db:wipe-incoming-g7-scp-applications
 */

import "dotenv/config";
import {
  PrismaClient,
  ApplicantType,
  LearnerType,
  EnrollmentStatus,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SCP_APPLICANT_TYPES: ApplicantType[] = [
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
  "SPECIAL_PROGRAM_IN_JOURNALISM",
  "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
  "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
];

const INCOMING_LEARNER_TYPES: LearnerType[] = ["NEW_ENROLLEE", "TRANSFEREE"];
const TARGET_STATUSES: EnrollmentStatus[] = ["PENDING_CONFIRMATION", "READY_FOR_ENROLLMENT"];

async function main() {
  console.log("Wiping incoming Grade 7 SCP applications for SY 2026-2027...");

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
    select: { id: true },
  });

  if (!targetYear) {
    console.log("SY 2026-2027 not found. Nothing to wipe.");
    return;
  }

  const grade7 = await prisma.gradeLevel.findFirst({
    where: { name: "Grade 7" },
    select: { id: true },
  });

  if (!grade7) {
    console.log("Grade 7 not found. Nothing to wipe.");
    return;
  }

  const enrollmentApplications = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId: targetYear.id,
      gradeLevelId: grade7.id,
      learnerType: { in: INCOMING_LEARNER_TYPES },
      applicantType: { in: SCP_APPLICANT_TYPES },
      status: { in: TARGET_STATUSES },
    },
    select: {
      id: true,
      learnerId: true,
      earlyRegistrationId: true,
      trackingNumber: true,
      applicantType: true,
      learnerType: true,
      status: true,
      learner: { select: { lrn: true, firstName: true, lastName: true } },
    },
  });

  const earlyRegistrationApplications = await prisma.earlyRegistrationApplication.findMany({
    where: {
      schoolYearId: targetYear.id,
      gradeLevelId: grade7.id,
      learnerType: { in: INCOMING_LEARNER_TYPES },
      applicantType: { in: SCP_APPLICANT_TYPES },
      status: { in: TARGET_STATUSES },
    },
    select: {
      id: true,
      learnerId: true,
      trackingNumber: true,
      applicantType: true,
      learnerType: true,
      status: true,
      learner: { select: { lrn: true, firstName: true, lastName: true } },
    },
  });

  const directEarlyRegIds = earlyRegistrationApplications.map((a) => a.id);
  const linkedEnrollmentApplications = directEarlyRegIds.length
    ? await prisma.enrollmentApplication.findMany({
        where: {
          earlyRegistrationId: { in: directEarlyRegIds },
        },
        select: {
          id: true,
          learnerId: true,
          earlyRegistrationId: true,
          trackingNumber: true,
          applicantType: true,
          learnerType: true,
          status: true,
          learner: { select: { lrn: true, firstName: true, lastName: true } },
        },
      })
    : [];

  const applicationsById = new Map<number, (typeof enrollmentApplications)[number]>();
  for (const app of enrollmentApplications) {
    applicationsById.set(app.id, app);
  }
  for (const app of linkedEnrollmentApplications) {
    applicationsById.set(app.id, app);
  }

  const applications = Array.from(applicationsById.values());

  if (applications.length === 0 && earlyRegistrationApplications.length === 0) {
    console.log("No incoming Grade 7 SCP applications found. Nothing to wipe.");
    return;
  }

  console.log(`Found ${applications.length} enrollment application(s) to remove.`);
  console.log(
    `Found ${earlyRegistrationApplications.length} early registration application(s) to remove.`,
  );

  const appIds = applications.map((a) => a.id);
  const candidateLearnerIds = Array.from(
    new Set([
      ...applications.map((a) => a.learnerId),
      ...earlyRegistrationApplications.map((a) => a.learnerId),
    ]),
  );
  const earlyRegIds = Array.from(
    new Set(
      [
        ...applications
          .map((a) => a.earlyRegistrationId)
          .filter((id): id is number => id !== null),
        ...directEarlyRegIds,
      ],
    ),
  );

  const remainingEnrollmentLearners = await prisma.enrollmentApplication.findMany({
    where: {
      learnerId: { in: candidateLearnerIds },
      id: { notIn: appIds },
    },
    select: { learnerId: true },
  });

  const remainingEarlyRegLearners = earlyRegIds.length
    ? await prisma.earlyRegistrationApplication.findMany({
        where: {
          learnerId: { in: candidateLearnerIds },
          id: { notIn: earlyRegIds },
        },
        select: { learnerId: true },
      })
    : [];

  const keepLearnerIds = new Set([
    ...remainingEnrollmentLearners
      .map((row) => row.learnerId)
      .filter((id): id is number => id !== null),
    ...remainingEarlyRegLearners
      .map((row) => row.learnerId)
      .filter((id): id is number => id !== null),
  ]);

  const learnerIdsToDelete = candidateLearnerIds.filter((id) => !keepLearnerIds.has(id));

  await prisma.$transaction(async (tx) => {
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

    const deletedEnrollmentApps = await tx.enrollmentApplication.deleteMany({
      where: { id: { in: appIds } },
    });

    let deletedEarlyRegs = { count: 0 };
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

      deletedEarlyRegs = await tx.earlyRegistrationApplication.deleteMany({
        where: { id: { in: earlyRegIds } },
      });
    }

    let deletedLearners = 0;
    if (learnerIdsToDelete.length > 0) {
      const result = await tx.learner.deleteMany({
        where: { id: { in: learnerIdsToDelete } },
      });
      deletedLearners = result.count;
    }

    console.log(`Deleted ${deletedEnrollmentApps.count} enrollment application(s).`);
    console.log(`Deleted ${deletedEarlyRegs.count} early registration application(s).`);
    console.log(`Deleted ${deletedLearners} learner record(s) with no remaining applications.`);
    console.log(`Kept ${keepLearnerIds.size} learner record(s) that have other applications.`);
  });

  console.log("Wipe complete.");
}

main()
  .catch((error) => {
    console.error("Wipe failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
