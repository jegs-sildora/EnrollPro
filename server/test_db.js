import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();

async function main() {
  const schoolSetting = await prisma.schoolSetting.findFirst({
    where: { activeSchoolYearId: { not: null } },
  });
  console.log("School Setting:", schoolSetting);
  const grades = await prisma.gradeLevel.findMany();
  console.log("Grades:", grades);
}

main().catch(console.error).finally(() => prisma.$disconnect());
