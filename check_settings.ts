import { PrismaClient } from './server/src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
  const setting = await prisma.schoolSetting.findFirst();
  console.log('SchoolSetting:', setting);
}
main().catch(console.error).finally(() => prisma.$disconnect());
