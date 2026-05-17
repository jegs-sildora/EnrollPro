import "dotenv/config";
import { PrismaClient, Role } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SECTION_NAMES = ["SPA A", "SPA B", "SPS A", "SPS B"];
const TRACKING_PREFIXES = ["SPA-2026-", "SPS-2026-", "STE-2026-"];

async function main() {
  console.log("Wiping Other SCP seed data for 2026-2027...");

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
    select: { id: true },
  });

  if (!targetYear) {
    console.log("School year 2026-2027 not found. Nothing to wipe.");
    return;
  }

  const spaSpsSections = await prisma.section.findMany({
    where: {
      schoolYearId: targetYear.id,
      name: { in: SECTION_NAMES },
    },
    select: { id: true },
  });

  const spaSpsSectionIds = spaSpsSections.map((s) => s.id);

  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId: targetYear.id,
      OR: TRACKING_PREFIXES.map((prefix) => ({
        trackingNumber: { startsWith: prefix },
      })),
    },
    select: { id: true, learnerId: true },
  });

  const applicationIds = applications.map((a) => a.id);
  const learnerIds = applications.map((a) => a.learnerId);

  const recordsFromApps = await prisma.enrollmentRecord.deleteMany({
    where: {
      schoolYearId: targetYear.id,
      enrollmentApplicationId: { in: applicationIds },
    },
  });

  const recordsFromSections = spaSpsSectionIds.length
    ? await prisma.enrollmentRecord.deleteMany({
        where: {
          schoolYearId: targetYear.id,
          sectionId: { in: spaSpsSectionIds },
        },
      })
    : { count: 0 };

  const deletedApplications = await prisma.enrollmentApplication.deleteMany({
    where: { id: { in: applicationIds } },
  });

  const learnersToDelete = await prisma.learner.findMany({
    where: {
      id: { in: learnerIds },
    },
    select: { id: true, userId: true },
  });

  const learnerIdsToDelete = learnersToDelete.map((l) => l.id);
  const userIdsToDelete = learnersToDelete
    .map((l) => l.userId)
    .filter((id): id is number => typeof id === "number");

  const deletedLearners = await prisma.learner.deleteMany({
    where: {
      id: { in: learnerIdsToDelete },
      enrollmentApplications: { none: {} },
    },
  });

  const deletedUsers = await prisma.user.deleteMany({
    where: {
      id: { in: userIdsToDelete },
      role: "LEARNER" as Role,
    },
  });

  const deletedAdvisers = spaSpsSectionIds.length
    ? await prisma.sectionAdviser.deleteMany({
        where: {
          schoolYearId: targetYear.id,
          sectionId: { in: spaSpsSectionIds },
        },
      })
    : { count: 0 };

  const deletedSections = spaSpsSectionIds.length
    ? await prisma.section.deleteMany({
        where: {
          schoolYearId: targetYear.id,
          id: { in: spaSpsSectionIds },
        },
      })
    : { count: 0 };

  console.log(`Enrollment records deleted (apps): ${recordsFromApps.count}`);
  console.log(`Enrollment records deleted (sections): ${recordsFromSections.count}`);
  console.log(`Enrollment applications deleted: ${deletedApplications.count}`);
  console.log(`Learners deleted: ${deletedLearners.count}`);
  console.log(`Users deleted: ${deletedUsers.count}`);
  console.log(`Section advisers deleted: ${deletedAdvisers.count}`);
  console.log(`SPA/SPS sections deleted: ${deletedSections.count}`);
  console.log("Wipe complete.");
}

main()
  .catch((error) => {
    console.error("Wipe failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
