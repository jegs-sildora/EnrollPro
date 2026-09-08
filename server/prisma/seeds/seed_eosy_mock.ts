import "dotenv/config";
import { PrismaClient, EosyStatus } from "../../src/generated/prisma/index.js";
import { buildSmartOutcomeEnvelope, mergeSmartOutcomeIntoReportedGrades } from "../../src/features/integration/smart-outcome-envelope.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding EOSY mock grades...");

  const activeSchoolYear = await prisma.schoolYear.findFirst({
    where: { status: "ACTIVE" },
  });

  if (!activeSchoolYear) {
    console.error("❌ No ACTIVE school year found.");
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
        include: {
          enrollmentApplication: true,
          section: true,
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
        const retainedEnvelope = buildSmartOutcomeEnvelope({
          schoolYearId: activeSchoolYear.id,
          sectionId: records[0].sectionId,
          finalGeneralAverage: retainedGrade,
          finalOutcome: "RETAINED",
          publishedAt: new Date().toISOString(),
          revision: "1",
          subjects: { "Math": { Final: retainedGrade } },
        });
        await tx.enrollmentRecord.update({
          where: { id: retainedId },
          data: { finalAverage: retainedGrade, eosyStatus: "RETAINED" },
        });
        await tx.enrollmentApplication.update({
          where: { id: records[0].enrollmentApplicationId! },
          data: { reportedGrades: mergeSmartOutcomeIntoReportedGrades(records[0].enrollmentApplication?.reportedGrades, retainedEnvelope) },
        });

        // 2. The Irregular (Conditionally Promoted) Learner (passing e.g. 76)
        const irregularEnvelope = buildSmartOutcomeEnvelope({
          schoolYearId: activeSchoolYear.id,
          sectionId: records[1].sectionId,
          finalGeneralAverage: 76,
          finalOutcome: "CONDITIONALLY_PROMOTED",
          publishedAt: new Date().toISOString(),
          revision: "1",
          subjects: { "Math": { Final: 74 }, "Science": { Final: 74 } },
        });
        await tx.enrollmentRecord.update({
          where: { id: irregularId },
          data: { 
            finalAverage: 76, 
            eosyStatus: "CONDITIONALLY_PROMOTED",
            academicDeficiencyNote: "Mathematics, Science" // Added 2 failed subjects for testing
          },
        });
        await tx.enrollmentApplication.update({
          where: { id: records[1].enrollmentApplicationId! },
          data: { reportedGrades: mergeSmartOutcomeIntoReportedGrades(records[1].enrollmentApplication?.reportedGrades, irregularEnvelope) },
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

      const scpViolationsSeeded = new Set<number>();

      // For the rest of the learners, 95% pass (75-98, PROMOTED)
      const startIndex = records.length >= 4 ? 4 : 0;
      for (let i = startIndex; i < records.length; i++) {
        const record = records[i] as any;
        const section = record.section;
        const isScp = section && section.programType && section.programType !== "REGULAR";
        
        let passGrade = Math.round((Math.random() * (98 - 75) + 75) * 100) / 100;
        let subjects: any = { "Math": { Final: passGrade } };
        let nextYearCurriculum: any = undefined;

        if (isScp && !scpViolationsSeeded.has(section.id)) {
           // Provide a violation: FGA is 86 (passes), but a core subject is 79 (fails)
           passGrade = 86;
           subjects = { 
              "Math": { Final: 89 }, 
              "Science": { Final: 79 } // Violation!
           };
           nextYearCurriculum = "REGULAR";
           scpViolationsSeeded.add(section.id);
        } else if (isScp) {
           // Normal SCP passing
           passGrade = Math.round((Math.random() * (98 - 85) + 85) * 100) / 100;
           subjects = { "Math": { Final: passGrade }, "Science": { Final: passGrade } };
        }

        const passEnvelope = buildSmartOutcomeEnvelope({
          schoolYearId: activeSchoolYear.id,
          sectionId: record.sectionId,
          finalGeneralAverage: passGrade,
          finalOutcome: "PROMOTED",
          publishedAt: new Date().toISOString(),
          revision: "1",
          subjects,
        });

        await tx.enrollmentRecord.update({
          where: { id: record.id },
          data: { 
             finalAverage: passGrade, 
             eosyStatus: "PROMOTED",
             ...(nextYearCurriculum ? { nextYearCurriculum } : {})
          },
        });
        await tx.enrollmentApplication.update({
          where: { id: record.enrollmentApplicationId! },
          data: { reportedGrades: mergeSmartOutcomeIntoReportedGrades(record.enrollmentApplication?.reportedGrades, passEnvelope) },
        });
        totalSeeded++;
      }
    }

    console.log(`✅ Successfully seeded mock EOSY data for ${totalSeeded} learners.`);
  });
}

main()
  .catch((e) => {
    console.error("❌ Failed to seed EOSY mock data. Transaction rolled back.", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
