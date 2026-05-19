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

/** Real Filipino-named sample teachers per TLE category, used as fallback when no DB teacher is available. */
const PH_TEACHER_SAMPLES: Record<
  string,
  Array<{
    firstName: string;
    lastName: string;
    sex: Sex;
    specialization: string;
  }>
> = {
  HOME_ECONOMICS: [
    {
      firstName: "Maria",
      lastName: "Santos",
      sex: Sex.FEMALE,
      specialization: "Home Economics",
    },
    {
      firstName: "Rosario",
      lastName: "Dela Cruz",
      sex: Sex.FEMALE,
      specialization: "Home Economics",
    },
    {
      firstName: "Lourdes",
      lastName: "Reyes",
      sex: Sex.FEMALE,
      specialization: "Home Economics",
    },
    {
      firstName: "Esperanza",
      lastName: "Garcia",
      sex: Sex.FEMALE,
      specialization: "Home Economics",
    },
    {
      firstName: "Teresita",
      lastName: "Villanueva",
      sex: Sex.FEMALE,
      specialization: "Home Economics",
    },
    {
      firstName: "Carmela",
      lastName: "Aquino",
      sex: Sex.FEMALE,
      specialization: "Home Economics",
    },
    {
      firstName: "Josefina",
      lastName: "De Leon",
      sex: Sex.FEMALE,
      specialization: "Home Economics",
    },
    {
      firstName: "Remedios",
      lastName: "Castillo",
      sex: Sex.FEMALE,
      specialization: "Home Economics",
    },
    {
      firstName: "Elena",
      lastName: "Panganiban",
      sex: Sex.FEMALE,
      specialization: "Home Economics",
    },
    {
      firstName: "Gloria",
      lastName: "Soriano",
      sex: Sex.FEMALE,
      specialization: "Home Economics",
    },
  ],
  INDUSTRIAL_ARTS: [
    {
      firstName: "Eduardo",
      lastName: "Ramos",
      sex: Sex.MALE,
      specialization: "Industrial Arts",
    },
    {
      firstName: "Renato",
      lastName: "Torres",
      sex: Sex.MALE,
      specialization: "Industrial Arts",
    },
    {
      firstName: "Rodrigo",
      lastName: "Fernandez",
      sex: Sex.MALE,
      specialization: "Industrial Arts",
    },
    {
      firstName: "Ernesto",
      lastName: "Castro",
      sex: Sex.MALE,
      specialization: "Industrial Arts",
    },
    {
      firstName: "Ramon",
      lastName: "Aquino",
      sex: Sex.MALE,
      specialization: "Industrial Arts",
    },
    {
      firstName: "Manuel",
      lastName: "Rodriguez",
      sex: Sex.MALE,
      specialization: "Industrial Arts",
    },
    {
      firstName: "Roberto",
      lastName: "Ibarra",
      sex: Sex.MALE,
      specialization: "Industrial Arts",
    },
    {
      firstName: "Francisco",
      lastName: "Luna",
      sex: Sex.MALE,
      specialization: "Industrial Arts",
    },
    {
      firstName: "Ricardo",
      lastName: "Silang",
      sex: Sex.MALE,
      specialization: "Industrial Arts",
    },
    {
      firstName: "Ferdinand",
      lastName: "Santos",
      sex: Sex.MALE,
      specialization: "Industrial Arts",
    },
  ],
  AGRI_FISHERY_ARTS: [
    {
      firstName: "Danilo",
      lastName: "Mendoza",
      sex: Sex.MALE,
      specialization: "Agricultural and Fishery Arts",
    },
    {
      firstName: "Marites",
      lastName: "Bautista",
      sex: Sex.FEMALE,
      specialization: "Agricultural and Fishery Arts",
    },
    {
      firstName: "Roberto",
      lastName: "Ocampo",
      sex: Sex.MALE,
      specialization: "Agricultural and Fishery Arts",
    },
    {
      firstName: "Cynthia",
      lastName: "Navarro",
      sex: Sex.FEMALE,
      specialization: "Agricultural and Fishery Arts",
    },
    {
      firstName: "Raul",
      lastName: "Pascual",
      sex: Sex.MALE,
      specialization: "Agricultural and Fishery Arts",
    },
    {
      firstName: "Antonio",
      lastName: "Cruz",
      sex: Sex.MALE,
      specialization: "Agricultural and Fishery Arts",
    },
    {
      firstName: "Perla",
      lastName: "Valdez",
      sex: Sex.FEMALE,
      specialization: "Agricultural and Fishery Arts",
    },
    {
      firstName: "Gabriel",
      lastName: "Villanueva",
      sex: Sex.MALE,
      specialization: "Agricultural and Fishery Arts",
    },
    {
      firstName: "Aurora",
      lastName: "Del Rosario",
      sex: Sex.FEMALE,
      specialization: "Agricultural and Fishery Arts",
    },
    {
      firstName: "Emilio",
      lastName: "Gonzales",
      sex: Sex.MALE,
      specialization: "Agricultural and Fishery Arts",
    },
  ],
  ICT: [
    {
      firstName: "Kenneth",
      lastName: "Lim",
      sex: Sex.MALE,
      specialization: "Information and Communications Technology",
    },
    {
      firstName: "Christine",
      lastName: "Tan",
      sex: Sex.FEMALE,
      specialization: "Information and Communications Technology",
    },
    {
      firstName: "Mark",
      lastName: "Uy",
      sex: Sex.MALE,
      specialization: "Information and Communications Technology",
    },
    {
      firstName: "Angelica",
      lastName: "Go",
      sex: Sex.FEMALE,
      specialization: "Information and Communications Technology",
    },
    {
      firstName: "Jerome",
      lastName: "Chua",
      sex: Sex.MALE,
      specialization: "Information and Communications Technology",
    },
    {
      firstName: "Rafael",
      lastName: "Reyes",
      sex: Sex.MALE,
      specialization: "Information and Communications Technology",
    },
    {
      firstName: "Nicole",
      lastName: "Santos",
      sex: Sex.FEMALE,
      specialization: "Information and Communications Technology",
    },
    {
      firstName: "Diego",
      lastName: "Navarro",
      sex: Sex.MALE,
      specialization: "Information and Communications Technology",
    },
    {
      firstName: "Gabriela",
      lastName: "Cruz",
      sex: Sex.FEMALE,
      specialization: "Information and Communications Technology",
    },
    {
      firstName: "Carlo",
      lastName: "Gonzales",
      sex: Sex.MALE,
      specialization: "Information and Communications Technology",
    },
  ],
  GENERAL: [
    {
      firstName: "Corazon",
      lastName: "Flores",
      sex: Sex.FEMALE,
      specialization: "Technology and Livelihood Education",
    },
    {
      firstName: "Antonio",
      lastName: "Morales",
      sex: Sex.MALE,
      specialization: "Technology and Livelihood Education",
    },
    {
      firstName: "Maricel",
      lastName: "Cruz",
      sex: Sex.FEMALE,
      specialization: "Technology and Livelihood Education",
    },
    {
      firstName: "Juan",
      lastName: "Valdez",
      sex: Sex.MALE,
      specialization: "Technology and Livelihood Education",
    },
    {
      firstName: "Sofia",
      lastName: "Rodriguez",
      sex: Sex.FEMALE,
      specialization: "Technology and Livelihood Education",
    },
    {
      firstName: "Miguel",
      lastName: "Luna",
      sex: Sex.MALE,
      specialization: "Technology and Livelihood Education",
    },
    {
      firstName: "Carmela",
      lastName: "Ibarra",
      sex: Sex.FEMALE,
      specialization: "Technology and Livelihood Education",
    },
    {
      firstName: "Jose",
      lastName: "Silang",
      sex: Sex.MALE,
      specialization: "Technology and Livelihood Education",
    },
    {
      firstName: "Jasmine",
      lastName: "Pascual",
      sex: Sex.FEMALE,
      specialization: "Technology and Livelihood Education",
    },
    {
      firstName: "Gabriel",
      lastName: "Aquino",
      sex: Sex.MALE,
      specialization: "Technology and Livelihood Education",
    },
  ],
};

/** Category keywords for broader teacher specialization matching (priority 3). */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  HOME_ECONOMICS: [
    "home economics",
    "cookery",
    "baking",
    "caregiving",
    "dressmaking",
    "beauty care",
  ],
  INDUSTRIAL_ARTS: [
    "industrial arts",
    "carpentry",
    "electrical",
    "electronics",
    "welding",
    "plumbing",
  ],
  AGRI_FISHERY_ARTS: [
    "agri",
    "fishery",
    "crop",
    "swine",
    "poultry",
    "aquaculture",
  ],
  ICT: ["ict", "information technology", "computer", "programming"],
  GENERAL: ["technology and livelihood", "tle"],
};

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

  // ── Repair: reset tleProgramId on homeroom sections incorrectly set by previous runs ──
  const corrupted = await prisma.section.findMany({
    where: {
      schoolYearId: activeSy.id,
      tleProgramId: { not: null },
      enrollmentRecords: { some: {} },
    },
    select: { id: true, name: true },
  });
  if (corrupted.length > 0) {
    console.log(
      `⚠️  Repairing ${corrupted.length} homeroom section(s) incorrectly marked as TLE labs:`,
    );
    for (const s of corrupted) {
      await prisma.section.update({
        where: { id: s.id },
        data: { tleProgramId: null },
      });
      console.log(`  ✔ Reset "${s.name}"`);
    }
    console.log("");
  }

  // --- Process each program ---
  for (const program of programs) {
    console.log(`📌 ${program.name}`);

    // Per grade level (G9, G10) — create sections, assign learners, and assign advisers.
    for (const grade of gradeLevels) {
      await seedGradeLabSections({
        program,
        grade,
        activeSyId: activeSy.id,
        classOpeningDate: activeSy.classOpeningDate,
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
  program: { id: number; name: string; category: string };
  grade: { id: number; name: string };
  activeSyId: number;
  classOpeningDate: Date | null;
}) {
  const { program, grade, activeSyId, classOpeningDate } = opts;

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

  // ── Find existing TLE lab sections for this program/grade/sy ────────────────
  // SAFE: filtered by tleProgramId — never matches homeroom sections (tleProgramId = null).
  const existingSections = await prisma.section.findMany({
    where: {
      tleProgramId: program.id,
      gradeLevelId: grade.id,
      schoolYearId: activeSyId,
    },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

  // Use up to sectionCount of existing sections; create the rest.
  const sections: { id: number; name: string }[] = existingSections.slice(
    0,
    sectionCount,
  );

  // Update maxCapacity on all kept existing sections.
  for (const s of sections) {
    await prisma.section.update({
      where: { id: s.id },
      data: { maxCapacity: LAB_CAPACITY },
    });
    console.log(`    ✔ ${s.name} (existing)`);
  }

  // Create additional sections if more are needed.
  for (let i = sections.length; i < sectionCount; i++) {
    const suffix = sectionCount > 1 ? ` - ${String.fromCharCode(65 + i)}` : "";
    let sectionName = `${program.name}${suffix}`;

    // Guard: if a homeroom section already owns this name, use a distinct name.
    const nameCollision = await prisma.section.findFirst({
      where: {
        name: sectionName,
        gradeLevelId: grade.id,
        schoolYearId: activeSyId,
        tleProgramId: null,
      },
      select: { id: true },
    });
    if (nameCollision) {
      sectionName = `${sectionName} Lab`;
    }

    const section = await prisma.section.create({
      data: {
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

  // ── Assign unassigned learners into sections (capacity-aware) ────────────────
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
    // Measure current occupancy per section so existing learners aren't displaced
    // and newly created sections aren't skipped when others are already at capacity.
    const occupancies = await Promise.all(
      sections.map((s) =>
        prisma.enrollmentRecord.count({
          where: { tleSectionId: s.id, schoolYearId: activeSyId },
        }),
      ),
    );

    let assigned = 0;
    for (const record of unassigned) {
      // Pick the section with the lowest current occupancy (balanced distribution).
      // If all are at capacity, fall back to the least-full one.
      let targetIdx = 0;
      for (let i = 1; i < sections.length; i++) {
        if (occupancies[i] < occupancies[targetIdx]) targetIdx = i;
      }
      await prisma.enrollmentRecord.update({
        where: { id: record.id },
        data: { tleSectionId: sections[targetIdx].id },
      });
      occupancies[targetIdx]++;
      assigned++;
    }
    console.log(`    Assigned ${assigned} learner(s) to TLE lab sections (balanced)`);
  }

  // Assign one unique adviser per section.
  const effectiveFrom = classOpeningDate ?? new Date();
  for (const section of sections) {
    await resolveAndAssignSectionAdviser({
      section,
      program,
      activeSyId,
      effectiveFrom,
    });
  }
}

// ---------------------------------------------------------------------------
// resolveAndAssignSectionAdviser + findOrCreateTeacher
// ---------------------------------------------------------------------------

/**
 * Assigns a unique adviser to a single TLE lab section for this school year.
 * Skips if the section already has an adviser. Finds or creates a teacher
 * (not yet advising any section this SY) via findOrCreateTeacher.
 */
async function resolveAndAssignSectionAdviser(opts: {
  section: { id: number; name: string };
  program: { id: number; name: string; category: string };
  activeSyId: number;
  effectiveFrom: Date;
}): Promise<void> {
  const { section, program, activeSyId, effectiveFrom } = opts;

  // Skip if this section already has an adviser for this SY.
  const existing = await prisma.sectionAdviser.findFirst({
    where: { sectionId: section.id, schoolYearId: activeSyId },
    select: { teacher: { select: { firstName: true, lastName: true } } },
  });
  if (existing) {
    console.log(
      `    👤 ${section.name}: ${existing.teacher.firstName} ${existing.teacher.lastName} (already assigned)`,
    );
    return;
  }

  const teacher = await findOrCreateTeacher(program, activeSyId);
  if (!teacher) {
    console.warn(
      `    ⚠️  ${section.name}: no adviser available (all samples exhausted)`,
    );
    return;
  }

  await prisma.sectionAdviser.create({
    data: {
      sectionId: section.id,
      teacherId: teacher.id,
      schoolYearId: activeSyId,
      effectiveFrom,
      status: SectionAdviserStatus.ACTIVE,
    },
  });
  console.log(
    `    👤 ${section.name}: ${teacher.firstName} ${teacher.lastName}`,
  );
}

/**
 * Finds the best available teacher for a TLE program (not yet advising this SY),
 * or seeds a real PH-named fallback teacher.
 *
 * Priority:
 *  1. Active DB teacher whose specialization contains the program name.
 *  2. Active DB teacher whose specialization contains a category keyword.
 *  3. Seed a real PH-named teacher for the category (deterministic employeeId).
 */
async function findOrCreateTeacher(
  program: { id: number; name: string; category: string },
  activeSyId: number,
): Promise<{ id: number; firstName: string; lastName: string } | null> {
  // 1. Active teacher whose specialization contains the program name — not yet an adviser this SY.
  const matchBySpec = await prisma.teacher.findFirst({
    where: {
      specialization: { contains: program.name, mode: "insensitive" },
      isActive: true,
      advisoryHistory: { none: { schoolYearId: activeSyId } },
    },
    select: { id: true, firstName: true, lastName: true },
  });
  if (matchBySpec) return matchBySpec;

  // 2. Broader category match — any active teacher whose specialization contains a category keyword.
  const keywords = CATEGORY_KEYWORDS[program.category] ?? [];
  for (const keyword of keywords) {
    const matchByCategory = await prisma.teacher.findFirst({
      where: {
        specialization: { contains: keyword, mode: "insensitive" },
        isActive: true,
        advisoryHistory: { none: { schoolYearId: activeSyId } },
      },
      select: { id: true, firstName: true, lastName: true },
    });
    if (matchByCategory) return matchByCategory;
  }

  // 3. No matching existing teacher — seed a real PH-named teacher.
  return seedPhTeacher(program, activeSyId);
}

/** Seeds a real PH-named teacher for the given TLE program category, cycling through samples. */
async function seedPhTeacher(
  program: { id: number; name: string; category: string },
  activeSyId: number,
): Promise<{ id: number; firstName: string; lastName: string } | null> {
  const samples =
    PH_TEACHER_SAMPLES[program.category] ?? PH_TEACHER_SAMPLES["GENERAL"];

  for (let idx = 0; idx < samples.length; idx++) {
    const slot = samples[idx];
    const employeeId = `9${String(program.id).padStart(3, "0")}${String(idx).padStart(3, "0")}`;
    const firstNameLower = slot.firstName.toLowerCase().replace(/\s+/g, "");
    const lastNameLower = slot.lastName.toLowerCase().replace(/[^a-z]/g, "");
    const email = `${firstNameLower}.${lastNameLower}.p${program.id}@school.edu.ph`;

    // Check employeeId slot.
    const empSlot = await prisma.teacher.findUnique({
      where: { employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        advisoryHistory: {
          where: { schoolYearId: activeSyId },
          select: { id: true },
        },
      },
    });
    if (empSlot) {
      if (empSlot.advisoryHistory.length === 0) {
        console.log(
          `  👤 Adviser: ${empSlot.firstName} ${empSlot.lastName} (seeded teacher reused)`,
        );
        return empSlot;
      }
      // Already advising this SY — try next sample.
      continue;
    }

    // Check email slot.
    const emailSlot = await prisma.teacher.findUnique({
      where: { email },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        advisoryHistory: {
          where: { schoolYearId: activeSyId },
          select: { id: true },
        },
      },
    });
    if (emailSlot) {
      if (emailSlot.advisoryHistory.length === 0) {
        console.log(
          `  👤 Adviser: ${emailSlot.firstName} ${emailSlot.lastName} (seeded teacher reused)`,
        );
        return emailSlot;
      }
      continue;
    }

    // Create the teacher.
    const teacher = await prisma.teacher.create({
      data: {
        employeeId,
        firstName: slot.firstName,
        lastName: slot.lastName,
        email,
        specialization: slot.specialization,
        isActive: true,
        sex: slot.sex,
      },
      select: { id: true, firstName: true, lastName: true },
    });
    console.log(
      `  👤 Adviser: ${teacher.firstName} ${teacher.lastName} created (${employeeId})`,
    );
    return teacher;
  }

  console.warn(
    `  ⚠️  Could not resolve or create an adviser for "${program.name}" (all samples exhausted)`,
  );
  return null;
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
