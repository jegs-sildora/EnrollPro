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
  console.log("🎯 Applying '65/66' Presentation Strategy (STE 7-VEGA will remain pending).");

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2025-2026" }
  });

  if (!targetYear) throw new Error("Timeline failure: 2025-2026 not found.");

  // Identify the demo section
  const DEMO_SECTION_NAME = "STE 7-VEGA";
  const demoSection = await prisma.section.findFirst({
    where: { 
      name: DEMO_SECTION_NAME,
      schoolYearId: targetYear.id
    }
  });

  if (!demoSection) {
    console.warn(`⚠️ Demo section '${DEMO_SECTION_NAME}' not found. Defaulting to all-sections mode.`);
  }

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
      },
      section: {
        select: {
          id: true,
          name: true
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
  let processedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    await prisma.$transaction(
      batch.map((record) => {
        const isDemoSection = record.section.name === DEMO_SECTION_NAME;
        const isSTE = record.enrollmentApplication.applicantType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING";
        const grade = generateGrade(isSTE);
        
        // If it's the demo section, we populate grades but NOT the EOSY status.
        // This allows the user to click "Bulk Mark Promoted" live.
        const eosyStatus: EosyStatus | null = isDemoSection ? null : (grade >= 75 ? "PROMOTED" : "RETAINED");
        const remarks = `Final Ave: ${grade.toFixed(2)}`;
        
        if (isDemoSection) skippedCount++;
        else processedCount++;

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
                    promotionStatus: eosyStatus === "PROMOTED" ? "PROMOTED" : (eosyStatus === "RETAINED" ? "RETAINED" : null)
                  }
                }
              }
            }
          }
        });
      })
    );
  }

  console.log(`  - Updated ${processedCount} records with EOSY status.`);
  console.log(`  - Left ${skippedCount} records in '${DEMO_SECTION_NAME}' with null status for live demo.`);

  // Finalize all sections except the demo section
  console.log("\n🔒 Finalizing 65/66 sections...");
  
  const sections = await prisma.section.findMany({
    where: { schoolYearId: targetYear.id }
  });

  const updatePromises = sections.map((s) => {
    const isDemo = s.name === DEMO_SECTION_NAME;
    return prisma.section.update({
      where: { id: s.id },
      data: { isEosyFinalized: !isDemo }
    });
  });

  await Promise.all(updatePromises);
  
  console.log(`✅ Finalized ${sections.length - (demoSection ? 1 : 0)} sections.`);
  if (demoSection) {
    console.log(`✨ Section '${DEMO_SECTION_NAME}' is UNLOCKED and ready for presentation.`);
  }

  console.log(`\n✅ Successfully implemented '65/66' Presentation Strategy for 2025-2026.`);
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
