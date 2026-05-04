import "dotenv/config";
import { PrismaClient, ApplicantType } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const grade7 = await prisma.gradeLevel.findUnique({ where: { name: "Grade 7" } });
  const grade10 = await prisma.gradeLevel.findUnique({ where: { name: "Grade 10" } });
  
  // Find the first school year that is not ARCHIVED
  const activeYear = await prisma.schoolYear.findFirst({ 
    where: { 
        status: { 
            not: "ARCHIVED" 
        } 
    },
    orderBy: { id: "desc" }
  });

  if (!grade7 || !grade10 || !activeYear) {
    throw new Error("Grade 7, Grade 10, or a valid School Year not found. Run main db:seed first.");
  }

  const sections = [
    {
      name: "RIZAL",
      maxCapacity: 45,
      gradeLevelId: grade7.id,
      programType: "REGULAR" as ApplicantType,
      isEosyFinalized: false,
      displayName: "GRADE 7 - RIZAL (REGULAR)",
      sortOrder: 1,
      isHomogeneous: true,
      isSnake: false,
      schoolYearId: activeYear.id,
    },
    {
      name: "CURIE",
      maxCapacity: 35,
      gradeLevelId: grade7.id,
      programType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING" as ApplicantType,
      isEosyFinalized: false,
      displayName: "GRADE 7 - CURIE (STE)",
      sortOrder: 2,
      isHomogeneous: true,
      isSnake: false,
      schoolYearId: activeYear.id,
    },
    {
      name: "BONIFACIO",
      maxCapacity: 45,
      gradeLevelId: grade10.id,
      programType: "REGULAR" as ApplicantType,
      isEosyFinalized: false,
      displayName: "GRADE 10 - BONIFACIO (REGULAR)",
      sortOrder: 1,
      isHomogeneous: true,
      isSnake: false,
      schoolYearId: activeYear.id,
    }
  ];

  console.log("🌱 Seeding DepEd Sections...");

  for (const s of sections) {
    await prisma.section.upsert({
      where: {
        uq_sections_name_grade_sy: {
          name: s.name,
          gradeLevelId: s.gradeLevelId,
          schoolYearId: s.schoolYearId,
        },
      },
      update: s,
      create: s,
    });
  }

  console.log("✅ Seeded DepEd sections successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
