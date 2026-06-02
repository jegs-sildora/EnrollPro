import "dotenv/config";
import {
  PrismaClient,
  EosyStatus,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Strategy: Generate safe baseline grades so our injected anomalies stand out.
// BEC (Regular) gets 76-94. SCP (STE/SPA/SPS) gets 87-97.
function deterministicGrade(index: number, isSCP: boolean): number {
  const base = isSCP ? 87 : 76;
  const range = isSCP ? 11 : 19;
  const grade = base + (index % range);
  return parseFloat(grade.toFixed(2));
}

async function main() {
  console.log(
    "🏫 Seeding End-of-School-Year (EOSY) Grades for 2025-2026 (Mock SMART Data)...",
  );
  console.log(
    "📻 Applying '65/66' Presentation Strategy (BEC demo section AGONCILLO will remain pending).",
  );
  console.log(
    "🎯 Injecting edge cases: 1 Retained BEC student, 1 Demoted student per SCP section.",
  );

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2025-2026" },
  });

  if (!targetYear) throw new Error("Timeline failure: 2025-2026 not found.");

  // Identify the demo section
  const DEMO_SECTION_THEME = "AGONCILLO";
  const demoSection = await prisma.section.findFirst({
    where: {
      name: DEMO_SECTION_THEME,
      schoolYearId: targetYear.id,
      programType: "REGULAR",
    },
  });

  if (!demoSection) {
    console.warn(
      `⚠️ Demo section '${DEMO_SECTION_THEME}' (STE) not found. Defaulting to all-sections mode.`,
    );
  }

  const records = await prisma.enrollmentRecord.findMany({
    where: {
      schoolYearId: targetYear.id,
      // Fetching active students: they haven't dropped or transferred out
      transferOutDate: null,
      dropOutDate: null,
    },
    include: {
      enrollmentApplication: {
        select: {
          applicantType: true,
          learnerId: true,
        },
      },
      section: {
        select: {
          id: true,
          name: true,
          programType: true,
        },
      },
      learner: {
        select: {
          lastName: true,
          firstName: true,
        }
      }
    },
    orderBy: { id: "asc" },
  });

  if (records.length === 0) {
    console.warn("⚠️ No enrolled records found in 2025-2026. Run previous seeds first.");
    return;
  }

  console.log(`📊 Processing ${records.length} enrollment records for 2025-2026...`);

  // --- ANOMALY TRACKERS ---
  let injectedBecRetained = false;
  const injectedScpSections = new Set<number>(); 
  const anomalyLog: string[] = [];

  const BATCH_SIZE = 100;
  let processedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    await prisma.$transaction(
      batch.map((record, batchIdx) => {
        const isDemoSection = demoSection ? record.section.id === demoSection.id : false;
        
        // Define if student is in a Special Curricular Program
        const isSCP = record.section.programType !== "REGULAR";
        
        let grade = 0;

        // --- INJECT ANOMALIES ---
        if (!isSCP && !injectedBecRetained) {
          // Inject 1 Retained student in BEC
          grade = 73.50;
          injectedBecRetained = true;
          anomalyLog.push(`   -> RETAINED (BEC): ${record.learner.lastName}, ${record.learner.firstName} (${record.section.name}) - Grade: 73.50`);
        } else if (isSCP && !injectedScpSections.has(record.section.id)) {
          // Inject 1 Demoted/Shifted student per SCP section (Grade 85.00)
          grade = 85.00;
          injectedScpSections.add(record.section.id);
          anomalyLog.push(`   -> PROGRAM FALLOUT (SCP): ${record.learner.lastName}, ${record.learner.firstName} (${record.section.name}) - Grade: 85.00`);
        } else {
          // Baseline safe grades
          grade = deterministicGrade(i + batchIdx, isSCP);
        }

        // If it's the demo section, we populate grades but NOT the EOSY status.
        const eosyStatus: EosyStatus | null = isDemoSection
          ? null
          : grade >= 75
            ? "PROMOTED"
            : "RETAINED";
            
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
                    promotionStatus:
                      eosyStatus === "PROMOTED"
                        ? "PROMOTED"
                        : eosyStatus === "RETAINED"
                          ? "RETAINED"
                          : null,
                  },
                },
              },
            },
          },
        });
      }),
    );
  }

  console.log(`\n✅ Updated ${processedCount} records with EOSY status.`);
  console.log(`⏳ Left ${skippedCount} records in '${DEMO_SECTION_THEME}' with null status for live demo.`);
  
  console.log("\n🚨 INJECTED EDGE CASES FOR PRESENTATION:");
  anomalyLog.forEach(log => console.log(log));

  // Finalize all sections except the demo section
  console.log("\n🔒 Finalizing 65/66 sections...");

  const sections = await prisma.section.findMany({
    where: { schoolYearId: targetYear.id },
  });

  const updatePromises = sections.map((s) => {
    const isDemo = demoSection ? s.id === demoSection.id : false;
    return prisma.section.update({
      where: { id: s.id },
      data: { isEosyFinalized: !isDemo },
    });
  });

  await Promise.all(updatePromises);

  console.log(`✅ Finalized ${sections.length - (demoSection ? 1 : 0)} sections.`);
  if (demoSection) {
    console.log(`🟢 Section '${DEMO_SECTION_THEME}' is UNLOCKED and ready for presentation.`);
  }

  const shouldFinalizeSchoolYear = demoSection ? false : true;

  await prisma.schoolYear.update({
    where: { id: targetYear.id },
    data: { isEosyFinalized: shouldFinalizeSchoolYear },
  });

  console.log(`\n🎉 Successfully implemented '65/66' Presentation Strategy for 2025-2026.`);
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