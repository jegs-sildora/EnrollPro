const { PrismaClient } = require("./src/generated/prisma/index.js");
const prisma = new PrismaClient();

async function main() {
  const glId = 9; // Grade 7
  const syId = 4; // 2026-2027

  const sections = await prisma.section.findMany({
    where: {
      gradeLevelId: glId,
      schoolYearId: syId
    },
    orderBy: { name: "asc" }
  });

  console.log(`Sections in GL ${glId}, SY ${syId}:`);
  sections.forEach(s => {
    console.log(`ID: ${s.id}, Name: "${s.name}", Program: ${s.programType}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
