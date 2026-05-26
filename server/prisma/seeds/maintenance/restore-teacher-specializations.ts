/**
 * Restore seed: Reverts the changes made by backfill-teacher-specializations.ts.
 *
 * Restores the 10 teachers that were changed by the backfill back to their
 * original specialization values as recorded from the backfill output.
 *
 * Run with:
 *   pnpm --filter server run db:restore-teacher-specializations
 */

import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Original specializations recorded from the backfill output.
// Key: "LASTNAME|FIRSTNAME" → original specialization before the backfill.
// ---------------------------------------------------------------------------
const ORIGINAL_SPECIALIZATIONS: {
  lastName: string;
  firstName: string;
  original: string;
}[] = [
  // TLE teachers — originally "MAJOR IN AGRI-FISHERY ARTS"
  {
    lastName: "RODRIGUEZ",
    firstName: "ROSA",
    original: "MAJOR IN AGRI-FISHERY ARTS",
  },
  {
    lastName: "SILANG",
    firstName: "IMELDA",
    original: "MAJOR IN AGRI-FISHERY ARTS",
  },
  {
    lastName: "VILLANUEVA",
    firstName: "REMEDIOS",
    original: "MAJOR IN AGRI-FISHERY ARTS",
  },
  {
    lastName: "ALVAREZ",
    firstName: "MILAGROS",
    original: "MAJOR IN AGRI-FISHERY ARTS",
  },
  {
    lastName: "NATIVIDAD",
    firstName: "QUINTINA",
    original: "MAJOR IN AGRI-FISHERY ARTS",
  },
  // ENG teachers — originally "LITERATURE / CREATIVE WRITING"
  {
    lastName: "PASCUAL",
    firstName: "CELIA",
    original: "LITERATURE / CREATIVE WRITING",
  },
  {
    lastName: "NAVARRO",
    firstName: "JUAN",
    original: "LITERATURE / CREATIVE WRITING",
  },
  {
    lastName: "AQUINO",
    firstName: "NICOLE",
    original: "LITERATURE / CREATIVE WRITING",
  },
  {
    lastName: "MAGSAYSAY",
    firstName: "GABRIEL",
    original: "LITERATURE / CREATIVE WRITING",
  },
  {
    lastName: "MACAPAGAL",
    firstName: "ELPIDIO",
    original: "LITERATURE / CREATIVE WRITING",
  },
];

async function main() {
  console.log(
    "🔄 Restore: Reverting teacher specializations to pre-backfill values...\n",
  );

  let restored = 0;
  let notFound = 0;
  let alreadyRestored = 0;

  for (const entry of ORIGINAL_SPECIALIZATIONS) {
    const teacher = await prisma.teacher.findFirst({
      where: {
        lastName: entry.lastName,
        firstName: entry.firstName,
      },
    });

    if (!teacher) {
      console.warn(`  ⚠️  Not found: ${entry.lastName}, ${entry.firstName}`);
      notFound++;
      continue;
    }

    if (teacher.specialization === entry.original) {
      console.log(
        `  ⏭️  ${teacher.lastName}, ${teacher.firstName} — already restored ("${entry.original}")`,
      );
      alreadyRestored++;
      continue;
    }

    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { specialization: entry.original },
    });

    console.log(
      `  ✅ ${teacher.lastName}, ${teacher.firstName}` +
        `\n     "${teacher.specialization ?? "(null)"}" → "${entry.original}"`,
    );
    restored++;
  }

  console.log("\n========== RESTORE SUMMARY ==========");
  console.log(`  Specializations restored : ${restored}`);
  console.log(`  Already at original      : ${alreadyRestored}`);
  console.log(`  Not found in DB          : ${notFound}`);
  console.log("=====================================\n");

  if (restored === 0 && notFound === 0) {
    console.log("✨ All teachers already have their original specializations.");
  } else if (notFound > 0) {
    console.log("⚠️  Some teachers were not found — check names above.");
  } else {
    console.log("✅ Restore complete.");
  }
}

main()
  .catch((e) => {
    console.error("❌ Restore failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
