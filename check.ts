import { PrismaClient } from './server/src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
  const sy = await prisma.schoolYear.findFirst({ where: { status: 'ACTIVE' } });
  console.log('Active SY:', sy);
}
main().catch(console.error).finally(() => prisma.$disconnect());
