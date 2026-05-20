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

function deterministicGrade(index: number, isSTE: boolean): number {
  const base = isSTE ? 82 : 72;
  const range = isSTE ? 17 : 21;
  const grade = base + (index % range);
  return parseFloat(grade.toFixed(2));
}

async function main() {
  console.log(
    "≡ƒÜÇ Seeding End-of-School-Year (EOSY) Grades for 2025-2026 (Mock SMART Data)...",
  );
  console.log(
    "📻 Applying '65/66' Presentation Strategy (STE demo section VEGA will remain pending).",
  );

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2025-2026" },
  });

  if (!targetYear) throw new Error("Timeline failure: 2025-2026 not found.");

  // Identify the demo section
  const DEMO_SECTION_THEME = "VEGA";
  const demoSection = await prisma.section.findFirst({
    where: {
      name: DEMO_SECTION_THEME,
      schoolYearId: targetYear.id,
      programType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
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
      enrollmentApplication: {
        OR: [
          { trackingNumber: { startsWith: "STE-" } },
          { trackingNumber: { startsWith: "REG-" } },
        ],
      },
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
        },
      },
    },
    orderBy: { id: "asc" },
  });

  if (records.length === 0) {
    console.warn(
      "ΓÜá∩╕Å No 'STE-' or 'REG-' records found in 2025-2026. Run db:seed-enrolled-learners first.",
    );
    return;
  }

  console.log(
    `≡ƒôè Processing ${records.length} enrollment records for 2025-2026...`,
  );

  const BATCH_SIZE = 100;
  let processedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    await prisma.$transaction(
      batch.map((record, batchIdx) => {
        const isDemoSection = demoSection ? record.section.id === demoSection.id : false;
        const isSTE =
          record.enrollmentApplication.applicantType ===
          "SCIENCE_TECHNOLOGY_AND_ENGINEERING";
        const grade = deterministicGrade(i + batchIdx, isSTE);

        // If it's the demo section, we populate grades but NOT the EOSY status.
        // This allows the user to click "Bulk Mark Promoted" live.
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

  console.log(`  - Updated ${processedCount} records with EOSY status.`);
  console.log(
    `  - Left ${skippedCount} records in '${DEMO_SECTION_THEME}' with null status for live demo.`,
  );

  // Finalize all sections except the demo section
  console.log("\n≡ƒöÆ Finalizing 65/66 sections...");

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

  console.log(
    `Γ£à Finalized ${sections.length - (demoSection ? 1 : 0)} sections.`,
  );
  if (demoSection) {
    console.log(
      `✅ Section '${DEMO_SECTION_THEME}' is UNLOCKED and ready for presentation.`,
    );
  }

  // Only finalize/archive the school year when ALL sections are finalized.
  // If VEGA is intentionally left open for demo flow, keep the school year unfinalized.
  const shouldFinalizeSchoolYear = demoSection ? false : true;

  await prisma.schoolYear.update({
    where: { id: targetYear.id },
    data: { isEosyFinalized: shouldFinalizeSchoolYear },
  });

  if (shouldFinalizeSchoolYear) {
    console.log(`✅ School year 2025-2026 marked as EOSY finalized.`);
  } else {
    console.log(
      `ℹ️ School year 2025-2026 remains NOT finalized because '${DEMO_SECTION_THEME}' is intentionally unfinalized.`,
    );
  }

  console.log(
    `\nΓ£à Successfully implemented '65/66' Presentation Strategy for 2025-2026.`,
  );
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
