/**
 * Backfill: Sync isHomogeneous for all BEC (REGULAR) sections across every school year.
 *
 * Rules (mirrors seed-sections.ts logic):
 *   - REGULAR sections with sectionRank 1-5  → isHomogeneous = true  (Pilot / Homogeneous)
 *   - REGULAR sections with sectionRank > 5  → isHomogeneous = false (Heterogeneous)
 *   - REGULAR sections with no sectionRank   → isHomogeneous = false
 *   - Non-REGULAR sections (STE/SPA/SPS)     → isHomogeneous = false (always)
 *
 * Safe to re-run: only touches isHomogeneous, never changes names, capacity, or advisers.
 *
 *   pnpm --filter server run db:backfill-section-homogeneous
 */

import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔧 Backfilling isHomogeneous for all sections...\n");

  // 1. REGULAR sections, rank 1-5 → Homogeneous (Pilot)
  const pilotResult = await prisma.section.updateMany({
    where: {
      programType: "REGULAR",
      sectionRank: { not: null, lte: 5 },
    },
    data: { isHomogeneous: true },
  });

  // 2. REGULAR sections, rank > 5 → Heterogeneous
  const heteroResult = await prisma.section.updateMany({
    where: {
      programType: "REGULAR",
      sectionRank: { gt: 5 },
    },
    data: { isHomogeneous: false },
  });

  // 3. REGULAR sections with no rank → Heterogeneous (safety net)
  const noRankResult = await prisma.section.updateMany({
    where: {
      programType: "REGULAR",
      sectionRank: null,
    },
    data: { isHomogeneous: false },
  });

  // 4. Non-REGULAR sections (STE / SPA / SPS) → always false
  const scpResult = await prisma.section.updateMany({
    where: {
      programType: { not: "REGULAR" },
    },
    data: { isHomogeneous: false },
  });

  console.log("📊 Results:");
  console.log(
    `   BEC Homogeneous (Pilot, rank 1-5)   : ${pilotResult.count} sections updated`,
  );
  console.log(
    `   BEC Heterogeneous (rank 6+)          : ${heteroResult.count} sections updated`,
  );
  console.log(
    `   BEC no rank → Heterogeneous          : ${noRankResult.count} sections updated`,
  );
  console.log(
    `   STE / SPA / SPS → not homogeneous   : ${scpResult.count} sections updated`,
  );
  console.log(
    `\n   Total touched                        : ${pilotResult.count + heteroResult.count + noRankResult.count + scpResult.count}`,
  );

  // Verify: show a per-school-year breakdown
  console.log("\n📋 Verification — section counts by school year:");
  const schoolYears = await prisma.schoolYear.findMany({
    orderBy: { yearLabel: "asc" },
  });
  for (const sy of schoolYears) {
    const [homogeneous, heterogeneous, scp] = await Promise.all([
      prisma.section.count({
        where: {
          schoolYearId: sy.id,
          programType: "REGULAR",
          isHomogeneous: true,
        },
      }),
      prisma.section.count({
        where: {
          schoolYearId: sy.id,
          programType: "REGULAR",
          isHomogeneous: false,
        },
      }),
      prisma.section.count({
        where: { schoolYearId: sy.id, programType: { not: "REGULAR" } },
      }),
    ]);
    if (homogeneous + heterogeneous + scp === 0) continue;
    console.log(
      `   ${sy.yearLabel}  →  BEC Pilot: ${String(homogeneous).padStart(2)}, BEC Hetero: ${String(heterogeneous).padStart(2)}, SCP (STE/SPA/SPS): ${String(scp).padStart(2)}`,
    );
  }

  console.log("\n✅ Done.");
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
