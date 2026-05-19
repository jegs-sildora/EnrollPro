/**
 * wipe-tle-laboratories.ts
 *
 * Reverses the effects of seed-tle-laboratories.ts for the ACTIVE school year.
 *
 * What it removes (in safe order):
 *  1. Clears EnrollmentRecord.tleSectionId for learners assigned to TLE lab sections.
 *  2. Deletes SectionAdviser records for those lab sections.
 *  3. Deletes the TLE lab sections themselves (sections whose tleProgramId links to an
 *     active SPECIALIZATION TLE program in the active school year).
 *  4. Deletes placeholder Teacher records that were created by the seed
 *     (identified by lastName = "TLE ADVISER" and employeeId starting with "TL").
 *
 * What it preserves:
 *  - EnrollmentRecord rows — only clears tleSectionId, never deletes records.
 *  - Real teacher records (non-placeholder).
 *  - Homeroom sections (sectionId), TLE program catalog, school year, grade levels.
 *
 * Safe to re-run: all operations are idempotent.
 *
 * Usage:
 *   pnpm --filter server db:wipe-tle-laboratories
 */

import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 Wiping TLE Laboratory sections...\n");

  // --- Resolve active school year ---
  const activeSy = await prisma.schoolYear.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true, yearLabel: true },
  });
  if (!activeSy) {
    console.warn("⚠️  No ACTIVE school year found. Nothing to wipe.");
    return;
  }
  console.log(`  School year : ${activeSy.yearLabel}\n`);

  // --- Identify SPECIALIZATION TLE program IDs ---
  const specializationPrograms = await prisma.tLEProgram.findMany({
    where: { trackType: "SPECIALIZATION" },
    select: { id: true, name: true },
  });
  if (specializationPrograms.length === 0) {
    console.log("  No SPECIALIZATION TLE programs found. Nothing to wipe.");
    return;
  }
  const specializationIds = specializationPrograms.map((p) => p.id);

  // --- Find TLE lab sections for the active school year ---
  const labSections = await prisma.section.findMany({
    where: {
      schoolYearId: activeSy.id,
      tleProgramId: { in: specializationIds },
    },
    select: { id: true, name: true },
  });

  if (labSections.length === 0) {
    console.log("  No TLE lab sections found for the active school year.");
  } else {
    const labSectionIds = labSections.map((s) => s.id);
    console.log(`  Found ${labSections.length} TLE lab section(s) to process.`);

    // Step 1: Nullify EnrollmentRecord.tleSectionId (preserve the records themselves).
    const cleared = await prisma.enrollmentRecord.updateMany({
      where: { tleSectionId: { in: labSectionIds } },
      data: { tleSectionId: null },
    });
    console.log(
      `  ✔ Cleared tleSectionId on ${cleared.count} enrollment record(s).`,
    );

    // Identify which "lab" sections actually have homeroom learners — these are homeroom
    // sections that were accidentally given tleProgramId by a previous seed run.
    // We must repair (reset tleProgramId) rather than delete them.
    const corruptedHomeroom = await prisma.section.findMany({
      where: {
        id: { in: labSectionIds },
        enrollmentRecords: { some: {} },
      },
      select: { id: true, name: true },
    });

    const corruptedIds = new Set(corruptedHomeroom.map((s) => s.id));
    const deletableIds = labSectionIds.filter((id) => !corruptedIds.has(id));

    // Repair corrupted homeroom sections — reset tleProgramId without deleting.
    if (corruptedHomeroom.length > 0) {
      await prisma.section.updateMany({
        where: { id: { in: corruptedHomeroom.map((s) => s.id) } },
        data: { tleProgramId: null },
      });
      console.log(
        `  ✔ Repaired ${corruptedHomeroom.length} homeroom section(s) (reset tleProgramId):`,
      );
      for (const s of corruptedHomeroom) {
        console.log(`      - ${s.name}`);
      }
    }

    // Step 2: Delete SectionAdviser links for deletable sections only.
    const advisersDeleted = await prisma.sectionAdviser.deleteMany({
      where: { sectionId: { in: deletableIds } },
    });
    console.log(
      `  ✔ Deleted ${advisersDeleted.count} section adviser record(s).`,
    );

    // Step 3: Delete the pure TLE lab sections (no homeroom learners).
    if (deletableIds.length > 0) {
      const deletableSections = labSections.filter(
        (s) => !corruptedIds.has(s.id),
      );
      const sectionsDeleted = await prisma.section.deleteMany({
        where: { id: { in: deletableIds } },
      });
      console.log(`  ✔ Deleted ${sectionsDeleted.count} TLE lab section(s):`);
      for (const s of deletableSections) {
        console.log(`      - ${s.name}`);
      }
    }
  }

  // Step 4: Delete seeded TLE adviser teachers (both old "TLE ADVISER" placeholders and
  // newer real PH-named teachers seeded by this script). All seeded teachers share:
  //   - email ending with "@school.edu.ph" (the placeholder seed domain)
  //   - employeeId starting with "9" (TLE seed namespace)
  const placeholderTeachers = await prisma.teacher.findMany({
    where: {
      email: { endsWith: "@school.edu.ph" },
      employeeId: { startsWith: "9" },
    },
    select: { id: true, firstName: true, lastName: true, employeeId: true },
  });

  if (placeholderTeachers.length === 0) {
    console.log("\n  No placeholder TLE adviser teachers found to remove.");
  } else {
    const placeholderIds = placeholderTeachers.map((t) => t.id);

    // Remove any remaining adviser links (e.g. from other school years).
    await prisma.sectionAdviser.deleteMany({
      where: { teacherId: { in: placeholderIds } },
    });

    const teachersDeleted = await prisma.teacher.deleteMany({
      where: { id: { in: placeholderIds } },
    });
    console.log(
      `\n  ✔ Deleted ${teachersDeleted.count} placeholder TLE adviser teacher(s):`,
    );
    for (const t of placeholderTeachers) {
      console.log(`      - ${t.firstName} ${t.lastName} (${t.employeeId})`);
    }
  }

  console.log("\n✅ TLE Laboratory wipe complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
