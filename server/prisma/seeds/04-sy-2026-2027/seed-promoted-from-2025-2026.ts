import "dotenv/config";
import {
  PrismaClient,
  ApplicationStatus,
  LearnerType,
  EosyStatus,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding promoted learners from 2025-2026 to 2026-2027...");

  const sourceYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2025-2026" },
  });

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
  });

  if (!sourceYear || !targetYear) {
    throw new Error(
      "Missing school year context. Seed 2025-2026 and 2026-2027 first.",
    );
  }

  const gradeLevels = await prisma.gradeLevel.findMany({
    orderBy: { displayOrder: "asc" },
  });
  const byDisplayOrder = new Map<number, number>();
  for (const gl of gradeLevels) {
    byDisplayOrder.set(gl.displayOrder, gl.id);
  }

  const promotedRecords = await prisma.enrollmentRecord.findMany({
    where: {
      schoolYearId: sourceYear.id,
      eosyStatus: EosyStatus.PROMOTED,
    },
    include: {
      enrollmentApplication: {
        include: {
          gradeLevel: { select: { displayOrder: true, name: true } },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  // Hard reset all target-year continuing apps so every continuing learner
  // returns to the Pending Confirmation stage before per-learner sync runs.
  const resetResult = await prisma.enrollmentApplication.updateMany({
    where: {
      schoolYearId: targetYear.id,
      learnerType: LearnerType.CONTINUING,
    },
    data: {
      status: ApplicationStatus.PENDING_CONFIRMATION,
      confirmationConsent: false,
      tleProgramId: null,
      tleProgramChoice2Id: null,
    },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const record of promotedRecords) {
    const sourceDisplayOrder = record.enrollmentApplication.gradeLevel.displayOrder;
    const targetDisplayOrder = sourceDisplayOrder + 1;
    const targetGradeLevelId = byDisplayOrder.get(targetDisplayOrder) ?? null;

    // Grade 10 promoted learners do not transition to this JHS target year.
    if (!targetGradeLevelId) {
      skipped += 1;
      continue;
    }

    const trackingNumber = `PROMO-2627-${record.enrollmentApplicationId}`;

    const existing = await prisma.enrollmentApplication.findFirst({
      where: {
        schoolYearId: targetYear.id,
        learnerId: record.learnerId,
        learnerType: LearnerType.CONTINUING,
        gradeLevelId: targetGradeLevelId,
      },
      orderBy: { id: "asc" },
      select: { id: true },
    });

    if (existing) {
      await prisma.enrollmentApplication.update({
        where: { id: existing.id },
        data: {
          learnerId: record.learnerId,
          schoolYearId: targetYear.id,
          gradeLevelId: targetGradeLevelId,
          applicantType: record.enrollmentApplication.applicantType,
          learnerType: LearnerType.CONTINUING,
          status: ApplicationStatus.PENDING_CONFIRMATION,
          admissionChannel: record.enrollmentApplication.admissionChannel,
          isPrivacyConsentGiven:
            record.enrollmentApplication.isPrivacyConsentGiven,
          guardianRelationship:
            record.enrollmentApplication.guardianRelationship,
          hasNoMother: record.enrollmentApplication.hasNoMother,
          hasNoFather: record.enrollmentApplication.hasNoFather,
          readingProfileLevel: record.enrollmentApplication.readingProfileLevel,
          encodedById: record.enrollmentApplication.encodedById,
          confirmationConsent: false,
          tleProgramId: null,
          tleProgramChoice2Id: null,
          trackingNumber,
        },
      });
      updated += 1;
      continue;
    }

    await prisma.enrollmentApplication.create({
      data: {
        learnerId: record.learnerId,
        schoolYearId: targetYear.id,
        gradeLevelId: targetGradeLevelId,
        applicantType: record.enrollmentApplication.applicantType,
        learnerType: LearnerType.CONTINUING,
        status: ApplicationStatus.PENDING_CONFIRMATION,
        admissionChannel: record.enrollmentApplication.admissionChannel,
        trackingNumber,
        isPrivacyConsentGiven: record.enrollmentApplication.isPrivacyConsentGiven,
        guardianRelationship: record.enrollmentApplication.guardianRelationship,
        hasNoMother: record.enrollmentApplication.hasNoMother,
        hasNoFather: record.enrollmentApplication.hasNoFather,
        readingProfileLevel: record.enrollmentApplication.readingProfileLevel,
        encodedById: record.enrollmentApplication.encodedById,
        confirmationConsent: false,
      },
    });
    created += 1;
  }

  console.log("Promoted learner transition seed complete.");
  console.log(`Reset existing continuing apps: ${resetResult.count}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no target grade): ${skipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
