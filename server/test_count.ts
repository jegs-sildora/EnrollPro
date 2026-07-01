import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.enrollmentHistory.count();
  console.log('Total histories:', count);
}
main().finally(() => prisma.$disconnect());
