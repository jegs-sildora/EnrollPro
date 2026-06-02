import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Wiping promoted learner transition seed for 2026-2027...");

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
      trackingNumber: { startsWith: "PROMO-2627-" },
    },
    select: { id: true },
  });

  if (seededApps.length === 0) {
    console.log("No promoted transition seed rows found.");
    return;
  }

  const appIds = seededApps.map((row) => row.id);

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
  });

  console.log(`Deleted ${seededApps.length} promoted transition applications.`);
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
