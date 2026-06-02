import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Wiping incoming Grade 7 READY_FOR_SECTIONING seed data...");

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
  });

  if (!targetYear) {
    console.log("Target school year not found. Nothing to wipe.");
    return;
  }

  const seededApps = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId: targetYear.id,
      trackingNumber: { startsWith: "ING7-2627-" },
    },
    select: {
      id: true,
      learnerId: true,
    },
  });

  if (seededApps.length === 0) {
    console.log("No incoming G7 seed rows found.");
    return;
  }

  const appIds = seededApps.map((row) => row.id);
  const learnerIds = Array.from(new Set(seededApps.map((row) => row.learnerId)));

  await prisma.$transaction(async (tx) => {
    await tx.enrollmentRecord.deleteMany({
      where: { enrollmentApplicationId: { in: appIds } },
    });

    await tx.applicationChecklist.deleteMany({
      where: { enrollmentId: { in: appIds } },
    });

    await tx.enrollmentPreviousSchool.deleteMany({
      where: { applicationId: { in: appIds } },
    });

    await tx.applicationAddress.deleteMany({
      where: { enrollmentId: { in: appIds } },
    });

    await tx.enrollmentApplication.deleteMany({
      where: { id: { in: appIds } },
    });

    await tx.learner.deleteMany({
      where: {
        id: { in: learnerIds },
        lrn: { startsWith: "262627" },
      },
    });
  });

  console.log(`Deleted ${seededApps.length} incoming Grade 7 applications.`);
  console.log(`Deleted up to ${learnerIds.length} generated learners.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
