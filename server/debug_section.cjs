const { PrismaClient } = require("./src/generated/prisma/index.js");
const prisma = new PrismaClient();

async function main() {
  const id = 134;
  const section = await prisma.section.findUnique({
    where: { id },
    include: {
      gradeLevel: true,
      schoolYear: true,
      advisers: true
    }
  });

  console.log("Section 134:", JSON.stringify(section, null, 2));

  if (section) {
    const conflicts = await prisma.section.findMany({
      where: {
        name: section.name,
        gradeLevelId: section.gradeLevelId,
        schoolYearId: section.schoolYearId,
        id: { not: id }
      }
    });
    console.log("Potential Conflicts (same name in same grade/SY):", JSON.stringify(conflicts, null, 2));
    
    const strippedName = section.name.replace(/^G(?:RADE)?\s*\d+\s*[-_ ]*/i, "").trim();
    const strippedConflicts = await prisma.section.findMany({
      where: {
        name: strippedName,
        gradeLevelId: section.gradeLevelId,
        schoolYearId: section.schoolYearId,
        id: { not: id }
      }
    });
    console.log(`Conflicts with stripped name "${strippedName}":`, JSON.stringify(strippedConflicts, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
