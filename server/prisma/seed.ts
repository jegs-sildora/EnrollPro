import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Ensure school settings row exists
  let settings = await prisma.schoolSetting.findFirst();
  if (!settings) {
    settings = await prisma.schoolSetting.create({
      data: { schoolName: "EnrollPro" },
    });
    console.log("Created default SchoolSettings row.");
  } else {
    console.log("SchoolSettings already exists.");
  }

  // 2. Ensure Grade Levels Grade 7-Grade 10 exist permanently
  const grades = [
    { name: "Grade 7", displayOrder: 7 },
    { name: "Grade 8", displayOrder: 8 },
    { name: "Grade 9", displayOrder: 9 },
    { name: "Grade 10", displayOrder: 10 },
  ];

  for (const grade of grades) {
    const existing = await prisma.gradeLevel.findFirst({
      where: { name: grade.name },
    });

    if (existing) {
      await prisma.gradeLevel.update({
        where: { id: existing.id },
        data: { displayOrder: grade.displayOrder },
      });
    } else {
      await prisma.gradeLevel.create({
        data: {
          name: grade.name,
          displayOrder: grade.displayOrder,
        },
      });
    }
    console.log(`✅ Verified Permanent Grade Level: ${grade.name}`);
  }

  // 3. Create first SYSTEM_ADMIN account
  const email = process.env.ADMIN_EMAIL ?? "admin@deped.edu.ph";
  const password = process.env.ADMIN_PASSWORD ?? "Admin2026!";

  // Refactored to granular names
  const firstName = process.env.ADMIN_FIRST_NAME ?? "System";
  const lastName = process.env.ADMIN_LAST_NAME ?? "Administrator";

  // 4. Seed Standard DepEd JHS Departments
  const departments = [
    { name: "Mathematics", code: "MATH", description: "Mathematics Department" },
    { name: "Science", code: "SCI", description: "Science Department" },
    { name: "English", code: "ENG", description: "English Department" },
    { name: "Filipino", code: "FIL", description: "Filipino Department" },
    { name: "Araling Panlipunan", code: "AP", description: "Araling Panlipunan Department" },
    { name: "Edukasyon sa Pagpapakatao", code: "ESP", description: "EsP Department" },
    { name: "MAPEH", code: "MAPEH", description: "Music, Arts, Physical Education, and Health" },
    { name: "Technology and Livelihood Education", code: "TLE", description: "TLE Department" }
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, description: dept.description },
      create: { name: dept.name, code: dept.code, description: dept.description },
    });
  }
  console.log("✅ Verified Standard DepEd Departments");

  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  if (existingAdmin) {
    console.log(`Admin account already exists: ${email}`);
    return;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
