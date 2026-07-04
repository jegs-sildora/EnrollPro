import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔄 Reversing School Year Transition...");

  const archivedSyList = await prisma.schoolYear.findMany({
    where: { status: "ARCHIVED" },
    orderBy: { id: "desc" },
  });

  if (archivedSyList.length === 0) {
    console.error("❌ No archived school year found to restore.");
    process.exit(1);
  }

  const archivedSy = archivedSyList[0];

  console.log(`вос Restoring School Year: ${archivedSy.yearLabel} back to ACTIVE...`);
  const restoredSy = await prisma.schoolYear.update({
    where: { id: archivedSy.id },
    data: {
      status: "ACTIVE",
      isEosyFinalized: false,
    },
  });

  console.log("🔓 Unlocking all sections...");
  await prisma.section.updateMany({
    where: { schoolYearId: restoredSy.id },
    data: { isEosyFinalized: false }
  });

  console.log("⚙️ Updating System Settings to point to the restored school year...");
  await prisma.schoolSetting.updateMany({
    data: { activeSchoolYearId: restoredSy.id },
  });

  // Find any newer school years
  const newerSyList = await prisma.schoolYear.findMany({
    where: { id: { gt: restoredSy.id } },
  });

  for (const sy of newerSyList) {
    console.log(`🗑️ Deleting newer School Year: ${sy.yearLabel}`);

    console.log(`   - Deleting dependent records for ${sy.yearLabel}...`);
    await prisma.enrollmentRecord.deleteMany({ where: { schoolYearId: sy.id } });
    await prisma.enrollmentApplication.deleteMany({ where: { schoolYearId: sy.id } });
    await prisma.healthRecord.deleteMany({ where: { schoolYearId: sy.id } });

    await prisma.schoolYear.delete({ where: { id: sy.id } });
  }

  // Delete enrollment history created during finalization
  const deletedHistory = await prisma.enrollmentHistory.deleteMany({
    where: { schoolYearId: restoredSy.id },
  });
  console.log(`🗑️ Deleted ${deletedHistory.count} history records for the restored school year.`);

  // Revert section advisers
  console.log("⚙️ Re-activating Section Advisers...");
  await prisma.sectionAdviser.updateMany({
    where: { schoolYearId: restoredSy.id, status: "REVOKED" },
    data: { status: "ACTIVE" }
  });

  console.log("✅ Successfully reversed the School Year Transition!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
