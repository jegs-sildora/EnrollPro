/**
 * seed-tle-laboratories.ts
 *
 * Seeds TLE Laboratory sections for every active SPECIALIZATION TLE program.
 * Runs for the current ACTIVE school year only.
 *
 * Behaviour:
 *  1. Resolves active SPECIALIZATION programs, active school year, and grade levels.
 *  2. For each program × grade level (G9, G10):
 *     - Counts all enrolled learners with that tleProgramId in that homeroom grade.
 *     - Upserts the required lab sections (A / B / C ... overflow naming).
 *     - Assigns unassigned learners (tleSectionId = null) to sections round-robin at
 *       LAB_CAPACITY slots per section.
 *  3. Finds an existing teacher with a matching specialization, or creates a
 *     placeholder Teacher record for the program.
 *  4. Assigns the teacher as adviser (SectionAdviser) to every newly created section,
 *     skipping duplicates.
 *
 * Safe to re-run: upserts only. Never wipes existing sections or re-assigns
 * learners that already have a tleSectionId.
 *
 * Usage:
 *   pnpm --filter server db:seed-tle-laboratories
 */

import "dotenv/config";
import {
  PrismaClient,
  ApplicantType,
  SectionAdviserStatus,
  Sex,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/** Maximum learners per TLE laboratory section. */
const LAB_CAPACITY = 40;

/** Maps Prisma TLECategory values to short abbreviations for teacher records. */
const CATEGORY_ABBREV: Record<string, string> = {
  HOME_ECONOMICS: "HE",
  INDUSTRIAL_ARTS: "IA",
  AGRI_FISHERY_ARTS: "AFA",
  ICT: "ICT",
  GENERAL: "GEN",
};

function categoryAbbrev(category: string): string {
  return CATEGORY_ABBREV[category] ?? "TLE";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🔬 Seeding TLE Laboratory sections...\n");

  // --- Resolve required lookups ---
  const activeSy = await prisma.schoolYear.findFirst({
    where: { status: "ACTIVE" },
  });
  if (!activeSy) {
    throw new Error(
      "No ACTIVE school year found. Set a school year to ACTIVE before running this seed.",
    );
  }

  const gradeLevels = await prisma.gradeLevel.findMany({
    where: { name: { in: ["Grade 9", "Grade 10"] } },
    orderBy: { displayOrder: "asc" },
  });
  if (gradeLevels.length < 2) {
    throw new Error(
      "Grade 9 and Grade 10 must exist in grade_levels. Run base seed first.",
    );
  }

  const programs = await prisma.tLEProgram.findMany({
    where: { isActive: true, trackType: "SPECIALIZATION" },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  if (programs.length === 0) {
    console.warn(
      "⚠️  No active SPECIALIZATION TLE programs found. Nothing to seed.\n" +
        "    Run db:seed-core or db:seed-scp to populate TLE programs first.",
    );
    return;
  }

  console.log(
    `  School year : ${activeSy.yearLabel}\n` +
      `  Programs    : ${programs.length} active SPECIALIZATION program(s)\n`,
  );

  // --- Process each program ---
  for (const program of programs) {
    console.log(`📌 ${program.name}`);

    // Step 1: Resolve (or create) a placeholder adviser for this program.
    const teacher = await upsertAdviserTeacher(program);

    // Step 2: Per grade level (G9, G10) — create sections and assign learners.
    for (const grade of gradeLevels) {
      await seedGradeLabSections({
        program,
        grade,
        activeSyId: activeSy.id,
        classOpeningDate: activeSy.classOpeningDate,
        teacher,
      });
    }

    console.log("");
  }

  console.log("✅ TLE Laboratory sections seeded.");
}

// ---------------------------------------------------------------------------
// seedGradeLabSections
// ---------------------------------------------------------------------------

async function seedGradeLabSections(opts: {
  program: { id: number; name: string };
  grade: { id: number; name: string };
  activeSyId: number;
  classOpeningDate: Date | null;
  teacher: { id: number } | null;
}) {
  const { program, grade, activeSyId, classOpeningDate, teacher } = opts;

  // Count ALL enrolled learners in this grade with this TLE program (homeroom grade filter).
  const totalCount = await prisma.enrollmentRecord.count({
    where: {
      schoolYearId: activeSyId,
      tleProgramId: program.id,
      section: { gradeLevelId: grade.id },
    },
  });

  // Always create at least one section even if no learners are yet enrolled.
  const sectionCount = Math.max(1, Math.ceil(totalCount / LAB_CAPACITY));

  console.log(
    `  ${grade.name} : ${totalCount} learner(s) → ${sectionCount} lab section(s)`,
  );

  // Upsert lab sections (A / B / C ... for overflow).
  const sections: { id: number; name: string }[] = [];
  for (let i = 0; i < sectionCount; i++) {
    const suffix =
      sectionCount > 1 ? ` - ${String.fromCharCode(65 + i)}` : "";
    const sectionName = `${program.name}${suffix}`;

    const section = await prisma.section.upsert({
      where: {
        uq_sections_name_grade_sy: {
          name: sectionName,
          gradeLevelId: grade.id,
          schoolYearId: activeSyId,
        },
      },
      update: {
        tleProgramId: program.id,
        maxCapacity: LAB_CAPACITY,
      },
      create: {
        name: sectionName,
        gradeLevelId: grade.id,
        schoolYearId: activeSyId,
        tleProgramId: program.id,
        maxCapacity: LAB_CAPACITY,
        programType: ApplicantType.REGULAR,
      },
      select: { id: true, name: true },
    });

    sections.push(section);
    console.log(`    ✔ ${sectionName}`);
  }

  // Assign unassigned learners to sections sequentially up to LAB_CAPACITY per slot.
  const unassigned = await prisma.enrollmentRecord.findMany({
    where: {
      schoolYearId: activeSyId,
      tleProgramId: program.id,
      section: { gradeLevelId: grade.id },
      tleSectionId: null,
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  if (unassigned.length > 0) {
    let assigned = 0;
    for (let j = 0; j < unassigned.length; j++) {
      const sectionIdx = Math.min(
        Math.floor(j / LAB_CAPACITY),
        sections.length - 1,
      );
      await prisma.enrollmentRecord.update({
        where: { id: unassigned[j].id },
        data: { tleSectionId: sections[sectionIdx].id },
      });
      assigned++;
    }
    console.log(`    📋 Assigned ${assigned} learner(s) to TLE lab sections`);
  }

  // Assign adviser teacher to each section (skip if already linked).
  if (teacher) {
    const effectiveFrom = classOpeningDate ?? new Date();
    for (const section of sections) {
      const existing = await prisma.sectionAdviser.findFirst({
        where: {
          sectionId: section.id,
          teacherId: teacher.id,
          schoolYearId: activeSyId,
        },
      });
      if (!existing) {
        await prisma.sectionAdviser.create({
          data: {
            sectionId: section.id,
            teacherId: teacher.id,
            schoolYearId: activeSyId,
            effectiveFrom,
            status: SectionAdviserStatus.ACTIVE,
          },
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// upsertAdviserTeacher
// ---------------------------------------------------------------------------

async function upsertAdviserTeacher(program: {
  id: number;
  name: string;
  category: string;
}): Promise<{ id: number } | null> {
  // Prefer an existing teacher whose specialization already contains this program name.
  const existing = await prisma.teacher.findFirst({
    where: {
      specialization: { contains: program.name, mode: "insensitive" },
      isActive: true,
    },
    select: { id: true, firstName: true, lastName: true },
  });

  if (existing) {
    console.log(
      `  👤 Adviser: ${existing.firstName} ${existing.lastName} (existing)`,
    );
    return existing;
  }

  // Build unique identifiers for a placeholder teacher.
  // employeeId: "TL" + zero-padded program.id — must fit VarChar(7).
  const employeeId = `TL${String(program.id).padStart(5, "0")}`;
  const abbrev = categoryAbbrev(program.category).toLowerCase();
  const email = `tle.${abbrev}.p${program.id}@school.edu.ph`;

  // Guard against employeeId collision (idempotency on re-runs).
  const empConflict = await prisma.teacher.findUnique({
    where: { employeeId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (empConflict) {
    console.log(
      `  👤 Adviser: ${empConflict.firstName} ${empConflict.lastName} (employeeId reuse)`,
    );
    return empConflict;
  }

  // Guard against email collision.
  const emailConflict = await prisma.teacher.findUnique({
    where: { email },
    select: { id: true, firstName: true, lastName: true },
  });
  if (emailConflict) {
    console.log(
      `  👤 Adviser: ${emailConflict.firstName} ${emailConflict.lastName} (email reuse)`,
    );
    return emailConflict;
  }

  const teacher = await prisma.teacher.create({
    data: {
      employeeId,
      firstName: categoryAbbrev(program.category),
      lastName: "TLE ADVISER",
      email,
      specialization: program.name,
      isActive: true,
      sex: Sex.FEMALE,
    },
    select: { id: true, firstName: true, lastName: true },
  });

  console.log(
    `  👤 Adviser: ${teacher.firstName} ${teacher.lastName} created (${employeeId})`,
  );
  return teacher;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
