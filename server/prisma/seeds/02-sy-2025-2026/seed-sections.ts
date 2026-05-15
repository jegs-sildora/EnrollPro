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

// TLE track names as stored in the TLEProgram table.
// These are cycled through G9 and G10 BEC sections.
const TLE_TRACK_NAMES = [
  "HE - Cookery",
  "HE - Bread and Pastry Production",
  "ICT - Computer Systems Servicing",
  "ICT - Technical Drafting",
  "IA - Electrical Installation and Maintenance",
  "IA - Carpentry",
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

  // Pre-load TLE program IDs by name so we can assign tleProgramId (FK) on G9/G10 BEC sections.
  const tlePrograms = await prisma.tLEProgram.findMany({
    where: { name: { in: TLE_TRACK_NAMES } },
    select: { id: true, name: true },
  });

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

  const gradeLevels = await prisma.gradeLevel.findMany({
    where: { name: { in: ["Grade 7", "Grade 8", "Grade 9", "Grade 10"] } },
    orderBy: { displayOrder: "asc" },
  });

  let teacherRotationIndex = 0;

  // Seed sections for each school year
  for (const schoolYear of schoolYears) {
    console.log(`\n📅 Seeding sections for ${schoolYear.yearLabel}...`);

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

      let tleIndex = 0;
      for (let i = 0; i < themes.length; i++) {
        const theme = themes[i];
        const sectionRank = i + 1;

        let tleProgramId: number | null = null;
        if (gradeNum === 9 || gradeNum === 10) {
          const trackName = TLE_TRACK_NAMES[tleIndex % TLE_TRACK_NAMES.length];
          tleProgramId = tleMap[trackName] ?? null;
          tleIndex++;
        }

        const section = await upsertSection(
          theme,
          grade.id,
          schoolYear.id,
          "REGULAR",
          currentSortOrder++,
          sectionRank,
          tleProgramId,
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

      console.log(
        `    ✓ Finished seeding ${currentSortOrder - 1} sections for ${grade.name}.`,
      );
    }

    console.log(`✓ All sections seeded for ${schoolYear.yearLabel}.`);
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
    await prisma.sectionAdviser.upsert({
      where: {
        sectionId_teacherId_schoolYearId: {
          sectionId,
          teacherId,
          schoolYearId,
        },
      },
      update: {
        status: "ACTIVE" as SectionAdviserStatus,
        effectiveFrom,
        effectiveTo: null,
      },
      create: {
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
