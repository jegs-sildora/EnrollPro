import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const deptMath = await prisma.department.findUnique({ where: { code: "MATH" } });
  const deptSci = await prisma.department.findUnique({ where: { code: "SCI" } });
  const deptEng = await prisma.department.findUnique({ where: { code: "ENG" } });

  if (!deptMath || !deptSci || !deptEng) {
    throw new Error("Standard DepEd Departments (MATH, SCI, ENG) not found. Run main db:seed first.");
  }

  const teachers = [
    {
      employeeId: "T-2026-0001",
      firstName: "LUISA",
      lastName: "MINDA",
      middleName: "VI",
      email: "luisa.minda@deped.edu.ph",
      contactNumber: "09171112222",
      specialization: "MAJOR IN MATHEMATICS",
      isActive: true,
      photoPath: "teacher-photos/minda.png",
      plantillaPosition: "TEACHER III",
      designation: "SUBJECT TEACHER",
      departmentId: deptMath.id,
    },
    {
      employeeId: "T-2026-0002",
      firstName: "RICARDO",
      lastName: "DALISAY",
      middleName: "SANTOS",
      email: "ricardo.dalisay@deped.edu.ph",
      contactNumber: "09173334444",
      specialization: "MAJOR IN GENERAL SCIENCE / BIOLOGY / CHEMISTRY / PHYSICS",
      isActive: true,
      photoPath: "teacher-photos/dalisay.png",
      plantillaPosition: "MASTER TEACHER II",
      designation: "DEPARTMENT HEAD",
      departmentId: deptSci.id,
    },
    {
      employeeId: "T-2026-0003",
      firstName: "FLORANTE",
      lastName: "LAURA",
      middleName: "REYES",
      email: "florante.laura@deped.edu.ph",
      contactNumber: "09175556666",
      specialization: "MAJOR IN ENGLISH / APPLIED LINGUISTICS",
      isActive: true,
      photoPath: "teacher-photos/laura.png",
      plantillaPosition: "TEACHER II",
      designation: "CLASS ADVISER",
      departmentId: deptEng.id,
    }
  ];

  console.log("🌱 Seeding DepEd Teachers...");

  for (const t of teachers) {
    await prisma.teacher.upsert({
      where: { employeeId: t.employeeId },
      update: t,
      create: t,
    });
  }

  console.log("✅ Seeded DepEd teachers successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
