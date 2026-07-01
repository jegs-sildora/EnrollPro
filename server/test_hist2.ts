import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
  const hists = await prisma.enrollmentHistory.findMany({
    take: 5,
    include: { learner: true }
  });
  console.log(hists);
}
main().finally(() => prisma.$disconnect());
