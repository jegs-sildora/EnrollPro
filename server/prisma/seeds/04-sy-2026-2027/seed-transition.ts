import "dotenv/config";
import {
  PrismaClient,
  EosyStatus,
  ApplicationStatus,
  LearnerType,
  LearnerStatus,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("≡ƒÜÇ Transitioning 2025-2026 Learners to 2026-2027...");

  // 1. Get School Years
  const sy2526 = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2025-2026" },
  });

  const sy2627 = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
  });

  if (!sy2526 || !sy2627) {
    throw new Error(
      "School year context missing. Ensure both 2025-2026 and 2026-2027 are seeded.",
    );
  }

  // 1.5 Cleanup existing 2026-2027 Enrollment Data
  console.log("🧹 Clearing existing 2026-2027 enrollment data...");
  await prisma.enrollmentRecord.deleteMany({ where: { schoolYearId: sy2627.id } });
  await prisma.enrollmentApplication.deleteMany({ where: { schoolYearId: sy2627.id } });

  // 2. Get Grade Levels
  const gradeLevels = await prisma.gradeLevel.findMany({
    orderBy: { displayOrder: "asc" },
  });

  const gradeMap = new Map(gradeLevels.map((gl) => [gl.name, gl]));

  // 3. Get Admin for encoding/enrolling
  const admin = await prisma.user.findFirst({
    where: { role: "SYSTEM_ADMIN" },
  });
  if (!admin) throw new Error("No SYSTEM_ADMIN found.");

  // 4. Get all TLE Programs for G9/G10 assignment
  const tlePrograms = await prisma.tLEProgram.findMany({
    where: { isActive: true },
  });

  // 5. Get 2025-2026 Enrollment Records
  const records2526 = await prisma.enrollmentRecord.findMany({
    where: { schoolYearId: sy2526.id },
    include: {
      enrollmentApplication: {
        include: {
          gradeLevel: true,
          learner: true,
        },
      },
      section: true,
    },
  });

  console.log(`≡ƒôè Found ${records2526.length} learners from 2025-2026.`);

  let promotedCount = 0;
  let retainedCount = 0;
  let graduatesCount = 0;
  let skippedCount = 0;
  let noSectionCount = 0;
  let statusSkippedCount = 0;

  for (const record of records2526) {
    const learner = record.enrollmentApplication.learner;
    const currentGrade = record.enrollmentApplication.gradeLevel;
    const eosyStatus = record.eosyStatus;

    // EOSY Status Logic: 
    // PROMOTED or null -> Next Grade
    // RETAINED -> Same Grade
    // DROPPED_OUT/TRANSFERRED_OUT -> Skip
    
    if (eosyStatus === "DROPPED_OUT" || eosyStatus === "TRANSFERRED_OUT") {
      statusSkippedCount++;
      skippedCount++;
      continue;
    }

    const isPromoted = eosyStatus === "PROMOTED" || eosyStatus === null;
    
    // Determine target Grade Level
    let targetGradeName = currentGrade.name;
    if (isPromoted) {
      if (currentGrade.name === "Grade 7") targetGradeName = "Grade 8";
      else if (currentGrade.name === "Grade 8") targetGradeName = "Grade 9";
      else if (currentGrade.name === "Grade 9") targetGradeName = "Grade 10";
      else if (currentGrade.name === "Grade 10") {
        // Grade 10 graduates - Mark as JHS_COMPLETER
        await prisma.learner.update({
          where: { id: learner.id },
          data: { status: "JHS_COMPLETER" as LearnerStatus },
        });
        graduatesCount++;
        continue;
      }
    }

    const targetGrade = gradeMap.get(targetGradeName);
    if (!targetGrade) {
      skippedCount++;
      continue;
    }

    // Prepare 2026-2027 Enrollment Application
    // Use full LRN to avoid collisions. If no LRN, use ID and random.
    const trackingNumber = `REG-2026-${learner.lrn || `ID${learner.id}-${Math.floor(Math.random() * 1000)}`}`;

    // TLE Logic: G9/G10 needs a program.
    let targetTleProgramId = record.tleProgramId;
    if ((targetGradeName === "Grade 9" || targetGradeName === "Grade 10") && !targetTleProgramId && tlePrograms.length > 0) {
      // Assign based on learner ID for determinism during re-runs
      targetTleProgramId = tlePrograms[learner.id % tlePrograms.length].id;
    }

    const application = await prisma.enrollmentApplication.upsert({
      where: {
        trackingNumber,
      },
      update: {
        status: "ENROLLED" as ApplicationStatus,
        gradeLevelId: targetGrade.id,
        tleProgramId: targetTleProgramId,
      },
      create: {
        learnerId: learner.id,
        schoolYearId: sy2627.id,
        gradeLevelId: targetGrade.id,
        applicantType: record.enrollmentApplication.applicantType,
        learnerType: "CONTINUING" as LearnerType,
        status: "ENROLLED" as ApplicationStatus,
        trackingNumber,
        isPrivacyConsentGiven: true,
        admissionChannel: record.enrollmentApplication.admissionChannel,
        encodedById: admin.id,
        readingProfileLevel: record.enrollmentApplication.readingProfileLevel,
        tleProgramId: targetTleProgramId,
        portalPin: record.enrollmentApplication.portalPin,
      },
    });

    // Find a section in 2026-2027 for the target grade level
    // Match by programType (e.g., STE to STE)
    const sections2627 = await prisma.section.findMany({
      where: {
        gradeLevelId: targetGrade.id,
        schoolYearId: sy2627.id,
        programType: record.section.programType,
      },
    });

    if (sections2627.length > 0) {
      // Assign to a section based on learner ID to distribute them
      const section = sections2627[learner.id % sections2627.length];

      await prisma.enrollmentRecord.upsert({
        where: {
          enrollmentApplicationId: application.id,
        },
        update: {
          sectionId: section.id,
          enrolledById: admin.id,
          tleProgramId: targetTleProgramId,
        },
        create: {
          enrollmentApplicationId: application.id,
          sectionId: section.id,
          schoolYearId: sy2627.id,
          enrolledById: admin.id,
          learnerId: learner.id,
          tleProgramId: targetTleProgramId,
          enrolledAt: new Date(),
          confirmationConsent: true,
        },
      });
      
      if (isPromoted) promotedCount++;
      else retainedCount++;
    } else {
      noSectionCount++;
      skippedCount++;
    }

    if ((promotedCount + retainedCount + graduatesCount + skippedCount) % 500 === 0) {
      console.log(`  ≡ƒôè Progress: ${promotedCount + retainedCount} Enrolled, ${graduatesCount} Graduates, ${skippedCount} Skipped...`);
    }
  }

  console.log("\nΓ£à Transition Complete:");
  console.log(`  - Promoted: ${promotedCount}`);
  console.log(`  - Retained: ${retainedCount}`);
  console.log(`  - Grade 10 JHS Completers: ${graduatesCount}`);
  console.log(`  - Skipped (Status): ${statusSkippedCount}`);
  console.log(`  - Skipped (No Target Section): ${noSectionCount}`);
  console.log(`  - Total Processed: ${promotedCount + retainedCount + graduatesCount + skippedCount}`);
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
