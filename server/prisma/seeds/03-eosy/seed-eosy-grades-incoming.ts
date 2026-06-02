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
  return base + (index % range);
}

async function main() {
  console.log(
    "≡ƒÜÇ Seeding End-of-School-Year (EOSY) Grades for Incoming Enrolled Learners...",
  );

  const activeYear = await prisma.schoolYear.findFirst({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { id: "desc" },
  });

  if (!activeYear) throw new Error("No valid school year found.");

  // Fetch enrollment records for incoming enrolled learners (tracking number starts with ENR-)
  const records = await prisma.enrollmentRecord.findMany({
    where: {
      schoolYearId: activeYear.id,
      enrollmentApplication: {
        trackingNumber: { startsWith: "ENR-" },
      },
    },
    include: {
      enrollmentApplication: {
        select: {
          applicantType: true,
          learnerId: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  console.log(
    `≡ƒôè Processing ${records.length} incoming enrolled learner records...`,
  );

  const BATCH_SIZE = 200;
  let processed = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    await prisma.$transaction(
      batch.map((record, batchIdx) => {
        // For incoming learners, we'll assume they are regular unless specified otherwise
        // (seed-enrolled-learners.ts sets applicantType: "REGULAR")
        const isSTE =
          record.enrollmentApplication.applicantType ===
          "SCIENCE_TECHNOLOGY_AND_ENGINEERING";
        const grade = deterministicGrade(i + batchIdx, isSTE);

        // Promotion Logic
        let eosyStatus: EosyStatus = grade >= 75 ? "PROMOTED" : "RETAINED";

        // Edge Case: Conditional (Failing 1-2 subjects but passing average)
        let remarks = `Final Ave: ${grade}`;
        const isConditional =
          grade >= 75 && grade < 80 && (i + batchIdx) % 20 === 0; // every 20th low-passing student
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
                    promotionStatus:
                      eosyStatus === "PROMOTED" ? "PROMOTED" : "RETAINED",
                  },
                },
              },
            },
          },
        });
      }),
    );

    processed += batch.length;
    if (processed % 100 === 0 || processed === records.length) {
      console.log(`  - Updated ${processed}/${records.length} records...`);
    }
  }

  console.log("Γ£à EOSY grades for incoming learners seeded successfully.");
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
