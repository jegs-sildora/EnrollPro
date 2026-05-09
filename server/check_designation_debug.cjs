const { PrismaClient } = require("./src/generated/prisma/index.js");
const prisma = new PrismaClient();

async function main() {
  const teacherId = 147;
  const syId = 4;

  const designations = await prisma.teacherDesignation.findMany({
    where: {
      teacherId,
      schoolYearId: syId
    }
  });

  console.log(`Designations for Teacher ${teacherId} in SY ${syId}:`);
  console.log(JSON.stringify(designations, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
