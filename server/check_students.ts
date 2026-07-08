import { prisma } from "./src/lib/prisma.js";

async function main() {
  const grade8 = await prisma.gradeLevel.findFirst({ where: { name: "Grade 8" } });
  console.log("Grade 8 ID:", grade8?.id);

  const apps = await prisma.enrollmentApplication.findMany({
    where: { gradeLevelId: grade8?.id },
    select: {
      id: true,
      status: true,
      schoolYearId: true,
      learnerId: true,
      enrollmentRecord: {
        select: {
          id: true,
          sectionId: true,
          eosyStatus: true
        }
      }
    }
  });

  console.log("Grade 8 Applications:", apps.length);
  if (apps.length > 0) {
    console.log(apps.slice(0, 5));
  }

  const learners = await prisma.learner.findMany({
    where: {
      enrollmentApplications: {
        some: { gradeLevelId: grade8?.id }
      }
    },
    take: 5
  });
  console.log("Grade 8 Learners:", learners.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
