import "dotenv/config";
import {
  PrismaClient,
  ApplicationStatus,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 Wiping Dynamic Grade 7 Enrollments for 2026-2027...");

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
  });

  if (!targetYear) {
    console.log("ℹ️ SY 2026-2027 not found. Nothing to wipe.");
    return;
  }

  const grade7 = await prisma.gradeLevel.findFirst({
    where: { name: "Grade 7" },
  });

  if (!grade7) return;

  // 1. Identify applications seeded by seed-pending-g7.ts (tracking REG-2026-*)
  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId: targetYear.id,
      gradeLevelId: grade7.id,
      trackingNumber: { startsWith: "REG-2026-" },
      status: "ENROLLED" as ApplicationStatus,
    },
    select: { id: true },
  });

  const appIds = applications.map((a) => a.id);

  if (appIds.length === 0) {
    console.log("ℹ️ No enrolled pending G7 applications found.");
  } else {
    // 2. Delete Enrollment Records
    const deleteResult = await prisma.enrollmentRecord.deleteMany({
      where: {
        enrollmentApplicationId: { in: appIds },
      },
    });
    console.log(`🗑️ Deleted ${deleteResult.count} enrollment records.`);

    // 3. Reset Application Status to VERIFIED
    const updateResult = await prisma.enrollmentApplication.updateMany({
      where: {
        id: { in: appIds },
      },
      data: {
        status: "VERIFIED" as ApplicationStatus,
      },
    });
    console.log(`🔄 Reset ${updateResult.count} application statuses to VERIFIED.`);
  }

  console.log("\nℹ️ Sections and Teacher assignments have been PRESERVED.");
  console.log("✨ Wipe Complete!");
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
