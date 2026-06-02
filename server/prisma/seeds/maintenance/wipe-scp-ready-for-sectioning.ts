/**
 * wipe-scp-ready-for-sectioning.ts
 *
 * Reverts the work done by seed-scp-ready-for-sectioning.ts:
 *
 *   - Finds all SCP (STE / SPA / SPS) incoming Grade 7 enrollment applications
 *     for SY 2026-2027 that are currently READY_FOR_SECTIONING
 *   - Reverts their status back to PASSED
 *   - Clears confirmationConsent, readingProfileLevel, and related Phil-IRI fields
 *
 * Safe to run multiple times (idempotent).
 *
 * NOTE: This only targets NEW_ENROLLEE SCP applicants in READY_FOR_SECTIONING
 * for Grade 7 SY 2026-2027.  It will NOT touch learners who have already been
 * assigned to a section (PENDING_CONFIRMATION or beyond that path) or any
 * non-SCP applicants.
 *
 * Usage:
 *   pnpm --filter server run db:wipe-scp-ready-for-sectioning
 */

import "dotenv/config";
import {
  PrismaClient,
  ApplicantType,
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

async function main(): Promise<void> {
  console.log(
    "Reverting SCP READY_FOR_SECTIONING applicants → PASSED (SY 2026-2027, Grade 7)...\n",
  );

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: SY_LABEL },
    select: { id: true },
  });

  const grade7 = await prisma.gradeLevel.findFirst({
    where: { name: GRADE_LEVEL_NAME },
    select: { id: true },
  });

  if (!targetYear || !grade7) {
    console.log("Target school year or grade level not found. Nothing to revert.");
    return;
  }

  const targetApps = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId: targetYear.id,
      gradeLevelId: grade7.id,
      applicantType: { in: SCP_TYPES },
      learnerType: "NEW_ENROLLEE",
      status: "READY_FOR_SECTIONING",
    },
    select: { id: true, applicantType: true },
  });

  if (targetApps.length === 0) {
    console.log(
      "No SCP Grade 7 READY_FOR_SECTIONING applicants found. Nothing to revert.",
    );
    return;
  }

  console.log(`Found ${targetApps.length} applicants to revert.\n`);

  const appIds = targetApps.map((app) => app.id);

  const result = await prisma.enrollmentApplication.updateMany({
    where: { id: { in: appIds } },
    data: {
      status: "PASSED",
      confirmationConsent: false,
      readingProfileLevel: null,
      readingProfileAssessedAt: null,
      readingProfileAssessedById: null,
    },
  });

  // Summary by program type
  const byType = targetApps.reduce<Record<string, number>>((acc, app) => {
    const key = String(app.applicantType);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Reverted ${result.count} SCP applicants back to PASSED.`);
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
