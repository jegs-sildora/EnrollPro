import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
  const setting = await prisma.schoolSetting.findFirst();
  console.log({
    mockedSystemDate: setting.mockedSystemDate,
    mockedSystemDateAnchor: setting.mockedSystemDateAnchor?.toString(),
    isTimeMachineEnabled: setting.isTimeMachineEnabled
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
