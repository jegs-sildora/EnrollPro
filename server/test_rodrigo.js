const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const learner = await prisma.learner.findFirst({
    where: { lastName: 'Baluyot', firstName: 'Rodrigo' },
    include: {
      applications: {
        include: { gradeLevel: true, schoolYear: true }
      },
      enrollmentHistories: {
        include: { gradeLevel: true, schoolYear: true }
      }
    }
  });
  console.log(JSON.stringify(learner, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
