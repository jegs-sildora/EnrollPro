/**
 * Maintenance seed: Backfill teacher specializations to valid DepEd JHS values.
 *
 * Replaces all free-text or invalid specializations (e.g. "BSEd Filipino",
 * "BTVTEd Agri-Fishery Arts") with values from DEPED_TEACHER_SPECIALIZATION_VALUES,
 * keyed per department. No "MAJOR IN AGRI-FISHERY ARTS" is assigned.
 *
 * The mapping is deterministic (teacher.id % pool.length), so re-runs are idempotent
 * only when the assignment is already a valid enum value — otherwise it re-assigns
 * to the correct pool.
 *
 * Run with:
 *   pnpm --filter server run db:backfill-teacher-specializations
 */

import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Valid specialization pools per department code (from DEPED_TEACHER_SPECIALIZATION_VALUES)
// These exactly match the shared constants enum — no free-text entries.
// ---------------------------------------------------------------------------
const DEPT_SPECIALIZATIONS: Record<string, string[]> = {
  ENG: [
    "BSED ENGLISH",
    "MAJOR IN ENGLISH / APPLIED LINGUISTICS",
    "MASS COMMUNICATION",
    "JOURNALISM",
    "MAJOR IN ENGLISH (CAMPUS JOURNALISM)",
  ],
  MATH: [
    "BSED MATHEMATICS",
    "MAJOR IN MATHEMATICS",
    "MAJOR IN MATHEMATICS (WITH STATISTICS BACKGROUND)",
  ],
  SCI: [
    "BSED SCIENCE",
    "MAJOR IN GENERAL SCIENCE / BIOLOGY / CHEMISTRY / PHYSICS",
    "MAJOR IN BIOLOGY",
    "MAJOR IN CHEMISTRY",
    "MAJOR IN PHYSICS",
  ],
  FIL: [
    "BSED FILIPINO",
    "MAJOR IN FILIPINO",
    "MAJOR IN FILIPINO (CAMPUS JOURNALISM)",
    "LINGUISTICS",
  ],
  AP: [
    "BSED SOCIAL STUDIES",
    "MAJOR IN SOCIAL STUDIES / HISTORY",
    "MAJOR IN ARALING PANLIPUNAN",
  ],
  MAPEH: [
    "BSED MAPEH",
    "MAJOR IN MAPEH",
    "MAJOR IN MUSIC EDUCATION",
    "MAJOR IN PHYSICAL EDUCATION",
    "MAJOR IN HEALTH EDUCATION",
    "FINE ARTS",
    "THEATER / PERFORMING ARTS",
    "DANCE",
  ],
  TLE: [
    "BSED TLE",
    "BTVTED / TVL",
    "MAJOR IN HOME ECONOMICS",
    "MAJOR IN INDUSTRIAL ARTS",
    "MAJOR IN ICT",
    "MAJOR IN ELECTRICAL INSTALLATION AND MAINTENANCE",
    "MAJOR IN COOKERY / FOOD AND BEVERAGE SERVICES",
    "MAJOR IN DRESSMAKING / GARMENTS",
    "MAJOR IN COMPUTER SYSTEMS SERVICING",
  ],
  ESP: [
    "BSED VALUES EDUCATION",
    "MAJOR IN VALUES EDUCATION",
    "MAJOR IN EDUKASYON SA PAGPAPAKATAO",
  ],
};

// All valid values from DEPED_TEACHER_SPECIALIZATION_VALUES (for fast lookup)
const ALL_VALID = new Set(Object.values(DEPT_SPECIALIZATIONS).flat());

async function main() {
  console.log("🔍 Backfill: Fixing teacher specializations...\n");

  const teachers = await prisma.teacher.findMany({
    include: { department: true },
    orderBy: { id: "asc" },
  });

  console.log(`📋 Found ${teachers.length} teacher(s) to inspect.\n`);

  let fixed = 0;
  let skipped = 0;

  for (const teacher of teachers) {
    const deptCode = teacher.department?.code ?? null;
    const pool = deptCode ? (DEPT_SPECIALIZATIONS[deptCode] ?? null) : null;

    // Already a valid enum value → skip
    if (teacher.specialization && ALL_VALID.has(teacher.specialization)) {
      skipped++;
      continue;
    }

    // No department mapped → leave as-is, just warn
    if (!pool) {
      console.warn(
        `  ⚠️  Teacher #${teacher.id} ${teacher.lastName}, ${teacher.firstName} has no mapped dept (${deptCode ?? "none"}) — skipped`,
      );
      skipped++;
      continue;
    }

    // Pick deterministically from the dept pool using teacher.id
    const newSpec = pool[teacher.id % pool.length];

    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { specialization: newSpec },
    });

    console.log(
      `  ✅ ${teacher.lastName}, ${teacher.firstName} [${deptCode}]` +
        `\n     "${teacher.specialization ?? "(null)"}" → "${newSpec}"`,
    );
    fixed++;
  }

  console.log("\n========== BACKFILL SUMMARY ==========");
  console.log(`  Specializations updated : ${fixed}`);
  console.log(`  Already valid / skipped : ${skipped}`);
  console.log("======================================\n");

  if (fixed === 0) {
    console.log("✨ All teachers already have valid specializations.");
  } else {
    console.log("✅ Backfill complete.");
  }
}

main()
  .catch((e) => {
    console.error("❌ Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
