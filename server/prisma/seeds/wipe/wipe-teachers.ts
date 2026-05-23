import { PrismaClient } from "../../../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting teachers wipe...");

  await prisma.$transaction([
    // SectionAdvisers reference teachers
    prisma.sectionAdviser.deleteMany({}),

    // TeacherDesignations reference teachers
    prisma.teacherDesignation.deleteMany({}),

    // Departments might reference a teacher as Head
    prisma.department.updateMany({
      data: { headId: null }
    }),

    // Finally delete teachers
    prisma.teacher.deleteMany({})
  ]);

  console.log("Γ£à Wiped all teachers and their functional designations.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
