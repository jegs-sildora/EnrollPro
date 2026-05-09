const { PrismaClient } = require("./src/generated/prisma/index.js");
const prisma = new PrismaClient();

async function main() {
  const sectionId = 134;

  const designations = await prisma.teacherDesignation.findMany({
    where: {
      advisorySectionId: sectionId
    },
    include: {
      teacher: true
    }
  });

  console.log(`Teacher Designations for Section ${sectionId}:`);
  designations.forEach(d => {
    console.log(`Teacher ID: ${d.teacherId}, Name: "${d.teacher.firstName} ${d.teacher.lastName}", IS Class Adviser: ${d.isClassAdviser}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
