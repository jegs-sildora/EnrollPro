import { prisma } from "./src/lib/prisma.js";

async function main() {
  const grade8 = await prisma.gradeLevel.findFirst({ where: { name: "Grade 8" } });
  
  const apps = await prisma.enrollmentApplication.findMany({
    where: { gradeLevelId: grade8?.id, schoolYearId: 38 },
  });

  console.log("Grade 8 Applications in SY 38:", apps.length);
  if (apps.length > 0) {
    console.log(apps.slice(0, 5));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
