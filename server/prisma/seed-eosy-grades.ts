import "dotenv/config";
import { PrismaClient, EosyStatus } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function generateNormalRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z * stdDev;
}

function generateGrade(isSTE: boolean): number {
  const mean = isSTE ? 89 : 83;
  const stdDev = isSTE ? 4 : 6;
  let grade = generateNormalRandom(mean, stdDev);
  if (grade < 60) grade = 60;
  if (grade > 100) grade = 100;
  return parseFloat(grade.toFixed(2));
}

async function main() {
  console.log("🚀 Seeding End-of-School-Year (EOSY) Grades for 2025-2026 (Mock SMART Data)...");

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2025-2026" }
  });

  if (!targetYear) throw new Error("Timeline failure: 2025-2026 not found.");

  const records = await prisma.enrollmentRecord.findMany({
    where: { 
      schoolYearId: targetYear.id,
      enrollmentApplication: {
        OR: [
          { trackingNumber: { startsWith: "STE-" } },
          { trackingNumber: { startsWith: "REG-" } }
        ]
      }
    },
    include: {
      enrollmentApplication: {
        select: {
          applicantType: true,
          learnerId: true
        }
      }
    }
  });

  if (records.length === 0) {
    console.warn("⚠️ No 'STE-' or 'REG-' records found in 2025-2026. Run db:seed-enrolled-learners first.");
    return;
  }

  console.log(`📊 Processing ${records.length} enrollment records for 2025-2026...`);

  const BATCH_SIZE = 100;
  let processed = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    await prisma.$transaction(
      batch.map((record) => {
        const isSTE = record.enrollmentApplication.applicantType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING";
        const grade = generateGrade(isSTE);
        let eosyStatus: EosyStatus = grade >= 75 ? "PROMOTED" : "RETAINED";
        let remarks = `Final Ave: ${grade.toFixed(2)}`;
        
        return prisma.enrollmentRecord.update({
          where: { id: record.id },
          data: {
            eosyStatus,
            sf1Remarks: remarks,
            finalAverage: grade,
            enrollmentApplication: {
              update: {
                learner: {
                  update: {
                    promotionStatus: eosyStatus === "PROMOTED" ? "PROMOTED" : "RETAINED"
                  }
                }
              }
            }
          }
        });
      })
    );

    processed += batch.length;
    if (processed % 500 === 0 || processed === records.length) {
      console.log(`  - Updated ${processed}/${records.length} student records...`);
    }
  }

  console.log(`\n✅ Successfully seeded EOSY statuses for 2025-2026.`);
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
