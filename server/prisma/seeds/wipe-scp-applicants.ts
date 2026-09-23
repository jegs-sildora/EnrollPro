import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 Wiping ALL SCP ADMISSION APPLICANTS for the ACTIVE school year...");

  try {
    const settings = await prisma.schoolSetting.findFirst();
    if (!settings || !settings.activeSchoolYearId) {
      console.log("⚠️ No active school year found. Aborting.");
      return;
    }

    const activeSchoolYearId = settings.activeSchoolYearId;

    const applicantTypes = [
      "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
      "SPECIAL_PROGRAM_IN_THE_ARTS",
      "SPECIAL_PROGRAM_IN_SPORTS",
      "SPECIAL_PROGRAM_IN_JOURNALISM",
      "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
      "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION"
    ] as const;

    // 1. Fetch from decoupled ScpAdmission model
    const scpAdmissions = await prisma.scpAdmission.findMany({
      where: {
        schoolYearId: activeSchoolYearId,
        program: { in: applicantTypes as any }
      },
      select: { learnerId: true }
    });

    // 2. Fetch from legacy EnrollmentApplication model (for backward compatibility during wipes)
    const scpApplications = await prisma.enrollmentApplication.findMany({
      where: {
        schoolYearId: activeSchoolYearId,
        applicantType: { in: applicantTypes as any }
      },
      select: { learnerId: true }
    });

    const learnerIds = [
      ...scpAdmissions.map(app => app.learnerId),
      ...scpApplications.map(app => app.learnerId)
    ];

    const uniqueLearnerIds = Array.from(new Set(learnerIds));

    if (uniqueLearnerIds.length === 0) {
      console.log("✅ No SCP applicants found for the active school year.");
    }

    // 3. Delete from ScpAdmission
    const { count: admissionCount } = await prisma.scpAdmission.deleteMany({
      where: {
        schoolYearId: activeSchoolYearId,
        program: { in: applicantTypes as any }
      }
    });

    // 4. Delete from EnrollmentApplication (legacy)
    const { count: appCount } = await prisma.enrollmentApplication.deleteMany({
      where: {
        schoolYearId: activeSchoolYearId,
        applicantType: { in: applicantTypes as any }
      }
    });

    // 5. Delete associated learners
    let learnerCount = 0;
    if (uniqueLearnerIds.length > 0) {
      const result = await prisma.learner.deleteMany({
        where: { id: { in: uniqueLearnerIds } }
      });
      learnerCount = result.count;
    }

    // 6. UNLOCK the official rosters
    await prisma.schoolYear.update({
      where: { id: activeSchoolYearId },
      data: {
        steRosterLocked: false,
        spaRosterLocked: false,
        spsRosterLocked: false,
      }
    });

    console.log(`✅ Successfully wiped ${admissionCount} SCP admissions, ${appCount} legacy SCP applications, and ${learnerCount} Learner records for the active school year (ID: ${activeSchoolYearId}).`);
    console.log(`🔓 Successfully unlocked the Official List of Qualified Applicants (STE, SPA, SPS).`);
  } catch (error) {
    console.error("❌ Failed to wipe SCP applicants:", error);
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
