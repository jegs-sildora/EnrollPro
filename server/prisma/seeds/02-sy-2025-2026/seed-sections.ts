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

// --- Section theme pools (one theme pool per grade level) ---
const STARS = [
  "SIRIUS",
  "VEGA",
  "RIGEL",
  "ARCTURUS",
  "CAPELLA",
  "CANOPUS",
  "ALTAIR",
  "PROCYON",
];
const HEROES = [
  "JOSE RIZAL",
  "ANDRES BONIFACIO",
  "APOLINARIO MABINI",
  "MARCELO DEL PILAR",
  "JUAN LUNA",
  "EMILIO JACINTO",
  "GABRIELA SILANG",
  "EMILIO AGUINALDO",
  "GRACIANO LOPEZ JAENA",
  "GREGORIO DEL PILAR",
  "MELCHORA AQUINO",
  "DIEGO SILANG",
  "FRANCISCO BALAGTAS",
  "MARCIANA AGONCILLO",
  "TERESA MAGBANUA",
  "TRINIDAD TECSON",
];
const CORE_VALUES = [
  "MAKA-DIYOS",
  "MAKATAO",
  "MAKAKALIKASAN",
  "MAKABANSA",
  "KARANGALAN",
  "KATAPATAN",
  "KATAPANGAN",
  "KAGALINGAN",
  "KAAYUSAN",
  "KALAYAAN",
  "KATARUNGAN",
  "KASIPAGAN",
  "PAGKAKAISA",
  "PAGMAMAHAL",
  "PAGMALASAKIT",
  "PAGTITIPID",
  "PAGKAMALIKHAIN",
];
const FLOWERS = [
  "SAMPAGUITA",
  "GUMAMELA",
  "ROSAS",
  "ORCHID",
  "SUNFLOWER",
  "DAISY",
  "LILY",
  "TULIP",
  "JASMINE",
  "HIBISCUS",
  "ANTHURIUM",
  "CATTLEYA",
];
const MINERALS = [
  "GOLD",
  "SILVER",
  "COPPER",
  "IRON",
  "NICKEL",
  "CHROMITE",
  "QUARTZ",
  "FELDSPAR",
  "MICA",
  "TALC",
  "GYPSUM",
  "CALCITE",
  "APATITE",
];

// Fallback TLE track names used only when the database has no active TLE programs yet.
// The live seed now prefers whatever `tLEProgram.isActive = true` returns.
const FALLBACK_TLE_TRACK_NAMES = [
  "FCS - Cookery",
  "FCS - Bread and Pastry Production",
  "FCS - Household Services",
  "FCS - Beauty Care",
  "IA - SMAW",
  "IA - Electrical Installation and Maintenance",
  "ICT - Computer Systems Servicing",
  "ICT - Technical Drafting",
  "AFA - Agricultural Crops Production",
];

async function main() {
  console.log(
    "📚 Seeding DepEd Sections for all school years (2022-2023 through 2025-2026)...",
  );

  // Query all school years in chronological order
  const schoolYears = await prisma.schoolYear.findMany({
    where: {
      yearLabel: {
        in: ["2022-2023", "2023-2024", "2024-2025", "2025-2026"],
      },
    },
    orderBy: { yearLabel: "asc" },
  });

  if (schoolYears.length === 0) {
    throw new Error(
      "Timeline failure: No school years (2022-2023 through 2025-2026) found. Run base seed first.",
    );
  }

  // Fetch available teachers for advisory assignments
  const teachers = await prisma.teacher.findMany({
    select: { id: true, firstName: true, lastName: true },
    take: 50, // Limit to first 50 teachers for rotation
  });

  if (teachers.length === 0) {
    console.warn(
      "⚠️  No teachers found in DB. Sections will be created without advisors. " +
        "Run a teacher seed before re-running this to assign advisors.",
    );
  }

  // Pre-load active TLE programs so G9/G10 sections follow the live catalog.
  let tlePrograms = await prisma.tLEProgram.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  if (tlePrograms.length === 0) {
    tlePrograms = await prisma.tLEProgram.findMany({
      where: { name: { in: FALLBACK_TLE_TRACK_NAMES } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    });
  }

  if (tlePrograms.length === 0) {
    console.warn(
      "⚠️  No matching TLE programs found in DB. " +
        "G9/G10 BEC sections will be seeded without a TLE assignment. " +
        "Run db:seed-scp before re-running this seed to populate TLE programme IDs.",
    );
  }

  const tleMap: Record<string, number> = {};
  for (const p of tlePrograms) {
    tleMap[p.name] = p.id;
  }

  const tleSectionSlotCount = FLOWERS.length + MINERALS.length;
  if (tlePrograms.length > tleSectionSlotCount) {
    console.warn(
      `⚠️  Found ${tlePrograms.length} active TLE programs but only ${tleSectionSlotCount} Grade 9/10 section slots. Extra programs will stay unassigned in this seed run.`,
    );
  }

  const gradeLevels = await prisma.gradeLevel.findMany({
    where: { name: { in: ["Grade 7", "Grade 8", "Grade 9", "Grade 10"] } },
    orderBy: { displayOrder: "asc" },
  });

  let teacherRotationIndex = 0;

  // Seed sections for each school year
  for (const schoolYear of schoolYears) {
    console.log(`\n📅 Seeding sections for ${schoolYear.yearLabel}...`);
    let tleProgramCursor = 0;

    for (const grade of gradeLevels) {
      const gradeNum = parseInt(grade.name.split(" ")[1]);
      console.log(`  🏫 Processing ${grade.name}...`);

      let currentSortOrder = 1;

      // ── SCP / STE Sections ─────────────────────────────────────────
      // • programType : SCIENCE_TECHNOLOGY_AND_ENGINEERING
      // • name        : star theme only (e.g. "SIRIUS")
      // • sectionRank : null  (STE sections are not ordinally ranked)
      // • tleProgramId: null  (STE has no TLE specialisation)
      const gradeStars = STARS.slice((gradeNum - 7) * 2, (gradeNum - 7) * 2 + 2);
      for (const star of gradeStars) {
        const section = await upsertSection(
          star,
          grade.id,
          schoolYear.id,
          "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
          currentSortOrder++,
          null, // sectionRank — not applicable for STE
          null, // tleProgramId
        );

        // Assign advisory teacher
        if (teachers.length > 0) {
          const advisor = teachers[teacherRotationIndex % teachers.length];
          await assignSectionAdviser(
            section.id,
            advisor.id,
            schoolYear.id,
            schoolYear.classOpeningDate || new Date(),
          );
          teacherRotationIndex++;
        }
      }

      // ── SCP Special Program Sections ───────────────────────────────
      // SPA/SPS belong to the SCP lane and should be seeded for Grades 7-10.
      // They are not regular sections and should keep the 35-capacity rule.
      if (gradeNum >= 7 && gradeNum <= 10) {
        const specialSections: Array<{
          name: string;
          programType:
            | "SPECIAL_PROGRAM_IN_THE_ARTS"
            | "SPECIAL_PROGRAM_IN_SPORTS";
        }> = [
          { name: "SPA A", programType: "SPECIAL_PROGRAM_IN_THE_ARTS" },
          { name: "SPA B", programType: "SPECIAL_PROGRAM_IN_THE_ARTS" },
          { name: "SPS A", programType: "SPECIAL_PROGRAM_IN_SPORTS" },
          { name: "SPS B", programType: "SPECIAL_PROGRAM_IN_SPORTS" },
        ];

        for (const specialSection of specialSections) {
          const special = await prisma.section.upsert({
            where: {
              uq_sections_name_grade_sy: {
                name: specialSection.name,
                gradeLevelId: grade.id,
                schoolYearId: schoolYear.id,
              },
            },
            update: {
              programType: specialSection.programType,
              sortOrder: currentSortOrder++,
              sectionRank: null,
              tleProgramId: null,
              maxCapacity: 35,
            },
            create: {
              name: specialSection.name,
              gradeLevelId: grade.id,
              schoolYearId: schoolYear.id,
              programType: specialSection.programType,
              sortOrder: currentSortOrder++,
              sectionRank: null,
              tleProgramId: null,
              maxCapacity: 35,
            },
          });

          if (teachers.length > 0) {
            const advisor = teachers[teacherRotationIndex % teachers.length];
            await assignSectionAdviser(
              special.id,
              advisor.id,
              schoolYear.id,
              schoolYear.classOpeningDate || new Date(),
            );
            teacherRotationIndex++;
          }
        }
      }

      // ── BEC / Regular Sections ──────────────────────────────────────
      // • programType : REGULAR
      // • name        : theme only (e.g. "JOSE RIZAL") — grade/rank stored in columns
      // • sectionRank : 1-based ordinal within the grade level (e.g. 1, 2, 3 …)
      // • tleProgramId: FK to TLEProgram for G9/G10 (cycled through TLE_TRACK_NAMES)
      let themes: string[] = [];
      if (gradeNum === 7) themes = HEROES;
      else if (gradeNum === 8) themes = CORE_VALUES;
      else if (gradeNum === 9) themes = FLOWERS;
      else if (gradeNum === 10) themes = MINERALS;

      for (let i = 0; i < themes.length; i++) {
        const theme = themes[i];
        const sectionRank = i + 1;

        // Do NOT attach TLE program IDs to existing BEC themed sections.
        // TLE programs must have dedicated sections created separately
        // (see the explicit ensure-pass after grade loops).
        let tleProgramId: number | null = null;

        const section = await upsertSection(
          theme,
          grade.id,
          schoolYear.id,
          "REGULAR",
          currentSortOrder++,
          sectionRank,
          tleProgramId,
        );

        // Assign advisory teacher only for non-TLE sections.
        if (teachers.length > 0 && !tleProgramId) {
          const advisor = teachers[teacherRotationIndex % teachers.length];
          await assignSectionAdviser(
            section.id,
            advisor.id,
            schoolYear.id,
            schoolYear.classOpeningDate || new Date(),
          );
          teacherRotationIndex++;
        }
      }

      console.log(
        `    ✓ Finished seeding ${currentSortOrder - 1} sections for ${grade.name}.`,
      );
    }

    console.log(`✓ All sections seeded for ${schoolYear.yearLabel}.`);

    // Ensure: for each active TLE program, there is at least one dedicated section
    // created for Grade 9 (preferred) or Grade 10 (fallback) with tleProgramId set.
    const grade9Level = gradeLevels.find((g) => g.name === "Grade 9");
    const grade10Level = gradeLevels.find((g) => g.name === "Grade 10");

    for (const program of tlePrograms) {
      // Ensure both Grade 9 and Grade 10 have a dedicated section for this program
      for (const targetGrade of [grade9Level, grade10Level]) {
        if (!targetGrade) continue;

        try {
          const existing = await prisma.section.findFirst({
            where: {
              tleProgramId: program.id,
              schoolYearId: schoolYear.id,
              gradeLevelId: targetGrade.id,
            },
          });

          if (existing) continue; // already has a section for this program and grade

          // compute next sortOrder for the target grade in this school year
          const agg = await prisma.section.aggregate({
            where: { gradeLevelId: targetGrade.id, schoolYearId: schoolYear.id },
            _max: { sortOrder: true },
          });
          const nextSort = (agg._max.sortOrder ?? 0) + 1;

          const tleSectionName = `${program.name.toUpperCase()} - TLE`;

          await upsertSection(
            tleSectionName,
            targetGrade.id,
            schoolYear.id,
            "REGULAR",
            nextSort,
            null,
            program.id,
          );
        } catch (err) {
          console.warn(
            `⚠️  Could not ensure TLE section for program ${program.name} (grade ${targetGrade?.name}): ${(err as Error).message}`,
          );
        }
      }
    }
  }

  console.log("\n✓ All sections seeded successfully for all school years.");
}

async function upsertSection(
  name: string,
  gradeId: number,
  syId: number,
  program: ApplicantType,
  sortOrder: number,
  sectionRank: number | null,
  tleProgramId: number | null,
) {
  return await prisma.section.upsert({
    where: {
      uq_sections_name_grade_sy: {
        name,
        gradeLevelId: gradeId,
        schoolYearId: syId,
      },
    },
    update: {
      programType: program,
      sortOrder,
      sectionRank,
      tleProgramId,
      maxCapacity: program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? 35 : 45,
    },
    create: {
      name,
      gradeLevelId: gradeId,
      schoolYearId: syId,
      programType: program,
      sortOrder,
      sectionRank,
      tleProgramId,
      maxCapacity: program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? 35 : 45,
    },
  });
}

async function assignSectionAdviser(
  sectionId: number,
  teacherId: number,
  schoolYearId: number,
  effectiveFrom: Date,
) {
  try {
    const existingForTeacher = await prisma.sectionAdviser.findFirst({
      where: {
        teacherId,
        schoolYearId,
      },
    });

    if (existingForTeacher) {
      if (
        existingForTeacher.sectionId === sectionId &&
        existingForTeacher.status !== "ACTIVE"
      ) {
        await prisma.sectionAdviser.update({
          where: { id: existingForTeacher.id },
          data: {
            status: "ACTIVE" as SectionAdviserStatus,
            effectiveFrom,
            effectiveTo: null,
            handoverReason: null,
          },
        });
      }

      return;
    }

    const existing = await prisma.sectionAdviser.findFirst({
      where: {
        sectionId,
        schoolYearId,
        status: "ACTIVE" as SectionAdviserStatus,
      },
    });

    if (existing && existing.teacherId === teacherId) {
      return;
    }

    if (existing && existing.teacherId !== teacherId) {
      await prisma.sectionAdviser.update({
        where: { id: existing.id },
        data: {
          status: "HANDED_OVER" as SectionAdviserStatus,
          effectiveTo: new Date(),
          handoverReason: "Seed Update",
        },
      });
    }

    await prisma.sectionAdviser.create({
      data: {
        sectionId,
        teacherId,
        schoolYearId,
        effectiveFrom,
        status: "ACTIVE" as SectionAdviserStatus,
      },
    });
  } catch (error) {
    console.warn(
      `⚠️  Failed to assign adviser to section ${sectionId}: ${(error as Error).message}`,
    );
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
