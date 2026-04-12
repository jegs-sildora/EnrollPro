import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("⚠️  Starting applicant-only data wipe...");

  try {
    const gradeLevelsBefore = await prisma.gradeLevel.count();

    // 1. Delete Applicant child records first
    await prisma.applicantDocument.deleteMany({});
    console.log("✅ Applicant documents cleared.");

    await prisma.applicantChecklist.deleteMany({});
    console.log("✅ Applicant checklists cleared.");

    await prisma.applicantAssessment.deleteMany({});
    console.log("✅ Applicant assessments cleared.");

    await prisma.applicantProgramDetail.deleteMany({});
    console.log("✅ Applicant program details cleared.");

    await prisma.applicantPreviousSchool.deleteMany({});
    console.log("✅ Applicant previous school records cleared.");

    await prisma.applicantFamilyMember.deleteMany({});
    console.log("✅ Applicant family members cleared.");

    await prisma.applicantAddress.deleteMany({});
    console.log("✅ Applicant addresses cleared.");

    // 2. Delete main Applicant records
    // Note: Enrollment and HealthRecord have onDelete: Cascade in schema.prisma,
    // so they will be automatically wiped by the database when Applicants are deleted.
    await prisma.applicant.deleteMany({});
    console.log("✅ Applicants cleared.");

    const gradeLevelsAfter = await prisma.gradeLevel.count();
    if (gradeLevelsAfter !== gradeLevelsBefore) {
      throw new Error(
        `GradeLevels changed during wipe (${gradeLevelsBefore} -> ${gradeLevelsAfter}). Wipe aborted to protect master data.`,
      );
    }
    console.log(`✅ GradeLevels preserved: ${gradeLevelsAfter}`);

    console.log("\n✨ Applicant-related data reset successful!");
    console.log(
      "   Preserved: Users, Teachers, SchoolYears, Sections, GradeLevels, and SchoolSettings.",
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
