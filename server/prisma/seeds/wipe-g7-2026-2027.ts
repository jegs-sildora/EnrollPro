import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TARGET_SY_LABEL = "2026-2027";

export const wipeGrade7 = async () => {
  console.log(`🧹 Wiping Grade 7 learners for SY ${TARGET_SY_LABEL}...`);

  try {
    const sy = await prisma.schoolYear.findUnique({ where: { yearLabel: TARGET_SY_LABEL } });
    if (!sy) {
      console.log(`⚠️ School year ${TARGET_SY_LABEL} not found. Nothing to wipe.`);
      return;
    }

    const grade7 = await prisma.gradeLevel.findUnique({ where: { name: "Grade 7" } });
    if (!grade7) {
      console.log("⚠️ Grade 7 not found. Nothing to wipe.");
      return;
    }

    const enrollmentRecords = await prisma.enrollmentRecord.findMany({
      where: { schoolYearId: sy.id, section: { gradeLevelId: grade7.id } },
      include: { learner: true }
    });

    if (enrollmentRecords.length === 0) {
      console.log(`✅ No Grade 7 learners found for SY ${TARGET_SY_LABEL}.`);
      return;
    }

    const enrollmentApplicationIds = enrollmentRecords.map((r) => r.enrollmentApplicationId);
    const learnerIds = [...new Set(enrollmentRecords.map((r) => r.learnerId))];
    const userIds = [...new Set(enrollmentRecords.map((r) => r.learner.userId))].filter(Boolean) as string[];

    console.log(`Deleting ${enrollmentRecords.length} enrollment records...`);
    await prisma.enrollmentRecord.deleteMany({
      where: { id: { in: enrollmentRecords.map(r => r.id) } }
    });

    console.log(`Deleting ${enrollmentApplicationIds.length} enrollment applications...`);
    await prisma.enrollmentApplication.deleteMany({
      where: { id: { in: enrollmentApplicationIds } }
    });

    console.log(`Deleting ${learnerIds.length} learners...`);
    await prisma.learner.deleteMany({
      where: { id: { in: learnerIds } }
    });

    console.log(`Deleting ${userIds.length} users...`);
    await prisma.user.deleteMany({
      where: { id: { in: userIds } }
    });

    console.log(`✅ Successfully wiped Grade 7 learners for SY ${TARGET_SY_LABEL}.`);
  } catch (err) {
    console.error("❌ Error wiping data:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

wipeGrade7().then(() => process.exit(0)).catch(() => process.exit(1));
