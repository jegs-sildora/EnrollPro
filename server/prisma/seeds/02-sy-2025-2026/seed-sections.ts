import "dotenv/config";
import {
  PrismaClient,
  ApplicantType,
  SectionAdviserStatus,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// --- Hardcoded School Sections based on Official Class Programs ---
// Accurately maps the actual DepEd sections, including the requested SPS additions
const SCHOOL_SECTIONS = {
  7: {
    STE: ["DEL ROSARIO", "SANTIAGO"],
    SPA: ["CAYABYAB", "CELERIO"],
    SPS: ["PRESAS", "REYES"],
    BEC: [
      "AGONCILLO", "ESPAÑOLA", "DEL PILAR", "BURGOS", "LAKANDULA",
      "ELIZARDE", "LUMAWAG", "LUNA", "AQUINO", "TANDANG SORA",
      "RIZAL", "DAGOHOY", "JACINTO", "MABINI", "PALMA",
      "LOPEZ JAENA", "BONIFACIO", "QUEZON", "LAPU-LAPU", "SILANG"
    ]
  },
  8: {
    STE: ["WILLIAM PADOLINA", "DIOSCORO UMALI"],
    SPA: ["LUCRESIA KASILAG", "FRANCISCA AQUINO"],
    SPS: ["SPS A", "SPS B"], // Added per user request
    BEC: [
      "MATULUNGIN", "MASUNURIN", "MATAPAT", "MABAIT", "MADASALIN",
      "MATIYAGA", "MASINOP", "MAPAGMAHAL", "MASIPAG", "MAALALAHANIN",
      "MASAYAHIN", "MAPAGKUMBABA", "MAAGAP", "MAGALING", "MAPAGKAKATIWALAAN",
      "MAKAKALIKASAN", "MAHINHIN"
    ]
  },
  9: {
    STE: ["QUISUMBING", "FE DEL MUNDO"],
    SPA: ["NICANOR ABELARDO", "ANTONIO MOLINA"],
    SPS: ["SPS A", "SPS B"], // Added per user request
    BEC: [
      "SAMPAGUITA", "ROSE", "SUNFLOWER", "ADELFA", "MARGARITA",
      "ROSAL", "SANTAN", "DAISY", "DAHLIA", "ILANG-ILANG",
      "JASMINE", "GUMAMELA", "TULIP", "MARIGOLD", "DAFODIL", "ASTER"
    ]
  },
  10: {
    STE: ["AGAPITO FLORES", "FELIX MARAMBA"],
    SPA: ["JULIAN FELIPE"],
    SPS: [], // Grade 10 currently has no SPS listed
    BEC: [
      "DIAMOND", "PEARL", "GARNET", "EMERALD", "RUBY",
      "OPAL", "AMBER", "SAPPHIRE", "JADE", "TOPAZ",
      "ONYX", "AMETHYST", "CORAL", "AQUAMARINE", "ALEXANDRITE",
      "AGATE", "BERYL", "CITRINE"
    ]
  }
};

async function main() {
  console.log("📚 Seeding DepEd Sections for all school years (2022-2023 through 2025-2026)...");

  const schoolYears = await prisma.schoolYear.findMany({
    where: { yearLabel: { in: ["2022-2023", "2023-2024", "2024-2025", "2025-2026"] } },
    orderBy: { yearLabel: "asc" },
  });

  if (schoolYears.length === 0) {
    throw new Error("Timeline failure: No school years found. Run base seed first.");
  }

  const teachers = await prisma.teacher.findMany({
    select: { id: true, firstName: true, lastName: true },
    take: 100, 
  });

  if (teachers.length === 0) {
    console.warn("⚠️  No teachers found in DB. Sections will be created without advisors.");
  }

  const gradeLevels = await prisma.gradeLevel.findMany({
    where: { name: { in: ["Grade 7", "Grade 8", "Grade 9", "Grade 10"] } },
    orderBy: { displayOrder: "asc" },
  });

  let teacherRotationIndex = 0;

  for (const schoolYear of schoolYears) {
    console.log(`\n📅 Seeding sections for ${schoolYear.yearLabel}...`);

    for (const grade of gradeLevels) {
      const gradeNum = parseInt(grade.name.split(" ")[1]) as 7 | 8 | 9 | 10;
      const config = SCHOOL_SECTIONS[gradeNum];
      
      if (!config) continue;
      
      console.log(`  🏫 Processing ${grade.name}...`);
      let currentSortOrder = 1;

      // 1. Seed STE Sections (SCP)
      for (const name of config.STE) {
        const section = await upsertSection(name, grade.id, schoolYear.id, "SCIENCE_TECHNOLOGY_AND_ENGINEERING", currentSortOrder++, null, false);
        teacherRotationIndex = await attemptAssignAdviser(section.id, schoolYear, teachers, teacherRotationIndex);
      }

      // 2. Seed SPA Sections (SCP)
      for (const name of config.SPA) {
        const section = await upsertSection(name, grade.id, schoolYear.id, "SPECIAL_PROGRAM_IN_THE_ARTS", currentSortOrder++, null, false);
        teacherRotationIndex = await attemptAssignAdviser(section.id, schoolYear, teachers, teacherRotationIndex);
      }

      // 3. Seed SPS Sections (SCP)
      for (const name of config.SPS) {
        const section = await upsertSection(name, grade.id, schoolYear.id, "SPECIAL_PROGRAM_IN_SPORTS", currentSortOrder++, null, false);
        teacherRotationIndex = await attemptAssignAdviser(section.id, schoolYear, teachers, teacherRotationIndex);
      }

      // 4. Seed BEC / Regular Sections
      for (let i = 0; i < config.BEC.length; i++) {
        const name = config.BEC[i];
        const sectionRank = i + 1;
        const isHomogeneous = sectionRank <= 5; // Top 5 sections are homogeneous pilots

        const section = await upsertSection(name, grade.id, schoolYear.id, "REGULAR", currentSortOrder++, sectionRank, isHomogeneous);
        teacherRotationIndex = await attemptAssignAdviser(section.id, schoolYear, teachers, teacherRotationIndex);
      }

      console.log(`    ✓ Finished seeding ${currentSortOrder - 1} sections for ${grade.name}.`);
    }
    console.log(`✓ All sections seeded for ${schoolYear.yearLabel}.`);
  }
  console.log("\n✅ All sections seeded successfully for all school years.");
}

async function upsertSection(
  name: string,
  gradeId: number,
  syId: number,
  program: ApplicantType,
  sortOrder: number,
  sectionRank: number | null,
  isHomogeneous: boolean
) {
  // SCP sections strictly capped at 35. Regulars capped at 45.
  const capacity = (program === "REGULAR") ? 45 : 35;
  
  return await prisma.section.upsert({
    where: {
      uq_sections_name_grade_sy: { name, gradeLevelId: gradeId, schoolYearId: syId },
    },
    update: { programType: program, sortOrder, sectionRank, isHomogeneous, maxCapacity: capacity },
    create: { name, gradeLevelId: gradeId, schoolYearId: syId, programType: program, sortOrder, sectionRank, isHomogeneous, maxCapacity: capacity },
  });
}

async function attemptAssignAdviser(sectionId: number, schoolYear: any, teachers: any[], currentIndex: number): Promise<number> {
  if (teachers.length === 0) return currentIndex;
  
  const advisor = teachers[currentIndex % teachers.length];
  await assignSectionAdviser(sectionId, advisor.id, schoolYear.id, schoolYear.classOpeningDate || new Date());
  
  return currentIndex + 1;
}

async function assignSectionAdviser(sectionId: number, teacherId: number, schoolYearId: number, effectiveFrom: Date) {
  try {
    const existingForTeacher = await prisma.sectionAdviser.findFirst({ where: { teacherId, schoolYearId } });
    if (existingForTeacher) {
      if (existingForTeacher.sectionId === sectionId && existingForTeacher.status !== "ACTIVE") {
        await prisma.sectionAdviser.update({
          where: { id: existingForTeacher.id },
          data: { status: "ACTIVE" as SectionAdviserStatus, effectiveFrom, effectiveTo: null, handoverReason: null },
        });
      }
      return;
    }

    const existing = await prisma.sectionAdviser.findFirst({
      where: { sectionId, schoolYearId, status: "ACTIVE" as SectionAdviserStatus },
    });

    if (existing && existing.teacherId === teacherId) return;

    if (existing && existing.teacherId !== teacherId) {
      await prisma.sectionAdviser.update({
        where: { id: existing.id },
        data: { status: "HANDED_OVER" as SectionAdviserStatus, effectiveTo: new Date(), handoverReason: "Seed Update" },
      });
    }

    await prisma.sectionAdviser.create({
      data: { sectionId, teacherId, schoolYearId, effectiveFrom, status: "ACTIVE" as SectionAdviserStatus },
    });
  } catch (error) {
    console.warn(`⚠️  Failed to assign adviser to section ${sectionId}: ${(error as Error).message}`);
  }
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