import "dotenv/config";
import {
  PrismaClient,
  ApplicationStatus,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Must match the marker used in seed-demo-g7-learners.ts
const DEMO_SF1_REMARKS = "DEMO_SEED";
const DEMO_LRN_PREFIX = "229600";

// LRN of the learner to remove from STE SIRIUS for the demo
const SIRIUS_DEMO_LRN = "122672100023";

async function main() {
  console.log("🧹 Wiping Demo Grade 7 Learners for SY 2026-2027...\n");

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
  });
  if (!targetYear) {
    console.log("ℹ️  SY 2026-2027 not found. Nothing to wipe.");
    return;
  }

  const grade7 = await prisma.gradeLevel.findFirst({
    where: { name: "Grade 7" },
  });
  if (!grade7) {
    console.log("ℹ️  Grade 7 not found. Nothing to wipe.");
    return;
  }

  // -------------------------------------------------------------------
  // PART 1: Remove demo-seeded BEC learners (tagged with DEMO_SEED)
  // -------------------------------------------------------------------
  console.log(
    "Step 1: Finding demo-seeded enrollment records (sf1Remarks = DEMO_SEED)...",
  );

  const demoRecords = await prisma.enrollmentRecord.findMany({
    where: {
      schoolYearId: targetYear.id,
      sf1Remarks: DEMO_SF1_REMARKS,
      section: {
        gradeLevelId: grade7.id,
        programType: "REGULAR",
      },
    },
    select: {
      id: true,
      enrollmentApplicationId: true,
      learnerId: true,
    },
  });

  const appIds = [
    ...new Set(demoRecords.map((r) => r.enrollmentApplicationId)),
  ];
  const learnerIds = [...new Set(demoRecords.map((r) => r.learnerId))];

  console.log(`  Found ${demoRecords.length} demo enrollment records.`);
  console.log(
    `  Linked to ${appIds.length} applications and ${learnerIds.length} learners.`,
  );

  if (appIds.length > 0) {
    // Delete applications — cascades to EnrollmentRecord, ApplicationAddress,
    // ApplicationFamilyMember, ApplicationChecklist, EnrollmentPreviousSchool
    const deletedApps = await prisma.enrollmentApplication.deleteMany({
      where: { id: { in: appIds } },
    });
    console.log(
      `  🗑️  Deleted ${deletedApps.count} enrollment applications (and all cascaded records).`,
    );
  }

  // Delete the demo-seeded learners (identified by LRN prefix)
  // Only delete learners whose LRN starts with the demo prefix to avoid accidental data loss
  if (learnerIds.length > 0) {
    const deletedLearners = await prisma.learner.deleteMany({
      where: {
        id: { in: learnerIds },
        lrn: { startsWith: DEMO_LRN_PREFIX },
      },
    });
    console.log(
      `  🗑️  Deleted ${deletedLearners.count} demo-seeded learner records.`,
    );
  }

  // -------------------------------------------------------------------
  // PART 2: Remove learner LRN 122672100023 from STE SIRIUS
  // -------------------------------------------------------------------
  console.log(
    `\nStep 2: Removing learner LRN ${SIRIUS_DEMO_LRN} from Grade 7 STE SIRIUS...`,
  );

  const siriusLearner = await prisma.learner.findUnique({
    where: { lrn: SIRIUS_DEMO_LRN },
  });

  if (!siriusLearner) {
    console.log(
      `  ℹ️  Learner with LRN ${SIRIUS_DEMO_LRN} not found. Skipping.`,
    );
  } else {
    // Find their enrollment record for SY 2026-2027 Grade 7 in SIRIUS
    const siriusSection = await prisma.section.findFirst({
      where: {
        name: "SIRIUS",
        schoolYearId: targetYear.id,
        gradeLevelId: grade7.id,
      },
    });

    if (!siriusSection) {
      console.log("  ℹ️  SIRIUS section not found for SY 2026-2027. Skipping.");
    } else {
      const siriusRecord = await prisma.enrollmentRecord.findFirst({
        where: {
          learnerId: siriusLearner.id,
          schoolYearId: targetYear.id,
          sectionId: siriusSection.id,
        },
        select: { id: true, enrollmentApplicationId: true },
      });

      if (!siriusRecord) {
        console.log(
          `  ℹ️  No enrollment record found for LRN ${SIRIUS_DEMO_LRN} in SIRIUS. Skipping.`,
        );
      } else {
        // Delete the enrollment record
        await prisma.enrollmentRecord.delete({
          where: { id: siriusRecord.id },
        });

        // Reset the application status so the learner is still enrolled but unsectioned
        await prisma.enrollmentApplication.update({
          where: { id: siriusRecord.enrollmentApplicationId },
          data: { status: "ENROLLED" as ApplicationStatus },
        });

        console.log(
          `  🗑️  Removed LRN ${SIRIUS_DEMO_LRN} from SIRIUS section.`,
        );
        console.log(
          `  🔄  Application status reset to ENROLLED (learner is still in system).`,
        );
      }
    }
  }

  // -------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------
  const finalCounts = await prisma.section.findMany({
    where: {
      schoolYearId: targetYear.id,
      gradeLevelId: grade7.id,
    },
    include: {
      enrollmentRecords: {
        where: { schoolYearId: targetYear.id },
        select: { id: true },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  console.log("\n📊 Post-wipe enrollment counts:");
  for (const sec of finalCounts) {
    const count = sec.enrollmentRecords.length;
    console.log(
      `  ${sec.name.padEnd(25)} | ${sec.programType.padEnd(40)} | ${count}/${sec.maxCapacity}`,
    );
  }

  console.log("\n✅ Wipe complete!");
}

main()
  .catch((e) => {
    console.error("❌ Wipe failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
