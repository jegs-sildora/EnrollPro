/**
 * seed-scp-ready-for-sectioning.ts
 *
 * Transitions all SCP (STE / SPA / SPS) incoming Grade 7 applicants for
 * SY 2026-2027 that are in PASSED status into READY_FOR_SECTIONING by:
 *
 *   1. Setting confirmationConsent = true
 *   2. Adding Phil-IRI reading profile level (if not already set)
 *   3. Setting status = READY_FOR_SECTIONING
 *
 * This is idempotent — applicants that are already READY_FOR_SECTIONING
 * or beyond are left untouched.
 *
 * Usage:
 *   pnpm --filter server run db:seed-scp-ready-for-sectioning
 */

import "dotenv/config";
import {
  PrismaClient,
  ApplicantType,
  ReadingProfileLevel,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SY_LABEL = "2026-2027";
const GRADE_LEVEL_NAME = "Grade 7";

const SCP_TYPES: ApplicantType[] = [
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
];

// Same distribution used in seed-g7-incoming-batch-sectioning
// ~33% INDEPENDENT, ~44% INSTRUCTIONAL, ~17% FRUSTRATION, ~6% NON_READER
const READING_POOL: ReadingProfileLevel[] = [
  "INDEPENDENT",
  "INDEPENDENT",
  "INDEPENDENT",
  "INSTRUCTIONAL",
  "INSTRUCTIONAL",
  "INSTRUCTIONAL",
  "INSTRUCTIONAL",
  "FRUSTRATION",
  "FRUSTRATION",
  "NON_READER",
];

function pickReadingLevel(id: number): ReadingProfileLevel {
  return READING_POOL[Math.abs(id) % READING_POOL.length];
}

async function main(): Promise<void> {
  console.log(
    "Seeding SCP applicants to READY_FOR_SECTIONING (SY 2026-2027, Grade 7)...\n",
  );

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: SY_LABEL },
    select: { id: true },
  });

  const grade7 = await prisma.gradeLevel.findFirst({
    where: { name: GRADE_LEVEL_NAME },
    select: { id: true },
  });

  const admin = await prisma.user.findFirst({
    where: { role: "SYSTEM_ADMIN" },
    select: { id: true },
  });

  if (!targetYear || !grade7 || !admin) {
    throw new Error("Missing SY 2026-2027, Grade 7, or SYSTEM_ADMIN user.");
  }

  const passedApps = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId: targetYear.id,
      gradeLevelId: grade7.id,
      applicantType: { in: SCP_TYPES },
      learnerType: "NEW_ENROLLEE",
      status: "PASSED",
    },
    select: {
      id: true,
      applicantType: true,
      readingProfileLevel: true,
    },
  });

  if (passedApps.length === 0) {
    console.log("No PASSED SCP Grade 7 applicants found for SY 2026-2027. Nothing to seed.");
    return;
  }

  console.log(`Found ${passedApps.length} PASSED SCP applicants to transition.\n`);

  const ASSESSED_AT = new Date("2026-05-27T08:00:00.000Z");

  let transitioned = 0;
  let philIriAdded = 0;
  let philIriKept = 0;

  for (const app of passedApps) {
    const hasPhilIri = app.readingProfileLevel != null;
    const philIriLevel = hasPhilIri
      ? app.readingProfileLevel
      : pickReadingLevel(app.id);

    await prisma.enrollmentApplication.update({
      where: { id: app.id },
      data: {
        status: "READY_FOR_SECTIONING",
        confirmationConsent: true,
        readingProfileLevel: philIriLevel,
        ...(!hasPhilIri
          ? {
              readingProfileAssessedAt: ASSESSED_AT,
              readingProfileAssessedById: admin.id,
            }
          : {}),
      },
    });

    transitioned++;
    if (hasPhilIri) {
      philIriKept++;
    } else {
      philIriAdded++;
    }
  }

  // Summary by program type
  const byType = passedApps.reduce<Record<string, number>>((acc, app) => {
    const key = String(app.applicantType);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  console.log("Transition complete.");
  console.log(`  Total transitioned : ${transitioned}`);
  console.log(`  Phil-IRI added     : ${philIriAdded}`);
  console.log(`  Phil-IRI kept      : ${philIriKept}`);
  console.log("\nBreakdown by program:");
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type}: ${count}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
