import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TARGET_SY_LABEL = "2027-2028";

export const wipeLearners = async () => {
  console.log(`🧹 Wiping Auto-Sectioning learners for SY ${TARGET_SY_LABEL}...`);

  try {
    const sy = await prisma.schoolYear.findUnique({ where: { yearLabel: TARGET_SY_LABEL } });
    if (!sy) {
      console.log(`⚠️ School year ${TARGET_SY_LABEL} not found. Nothing to wipe.`);
      return;
    }

    const autoSectioningUsers = await prisma.user.findMany({
      where: { accountName: { startsWith: "2127" } },
      select: { id: true, learnerProfile: { select: { id: true, enrollmentApplications: { select: { id: true } } } } }
    });

    if (autoSectioningUsers.length === 0) {
      console.log(`✅ No Auto-Sectioning test learners found for SY ${TARGET_SY_LABEL}.`);
      return;
    }

    const userIds = autoSectioningUsers.map(u => u.id);
    const learnerIds = autoSectioningUsers.map(u => u.learnerProfile?.id).filter(Boolean) as number[];
    const applicationIds = autoSectioningUsers.flatMap(u => u.learnerProfile?.enrollmentApplications.map(a => a.id) || []);

    if (applicationIds.length > 0) {
      console.log(`Deleting ${applicationIds.length} enrollment applications...`);
      await prisma.enrollmentApplication.deleteMany({
        where: { id: { in: applicationIds } }
      });
    }

    console.log(`Deleting ${learnerIds.length} learners...`);
    await prisma.learner.deleteMany({
      where: { id: { in: learnerIds } }
    });

    console.log(`Deleting ${userIds.length} users...`);
    await prisma.user.deleteMany({
      where: { id: { in: userIds } }
    });

    console.log(`✅ Successfully wiped Auto-Sectioning learners for SY ${TARGET_SY_LABEL}.`);
  } catch (err) {
    console.error("❌ Error wiping data:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

wipeLearners().then(() => process.exit(0)).catch(() => process.exit(1));
