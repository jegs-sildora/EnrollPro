import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/index.js";
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
  scpProgramConfigs: number;
  scpProgramSteps: number;
  scpProgramOptions: number;
};

type PreservedCountsClient = Pick<
  PrismaClient,
  | "user"
  | "teacher"
  | "schoolSetting"
  | "schoolYear"
  | "gradeLevel"
  | "section"
  | "scpProgramConfig"
  | "scpProgramStep"
  | "scpProgramOption"
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
    scpProgramConfigs,
    scpProgramSteps,
    scpProgramOptions,
  ] = await Promise.all([
    client.user.count(),
    client.teacher.count(),
    client.schoolSetting.count(),
    client.schoolYear.count(),
    client.gradeLevel.count(),
    client.section.count(),
    client.scpProgramConfig.count(),
    client.scpProgramStep.count(),
    client.scpProgramOption.count(),
  ]);

  return {
    users,
    teachers,
    schoolSettings,
    schoolYears,
    gradeLevels,
    sections,
    scpProgramConfigs,
    scpProgramSteps,
    scpProgramOptions,
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
    `sections=${counts.sections}, ` +
    `scpProgramConfigs=${counts.scpProgramConfigs}, ` +
    `scpProgramSteps=${counts.scpProgramSteps}, ` +
    `scpProgramOptions=${counts.scpProgramOptions}`
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
    before.sections !== after.sections ||
    before.scpProgramConfigs !== after.scpProgramConfigs ||
    before.scpProgramSteps !== after.scpProgramSteps ||
    before.scpProgramOptions !== after.scpProgramOptions
  );
}

async function main() {
  console.log("⚠️  Starting learner/application data wipe...");

  try {
    const preservedBefore = await getPreservedCounts(prisma);

    const summary = await prisma.$transaction(async (tx) => {
      // 1. Clear records that reference EnrollmentApplication without DB-level cascade.
      const emailLogsResult = await tx.emailLog.deleteMany({
        where: { applicationId: { not: null } },
      });

      // 2. Clear dependent application tables explicitly for wipe robustness.
      const enrollmentRecordsResult = await tx.enrollmentRecord.deleteMany({});
      const enrollmentPreviousSchoolsResult =
        await tx.enrollmentPreviousSchool.deleteMany({});
      const enrollmentProgramDetailsResult =
        await tx.enrollmentProgramDetail.deleteMany({});
      const applicationAddressesResult = await tx.applicationAddress.deleteMany(
        {},
      );
      const applicationFamilyMembersResult =
        await tx.applicationFamilyMember.deleteMany({});
      const applicationChecklistsResult =
        await tx.applicationChecklist.deleteMany({});
      const earlyRegAssessmentsResult =
        await tx.earlyRegistrationAssessment.deleteMany({});

      // 3. Delete phase 2 applications first, then phase 1 applications.
      const enrollmentAppsResult = await tx.enrollmentApplication.deleteMany(
        {},
      );
      const earlyRegAppsResult =
        await tx.earlyRegistrationApplication.deleteMany({});

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
        emailLogsCleared: emailLogsResult.count,
        enrollmentRecordsCleared: enrollmentRecordsResult.count,
        enrollmentPreviousSchoolsCleared: enrollmentPreviousSchoolsResult.count,
        enrollmentProgramDetailsCleared: enrollmentProgramDetailsResult.count,
        applicationAddressesCleared: applicationAddressesResult.count,
        applicationFamilyMembersCleared: applicationFamilyMembersResult.count,
        applicationChecklistsCleared: applicationChecklistsResult.count,
        earlyRegAssessmentsCleared: earlyRegAssessmentsResult.count,
        enrollmentAppsCleared: enrollmentAppsResult.count,
        earlyRegAppsCleared: earlyRegAppsResult.count,
        healthRecordsCleared: healthRecordsResult.count,
        learnersCleared: learnersResult.count,
        preservedAfter,
      };
    });

    console.log(
      `✅ Enrollment-linked email logs cleared (${summary.emailLogsCleared}).`,
    );
    console.log(
      `✅ Enrollment records cleared (${summary.enrollmentRecordsCleared}).`,
    );
    console.log(
      `✅ Enrollment previous school rows cleared (${summary.enrollmentPreviousSchoolsCleared}).`,
    );
    console.log(
      `✅ Enrollment program details cleared (${summary.enrollmentProgramDetailsCleared}).`,
    );
    console.log(
      `✅ Application addresses cleared (${summary.applicationAddressesCleared}).`,
    );
    console.log(
      `✅ Application family members cleared (${summary.applicationFamilyMembersCleared}).`,
    );
    console.log(
      `✅ Application checklists cleared (${summary.applicationChecklistsCleared}).`,
    );
    console.log(
      `✅ Early registration assessments cleared (${summary.earlyRegAssessmentsCleared}).`,
    );
    console.log(
      `✅ Enrollment applications cleared (${summary.enrollmentAppsCleared}).`,
    );
    console.log(
      `✅ Early registration applications cleared (${summary.earlyRegAppsCleared}).`,
    );
    console.log(`✅ Health records cleared (${summary.healthRecordsCleared}).`);
    console.log(`✅ Learners cleared (${summary.learnersCleared}).`);

    console.log(`✅ Users preserved: ${summary.preservedAfter.users}`);
    console.log(`✅ Teachers preserved: ${summary.preservedAfter.teachers}`);
    console.log(
      `✅ School settings preserved: ${summary.preservedAfter.schoolSettings}`,
    );
    console.log(
      `✅ School years preserved: ${summary.preservedAfter.schoolYears}`,
    );
    console.log(
      `✅ Grade levels preserved: ${summary.preservedAfter.gradeLevels}`,
    );
    console.log(`✅ Sections preserved: ${summary.preservedAfter.sections}`);
    console.log(
      `✅ SCP configs preserved: ${summary.preservedAfter.scpProgramConfigs}`,
    );
    console.log(
      `✅ SCP steps preserved: ${summary.preservedAfter.scpProgramSteps}`,
    );
    console.log(
      `✅ SCP options preserved: ${summary.preservedAfter.scpProgramOptions}`,
    );

    console.log("\n✨ Learner/application data reset successful!");
    console.log(
      "   Preserved: Users, Teachers, SchoolYears, Sections, GradeLevels, SchoolSettings, and SCP configuration.",
    );
  } catch (error) {
    console.error("❌ Error during wipe:", error);
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
