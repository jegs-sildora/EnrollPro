import { PrismaClient } from "./server/src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function check() {
  try {
    const settings = await prisma.schoolSetting.findFirst();
    console.log("Active School Year ID:", settings?.activeSchoolYearId);

    const enrollmentCount = await prisma.enrollmentApplication.count();
    console.log("Total Enrollment Applications:", enrollmentCount);

    const earlyRegCount = await prisma.earlyRegistrationApplication.count();
    console.log("Total Early Registration Applications:", earlyRegCount);

    const apps = await prisma.enrollmentApplication.findMany({
      take: 5,
      include: {
        learner: true,
        gradeLevel: true,
      }
    });
    console.log("Enrollment Apps Sample:", JSON.stringify(apps, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
