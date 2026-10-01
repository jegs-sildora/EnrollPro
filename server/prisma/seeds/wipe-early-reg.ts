import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 Wiping EARLY REGISTRATION data for the active school year...");

  try {
    const setting = await prisma.schoolSetting.findFirst({
      where: { activeSchoolYearId: { not: null } },
      include: { activeSchoolYear: true },
    });

    if (!setting || !setting.activeSchoolYearId) {
      console.log("⚠️ No active school year found. Nothing to wipe.");
      return;
    }

    const activeSchoolYearId = setting.activeSchoolYearId;
    const yearLabel = setting.activeSchoolYear?.yearLabel;

    console.log(`📌 Target School Year: ${yearLabel}`);

    // Find all EARLY_REGISTRATION applications for the active school year
    const earlyRegApps = await prisma.enrollmentApplication.findMany({
      where: {
        status: "EARLY_REGISTRATION",
        schoolYearId: activeSchoolYearId,
      },
      select: {
        id: true,
        learnerId: true,
      },
    });

    if (earlyRegApps.length === 0) {
      console.log("✅ No Early Registration records found for the active school year.");
      return;
    }

    const appIds = earlyRegApps.map((app) => app.id);
    const learnerIds = [...new Set(earlyRegApps.map((app) => app.learnerId))];

    console.log(`🗑️ Deleting ${appIds.length} Early Registration applications...`);

    // Delete the applications (cascades will delete addresses, family members, previous school)
    await prisma.enrollmentApplication.deleteMany({
      where: { id: { in: appIds } },
    });

    // Check for orphaned learners and delete them
    const orphanedLearners = await prisma.learner.findMany({
      where: {
        id: { in: learnerIds },
        enrollmentApplications: { none: {} },
        scpAdmissions: { none: {} },
        enrollmentRecords: { none: {} },
        healthRecords: { none: {} },
        enrollmentHistories: { none: {} },
        subjectDeficiencies: { none: {} },
      },
      select: { id: true },
    });

    if (orphanedLearners.length > 0) {
      const orphanedIds = orphanedLearners.map((l) => l.id);
      console.log(`🧹 Cleaning up ${orphanedIds.length} orphaned Learner records...`);
      await prisma.learner.deleteMany({
        where: { id: { in: orphanedIds } },
      });
    }

    console.log(`✅ Successfully wiped Early Registration data for ${yearLabel}.`);
  } catch (error) {
    console.error("❌ Failed to wipe Early Registration data:", error);
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
