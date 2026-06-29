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
    // Delete from child to parent
    console.log("Deleting enrollment records...");
    await prisma.enrollmentRecord.deleteMany({});

    console.log("Deleting enrollment applications...");
    await prisma.enrollmentApplication.deleteMany({});

    console.log("Deleting learners...");
    await prisma.learner.deleteMany({});

    console.log("Deleting teacher designations...");
    await prisma.teacherDesignation.deleteMany({});

    console.log("Deleting section advisers...");
    await prisma.sectionAdviser.deleteMany({});

    console.log("Deleting sections...");
    await prisma.section.deleteMany({});

    console.log("Deleting teachers...");
    await prisma.teacher.deleteMany({});

    console.log("Deleting users...");
    await prisma.user.deleteMany({
      where: {
        NOT: {
          roles: { has: "SYSTEM_ADMIN" }
        }
      }
    });

    console.log("✅ Successfully wiped all mock data.");
  } catch (err) {
    console.error("❌ Error wiping data:", err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

wipeDatabase().then(() => process.exit(0)).catch(() => process.exit(1));