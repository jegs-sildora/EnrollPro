import "dotenv/config";
import { PrismaClient, EosyStatus } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Generates a random number following a normal distribution (bell curve).
 * Uses the Box-Muller transform.
 */
function generateNormalRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z * stdDev;
}

/**
 * Generates a DepEd compliant integer grade (60-100).
 */
function generateGrade(isSTE: boolean): number {
  // STE students generally have higher averages
  const mean = isSTE ? 89 : 83;
  const stdDev = isSTE ? 4 : 6;
  
  let grade = Math.round(generateNormalRandom(mean, stdDev));
  
  // Clamp values
  if (grade < 60) grade = 60;
  if (grade > 100) grade = 100;
  
  return grade;
}

async function main() {
  console.log("🚀 Seeding End-of-School-Year (EOSY) Grades for Incoming Enrolled Learners...");

  const activeYear = await prisma.schoolYear.findFirst({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { id: "desc" }
  });

  if (!activeYear) throw new Error("No valid school year found.");

  // Fetch enrollment records for incoming enrolled learners (tracking number starts with ENR-)
  const records = await prisma.enrollmentRecord.findMany({
    where: { 
      schoolYearId: activeYear.id,
      enrollmentApplication: {
        trackingNumber: { startsWith: "ENR-" }
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

  console.log(`📊 Processing ${records.length} incoming enrolled learner records...`);

  const BATCH_SIZE = 200;
  let processed = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    await prisma.$transaction(
      batch.map((record) => {
        // For incoming learners, we'll assume they are regular unless specified otherwise 
        // (seed-enrolled-learners.ts sets applicantType: "REGULAR")
        const isSTE = record.enrollmentApplication.applicantType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING";
        const grade = generateGrade(isSTE);
        
        // Promotion Logic
        let eosyStatus: EosyStatus = grade >= 75 ? "PROMOTED" : "RETAINED";
        
        // Edge Case: Conditional (Failing 1-2 subjects but passing average)
        let remarks = `Final Ave: ${grade}`;
        const isConditional = grade >= 75 && grade < 80 && Math.random() < 0.05; // 5% of low-passing students
        if (isConditional) {
          remarks += " | Conditional: Passed with back subjects (Math/Science)";
        }

        return prisma.enrollmentRecord.update({
          where: { id: record.id },
          data: {
            eosyStatus,
            sf1Remarks: remarks,
            enrollmentApplication: {
              update: {
                learner: {
                  update: {
                    previousGenAve: grade,
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
    if (processed % 100 === 0 || processed === records.length) {
      console.log(`  - Updated ${processed}/${records.length} records...`);
    }
  }

  console.log("✅ EOSY grades for incoming learners seeded successfully.");
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
