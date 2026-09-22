import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const EMPLOYEE_IDS_TO_WIPE = ["1234506", "1234507", "1234508", "1234509"];

export const wipeUsers = async () => {
  console.log("🧹 Wiping special users for Task 01...");

  try {
    for (const employeeId of EMPLOYEE_IDS_TO_WIPE) {
      const teacher = await prisma.teacher.findUnique({
        where: { employeeId }
      });

      if (teacher) {
        await prisma.teacherDesignation.deleteMany({
          where: { teacherId: teacher.id }
        });

        await prisma.sectionAdviser.deleteMany({
          where: { teacherId: teacher.id }
        });

        await prisma.teacher.delete({
          where: { id: teacher.id }
        });
      }

      await prisma.user.deleteMany({
        where: { employeeId }
      });
      
      console.log(`✅ Wiped user with employee ID ${employeeId}`);
    }

    console.log("✅ Wipe complete.");
  } catch (error) {
    console.error("❌ Error during wipe:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

wipeUsers().then(() => process.exit(0)).catch(() => process.exit(1));
