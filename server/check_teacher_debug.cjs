const { PrismaClient } = require("./src/generated/prisma/index.js");
const prisma = new PrismaClient();

async function main() {
  const teacherId = 147;
  const syId = 4;

  const adviserships = await prisma.sectionAdviser.findMany({
    where: {
      teacherId,
      schoolYearId: syId,
      status: "ACTIVE"
    },
    include: {
      section: true
    }
  });

  console.log(`Active Adviserships for Teacher ${teacherId} in SY ${syId}:`);
  adviserships.forEach(a => {
    console.log(`Adviser ID: ${a.id}, Section ID: ${a.sectionId}, Section Name: "${a.section.name}"`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
