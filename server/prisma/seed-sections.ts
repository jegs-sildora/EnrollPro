import "dotenv/config";
import { PrismaClient, ApplicantType } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const STARS = ["SIRIUS", "VEGA", "RIGEL", "ARCTURUS", "CAPELLA", "CANOPUS", "ALTAIR", "PROCYON"];
const HEROES = [
  "JOSE RIZAL", "ANDRES BONIFACIO", "APOLINARIO MABINI", "MARCELO DEL PILAR",
  "JUAN LUNA", "EMILIO JACINTO", "GABRIELA SILANG", "EMILIO AGUINALDO",
  "GRACIANO LOPEZ JAENA", "GREGORIO DEL PILAR", "MELCHORA AQUINO", "DIEGO SILANG",
  "FRANCISCO BALAGTAS", "MARCIANA AGONCILLO", "TERESA MAGBANUA", "TRINIDAD TECSON"
];
const CORE_VALUES = [
  "MAKA-DIYOS", "MAKATAO", "MAKAKALIKASAN", "MAKABANSA", "KARANGALAN",
  "KATAPATAN", "KATAPANGAN", "KAGALINGAN", "KAAYUSAN", "KALAYAAN",
  "KATARUNGAN", "KASIPAGAN", "PAGKAKAISA", "PAGMAMAHAL", "PAGMALASAKIT",
  "PAGTITIPID", "PAGKAMALIKHAIN"
];
const FLOWERS = [
  "SAMPAGUITA", "GUMAMELA", "ROSAS", "ORCHID", "SUNFLOWER", "DAISY",
  "LILY", "TULIP", "JASMINE", "HIBISCUS", "ANTHURIUM", "CATTLEYA"
];
const MINERALS = [
  "GOLD", "SILVER", "COPPER", "IRON", "NICKEL", "CHROMITE",
  "QUARTZ", "FELDSPAR", "MICA", "TALC", "GYPSUM", "CALCITE", "APATITE"
];

const TLE_TRACKS = [
  "HE - Cookery",
  "HE - Bread and Pastry Production",
  "ICT - Computer Systems Servicing",
  "ICT - Technical Drafting",
  "IA - Electrical Installation and Maintenance",
  "IA - Carpentry",
  "AFA - Agricultural Crops Production"
];

async function main() {
  console.log("🌱 Seeding DepEd Sections with TLE Specializations for Grades 9-10...");

  const activeYear = await prisma.schoolYear.findFirst({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { id: "desc" }
  });

  if (!activeYear) throw new Error("No valid school year found.");

  const gradeLevels = await prisma.gradeLevel.findMany({
    where: { name: { in: ["Grade 7", "Grade 8", "Grade 9", "Grade 10"] } },
    orderBy: { displayOrder: "asc" }
  });

  for (const grade of gradeLevels) {
    const gradeNum = parseInt(grade.name.split(" ")[1]);
    console.log(`\n📦 Processing ${grade.name}...`);

    let currentSortOrder = 1;

    // 1. SCP Sections (2 Stars per grade)
    const gradeStars = STARS.slice((gradeNum - 7) * 2, (gradeNum - 7) * 2 + 2);
    for (const star of gradeStars) {
      await upsertSection(star, grade.id, activeYear.id, "SCIENCE_TECHNOLOGY_AND_ENGINEERING", currentSortOrder++, null);
    }

    // Initialize a counter to cycle through the TLE tracks for regular sections
    let tleIndex = 0;

    // 2. BEC Sections "1" to "5"
    for (let i = 1; i <= 5; i++) {
      const specialization = (gradeNum === 9 || gradeNum === 10) 
        ? TLE_TRACKS[tleIndex % TLE_TRACKS.length] 
        : null;
      
      await upsertSection(i.toString(), grade.id, activeYear.id, "REGULAR", currentSortOrder++, specialization);
      if (specialization) tleIndex++;
    }

    // 3. Themed BEC Sections
    let themes: string[] = [];
    if (gradeNum === 7) themes = HEROES;
    else if (gradeNum === 8) themes = CORE_VALUES;
    else if (gradeNum === 9) themes = FLOWERS;
    else if (gradeNum === 10) themes = MINERALS;

    for (const name of themes) {
      const specialization = (gradeNum === 9 || gradeNum === 10) 
        ? TLE_TRACKS[tleIndex % TLE_TRACKS.length] 
        : null;

      await upsertSection(name, grade.id, activeYear.id, "REGULAR", currentSortOrder++, specialization);
      if (specialization) tleIndex++;
    }
    
    console.log(`✅ Finished seeding ${currentSortOrder - 1} sections for ${grade.name}.`);
  }

  console.log("\n✅ All sections seeded successfully with TLE specializations.");
}

async function upsertSection(name: string, gradeId: number, syId: number, program: ApplicantType, sortOrder: number, tleSpecialization: string | null) {
  await prisma.section.upsert({
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
      maxCapacity: program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? 35 : 45,
      tleSpecialization
    },
    create: {
      name,
      gradeLevelId: gradeId,
      schoolYearId: syId,
      programType: program,
      sortOrder,
      maxCapacity: program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? 35 : 45,
      tleSpecialization
    },
  });
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
