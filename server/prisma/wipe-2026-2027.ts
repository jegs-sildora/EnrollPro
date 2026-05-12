import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 Starting wipe for School Year 2026-2027...");

  // 1. Find the target School Year
  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
  });

  if (!targetYear) {
    console.log("❌ School year 2026-2027 not found. Nothing to wipe.");
    return;
  }

  const syId = targetYear.id;
  console.log(`Target SY ID: ${syId}`);

  try {
    await prisma.$transaction(async (tx) => {
      // Order matters due to foreign key constraints

      // 1. Delete Enrollment Records (tied to SY)
      const er = await tx.enrollmentRecord.deleteMany({
        where: { schoolYearId: syId },
      });
      console.log(`✅ Deleted ${er.count} Enrollment Records.`);

      // 2. Delete Enrollment Applications (tied to SY)
      const ea = await tx.enrollmentApplication.deleteMany({
        where: { schoolYearId: syId },
      });
      console.log(`✅ Deleted ${ea.count} Enrollment Applications.`);

      // 3. Delete Early Registration Applications (tied to SY)
      const era = await tx.earlyRegistrationApplication.deleteMany({
        where: { schoolYearId: syId },
      });
      console.log(`✅ Deleted ${era.count} Early Registration Applications.`);

      // 4. Delete Section Advisers (tied to sections of that SY)
      const sa = await tx.sectionAdviser.deleteMany({
        where: { section: { schoolYearId: syId } },
      });
      console.log(`✅ Deleted ${sa.count} Section Advisers.`);

      // 5. Delete Sections (tied to SY)
      const s = await tx.section.deleteMany({
        where: { schoolYearId: syId },
      });
      console.log(`✅ Deleted ${s.count} Sections.`);

      // 6. Delete Health Records (tied to SY)
      const hr = await tx.healthRecord.deleteMany({
        where: { schoolYearId: syId },
      });
      console.log(`✅ Deleted ${hr.count} Health Records.`);

      // 7. Delete Teacher Designations (tied to SY)
      const td = await tx.teacherDesignation.deleteMany({
        where: { schoolYearId: syId },
      });
      console.log(`✅ Deleted ${td.count} Teacher Designations.`);

      // 8. Finally, delete the School Year itself
      await tx.schoolYear.delete({
        where: { id: syId },
      });
      console.log(`✅ Deleted School Year record: ${targetYear.yearLabel}.`);
    });

    console.log(`\n🎉 Successfully wiped all transaction data for ${targetYear.yearLabel}.`);
    console.log("Note: Master data like Learners, Teachers, and Users were preserved.");
  } catch (error) {
    console.error("❌ Wipe failed:", error);
  }
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
