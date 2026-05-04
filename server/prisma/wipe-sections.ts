import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting sections wipe...");

  // 1. Clear dependent records that reference sections
  await prisma.$transaction([
    // EnrollmentRecords reference sections (RESTRICT)
    prisma.enrollmentRecord.deleteMany({}),
    
    // SectionAdvisers reference sections (CASCADE in schema, but explicit is safer)
    prisma.sectionAdviser.deleteMany({}),

    // TeacherDesignations reference advisorySectionId (Nullable)
    prisma.teacherDesignation.updateMany({
      data: { advisorySectionId: null }
    }),

    // Finally delete sections
    prisma.section.deleteMany({})
  ]);

  console.log("✅ Wiped all sections and their dependencies (EnrollmentRecords, Advisers).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
