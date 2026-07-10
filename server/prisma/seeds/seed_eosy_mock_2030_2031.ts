import "dotenv/config";
import { PrismaClient, EosyStatus } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding EOSY mock grades for 2030-2031...");

  const activeSchoolYear = await prisma.schoolYear.findFirst({
    where: { yearLabel: "2030-2031" },
  });

  if (!activeSchoolYear) {
    console.error("❌ No school year found for 2030-2031.");
    return;
  }

  const gradeLevels = await prisma.gradeLevel.findMany({
    where: { name: { in: ["Grade 7", "Grade 8", "Grade 9", "Grade 10"] } },
  });

  if (gradeLevels.length === 0) {
    console.error("❌ No Junior High School Grade Levels found.");
    return;
  }

  let totalSeeded = 0;

  // Use a transaction as required by TASK 3 (Database Integrity Check)
  await prisma.$transaction(async (tx) => {
    for (const gl of gradeLevels) {
      // Fetch all records for the grade in the active school year
      const records = await tx.enrollmentRecord.findMany({
        where: {
          schoolYearId: activeSchoolYear.id,
          section: {
            gradeLevelId: gl.id,
          },
        },
        orderBy: {
          id: "asc",
        },
      });

      if (records.length < 4) {
        console.warn(`⚠️ Not enough records in ${gl.name} to apply 4 edge cases. Found ${records.length}. Skipping edge cases.`);
      } else {
        console.log(`Processing ${records.length} records for ${gl.name}...`);

        const retainedId = records[0].id;
        const irregularId = records[1].id;
        const transferredId = records[2].id;
        const droppedId = records[3].id;

        // 1. The Retained Learner (65-74)
        const retainedGrade = Math.floor(Math.random() * (74 - 65 + 1)) + 65;
        await tx.enrollmentRecord.update({
          where: { id: retainedId },
          data: { finalAverage: retainedGrade, eosyStatus: "RETAINED" },
        });

        // 2. The Irregular (Conditionally Promoted) Learner (passing e.g. 76)
        await tx.enrollmentRecord.update({
          where: { id: irregularId },
          data: { finalAverage: 76, eosyStatus: "CONDITIONALLY_PROMOTED" },
        });

        // 3. The Transferred Out Learner (NULL grade)
        await tx.enrollmentRecord.update({
          where: { id: transferredId },
          data: { finalAverage: null, eosyStatus: "TRANSFERRED_OUT" },
        });

        // 4. The Dropped Out Learner (NULL or 0 grade)
        await tx.enrollmentRecord.update({
          where: { id: droppedId },
          data: { finalAverage: 0, eosyStatus: "DROPPED_OUT" },
        });

        totalSeeded += 4;
      }

      // For the rest of the learners, 95% pass (75-98, PROMOTED)
      const startIndex = records.length >= 4 ? 4 : 0;
      for (let i = startIndex; i < records.length; i++) {
        // We ensure random grade with 2 decimals
        const passGrade = Math.round((Math.random() * (98 - 75) + 75) * 100) / 100;
        await tx.enrollmentRecord.update({
          where: { id: records[i].id },
          data: { finalAverage: passGrade, eosyStatus: "PROMOTED" },
        });
        totalSeeded++;
      }
    }

    console.log(`✅ Successfully seeded mock EOSY data for ${totalSeeded} learners in 2030-2031.`);
  });
}

main()
  .catch((e) => {
    console.error("❌ Failed to seed EOSY mock data for 2030-2031. Transaction rolled back.", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
