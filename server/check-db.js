import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const setting = await prisma.schoolSetting.findFirst();
  console.log(setting);
}
main().catch(console.error).finally(() => prisma.$disconnect());
