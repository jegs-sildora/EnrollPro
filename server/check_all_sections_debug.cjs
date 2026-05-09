const { PrismaClient } = require("./src/generated/prisma/index.js");
const prisma = new PrismaClient();

async function main() {
  const name = "STE 7-SIRIUS";

  const sections = await prisma.section.findMany({
    where: { name },
    include: {
      gradeLevel: true,
      schoolYear: true
    }
  });

  console.log(`Sections named "${name}":`);
  sections.forEach(s => {
    console.log(`ID: ${s.id}, GL: ${s.gradeLevel.name}, SY: ${s.schoolYear.yearLabel} (${s.schoolYearId}), Program: ${s.programType}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
