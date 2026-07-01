import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
  const applicant = await prisma.enrollmentApplication.findUnique({
    where: { id: 25 },
    include: { learner: { include: { enrollmentHistories: true } } }
  });
  console.log(applicant?.learner?.enrollmentHistories);
}
main().finally(() => prisma.$disconnect());
