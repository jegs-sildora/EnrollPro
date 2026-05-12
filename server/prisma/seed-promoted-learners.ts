import "dotenv/config";
import {
  PrismaClient,
  ApplicantType,
  LearnerType,
  ApplicationStatus,
} from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🚀 Seeding promoted learners from 2025-2026 to 2026-2027...");

  // 1. Get Source and Target School Years
  const sourceYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2025-2026" },
  });
  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
  });

  if (!sourceYear || !targetYear) {
    throw new Error("Required school years (2025-2026 and 2026-2027) not found. Run base seed first.");
  }

  // 2. Get Grade Levels
  const gradeLevels = await prisma.gradeLevel.findMany({
    orderBy: { displayOrder: "asc" },
  });

  const gradeMap = new Map(gradeLevels.map(gl => [gl.id, gl]));
  const nextGradeMap = new Map();
  for (let i = 0; i < gradeLevels.length - 1; i++) {
    nextGradeMap.set(gradeLevels[i].id, gradeLevels[i + 1].id);
  }

  // 3. Find PROMOTED learners from source year
  const promotedRecords = await prisma.enrollmentRecord.findMany({
    where: {
      schoolYearId: sourceYear.id,
      eosyStatus: "PROMOTED",
    },
    include: {
      enrollmentApplication: true,
      learner: true,
    },
  });

  console.log(`🔍 Found ${promotedRecords.length} promoted learners in ${sourceYear.yearLabel}.`);

  const admin = await prisma.user.findFirst({
    where: { role: "SYSTEM_ADMIN" },
  });
  if (!admin) throw new Error("No SYSTEM_ADMIN found.");

  let promotedCount = 0;

  for (const record of promotedRecords) {
    const nextGradeLevelId = nextGradeMap.get(record.enrollmentApplication.gradeLevelId);
    
    // If no next grade level (e.g., Grade 10 completer), skip promotion seed
    if (!nextGradeLevelId) {
      console.log(`⏩ Skipping ${record.learner.firstName} ${record.learner.lastName} (Grade 10 completer).`);
      continue;
    }

    const nextGrade = gradeMap.get(nextGradeLevelId);
    const trackingNumber = `PROM-${targetYear.yearLabel.split("-")[0]}-${record.learner.lrn}`;

    // Create Enrollment Application for the new year
    await prisma.enrollmentApplication.upsert({
      where: { trackingNumber },
      update: {
        status: "READY_FOR_SECTIONING", // Promoted students are typically ready for sectioning
        gradeLevelId: nextGradeLevelId,
      },
      create: {
        learnerId: record.learnerId,
        gradeLevelId: nextGradeLevelId,
        schoolYearId: targetYear.id,
        applicantType: record.enrollmentApplication.applicantType,
        learnerType: "CONTINUING" as LearnerType,
        status: "READY_FOR_SECTIONING" as ApplicationStatus,
        trackingNumber,
        isPrivacyConsentGiven: true,
        admissionChannel: "ONLINE",
        encodedById: admin.id,
        guardianRelationship: record.enrollmentApplication.guardianRelationship || "PARENT",
        hasNoMother: record.enrollmentApplication.hasNoMother,
        hasNoFather: record.enrollmentApplication.hasNoFather,
      },
    });

    promotedCount++;
  }

  console.log(`\n🎉 Successfully seeded ${promotedCount} promoted learners to ${targetYear.yearLabel} as CONTINUING students.`);
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
