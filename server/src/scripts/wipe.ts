import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 Wiping entire database...");

  // Delete all tables in reverse order of dependencies
  await prisma.auditLog.deleteMany();
  await prisma.enrollmentRecord.deleteMany();
  await prisma.enrollmentApplication.deleteMany();

  await prisma.healthRecord.deleteMany();
  await prisma.sectionAdviser.deleteMany();
  await prisma.section.deleteMany();
  await prisma.gradeLevel.deleteMany();
  await prisma.schoolSetting.deleteMany();
  await prisma.schoolYear.deleteMany();
  await prisma.teacherDesignation.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.department.deleteMany();
  await prisma.learner.deleteMany();
  await prisma.user.deleteMany();

  console.log("✅ Wipe completed successfully.");
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
