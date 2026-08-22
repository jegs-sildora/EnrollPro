import { PrismaClient } from './server/src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
  const years = await prisma.schoolYear.findMany();
  console.log('School years:', years.map(y => ({ id: y.id, label: y.yearLabel, status: y.status })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
