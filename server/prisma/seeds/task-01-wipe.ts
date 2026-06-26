import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export const wipeDatabase = async () => {
  console.log("🧹 Wiping all sections and associated mock data...");

  try {
    // 1. Identify all sections
    const sections = await prisma.section.findMany({});
    const sectionIds = sections.map(s => s.id);

    if (sectionIds.length === 0) {
      console.log("⚠️ No sections found to wipe.");
      return;
    }

    // 2. Identify linked records
    const enrollmentRecords = await prisma.enrollmentRecord.findMany({
      where: { sectionId: { in: sectionIds } }
    });
    const applicationIds = enrollmentRecords.map(r => r.enrollmentApplicationId);
    const learnerIds = enrollmentRecords.map(r => r.learnerId);

    const sectionAdvisers = await prisma.sectionAdviser.findMany({
      where: { sectionId: { in: sectionIds } }
    });
    const teacherIds = sectionAdvisers.map(s => s.teacherId);

    const teachers = await prisma.teacher.findMany({
      where: { id: { in: teacherIds } },
      select: { userId: true }
    });
    const userIds = teachers.map(t => t.userId).filter((id): id is number => id !== null);

    // 3. Delete from child to parent
    // Delete enrollment records first
    await prisma.enrollmentRecord.deleteMany({
      where: { sectionId: { in: sectionIds } }
    });

    // Delete enrollment applications
    if (applicationIds.length > 0) {
      await prisma.enrollmentApplication.deleteMany({
        where: { id: { in: applicationIds } }
      });
    }

    // Delete learners
    if (learnerIds.length > 0) {
      await prisma.learner.deleteMany({
        where: { id: { in: learnerIds } }
      });
    }

    // Delete teacher designations and advisers
    await prisma.teacherDesignation.deleteMany({
      where: { advisorySectionId: { in: sectionIds } }
    });
    await prisma.sectionAdviser.deleteMany({
      where: { sectionId: { in: sectionIds } }
    });

    // Delete sections
    await prisma.section.deleteMany({
      where: { id: { in: sectionIds } }
    });

    // Delete teachers
    if (teacherIds.length > 0) {
      await prisma.teacher.deleteMany({
        where: { id: { in: teacherIds } }
      });
    }

    // Delete users created for these teachers, excluding system admins
    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: {
          id: { in: userIds },
          NOT: {
            roles: { has: "SYSTEM_ADMIN" }
          }
        }
      });
    }

    console.log("✅ Successfully wiped all sections and associated mock data.");
  } catch (err) {
    console.error("❌ Error wiping data:", err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

wipeDatabase().then(() => process.exit(0)).catch(() => process.exit(1));