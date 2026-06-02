import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type PreservedCounts = {
  users: number;
  teachers: number;
  schoolSettings: number;
  schoolYears: number;
  gradeLevels: number;
  sections: number;
};

type PreservedCountsClient = Pick<
  PrismaClient,
  | "user"
  | "teacher"
  | "schoolSetting"
  | "schoolYear"
  | "gradeLevel"
  | "section"
>;

async function getPreservedCounts(
  client: PreservedCountsClient,
): Promise<PreservedCounts> {
  const [
    users,
    teachers,
    schoolSettings,
    schoolYears,
    gradeLevels,
    sections,
  ] = await Promise.all([
    client.user.count(),
    client.teacher.count(),
    client.schoolSetting.count(),
    client.schoolYear.count(),
    client.gradeLevel.count(),
    client.section.count(),
  ]);

  return {
    users,
    teachers,
    schoolSettings,
    schoolYears,
    gradeLevels,
    sections,
  };
}

function formatPreservedCounts(
  prefix: string,
  counts: PreservedCounts,
): string {
  return (
    `${prefix} ` +
    `users=${counts.users}, ` +
    `teachers=${counts.teachers}, ` +
    `schoolSettings=${counts.schoolSettings}, ` +
    `schoolYears=${counts.schoolYears}, ` +
    `gradeLevels=${counts.gradeLevels}, ` +
    `sections=${counts.sections}`
  );
}

function hasPreservedCountMismatch(
  before: PreservedCounts,
  after: PreservedCounts,
): boolean {
  return (
    before.users !== after.users ||
    before.teachers !== after.teachers ||
    before.schoolSettings !== after.schoolSettings ||
    before.schoolYears !== after.schoolYears ||
    before.gradeLevels !== after.gradeLevels ||
    before.sections !== after.sections
  );
}

async function main() {
  console.log("  Starting learner/application data wipe...");

  try {
    const preservedBefore = await getPreservedCounts(prisma);

    const summary = await prisma.$transaction(async (tx) => {
      // 1. Clear dependent application tables explicitly for wipe robustness.
      const enrollmentRecordsResult = await tx.enrollmentRecord.deleteMany({});
      const enrollmentPreviousSchoolsResult =
        await tx.enrollmentPreviousSchool.deleteMany({});
      const applicationAddressesResult = await tx.applicationAddress.deleteMany(
        {},
      );
      const applicationFamilyMembersResult =
        await tx.applicationFamilyMember.deleteMany({});
      const applicationChecklistsResult =
        await tx.applicationChecklist.deleteMany({});

      // 3. Delete enrollment applications.
      const enrollmentAppsResult = await tx.enrollmentApplication.deleteMany(
        {},
      );

      // 4. Clear health records, then learners.
      const healthRecordsResult = await tx.healthRecord.deleteMany({});
      const learnersResult = await tx.learner.deleteMany({});

      const preservedAfter = await getPreservedCounts(tx);
      if (hasPreservedCountMismatch(preservedBefore, preservedAfter)) {
        throw new Error(
          "Master data changed during wipe. " +
            `${formatPreservedCounts("before:", preservedBefore)}; ` +
            `${formatPreservedCounts("after:", preservedAfter)}. ` +
            "Wipe aborted to protect baseline records.",
        );
      }

      return {
        enrollmentRecordsCleared: enrollmentRecordsResult.count,
        enrollmentPreviousSchoolsCleared: enrollmentPreviousSchoolsResult.count,
        applicationAddressesCleared: applicationAddressesResult.count,
        applicationFamilyMembersCleared: applicationFamilyMembersResult.count,
        applicationChecklistsCleared: applicationChecklistsResult.count,
        enrollmentAppsCleared: enrollmentAppsResult.count,
        healthRecordsCleared: healthRecordsResult.count,
        learnersCleared: learnersResult.count,
        preservedAfter,
      };
    });

    console.log(
      `Enrollment records cleared (${summary.enrollmentRecordsCleared}).`,
    );
    console.log(
      `Enrollment previous school rows cleared (${summary.enrollmentPreviousSchoolsCleared}).`,
    );
    console.log(
      `Application addresses cleared (${summary.applicationAddressesCleared}).`,
    );
    console.log(
      `Application family members cleared (${summary.applicationFamilyMembersCleared}).`,
    );
    console.log(
      `Application checklists cleared (${summary.applicationChecklistsCleared}).`,
    );
    console.log(
      `Enrollment applications cleared (${summary.enrollmentAppsCleared}).`,
    );
    console.log(`Health records cleared (${summary.healthRecordsCleared}).`);
    console.log(`Learners cleared (${summary.learnersCleared}).`);

    console.log(`Users preserved: ${summary.preservedAfter.users}`);
    console.log(`Teachers preserved: ${summary.preservedAfter.teachers}`);
    console.log(
      `School settings preserved: ${summary.preservedAfter.schoolSettings}`,
    );
    console.log(
      `School years preserved: ${summary.preservedAfter.schoolYears}`,
    );
    console.log(
      `Grade levels preserved: ${summary.preservedAfter.gradeLevels}`,
    );
    console.log(`Sections preserved: ${summary.preservedAfter.sections}`);

    console.log("\nLearner/application data reset successful!");
    console.log(
      "   Preserved: Users, Teachers, SchoolYears, Sections, GradeLevels, and SchoolSettings.",
    );
  } catch (error) {
    console.error("Error during wipe:", error);
    process.exit(1);
  }
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
