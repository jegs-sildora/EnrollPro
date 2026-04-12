import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
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

  // 2. Ensure an active School Year exists
  let activeYear = await prisma.schoolYear.findFirst({
    where: { status: "ACTIVE" },
  });

  if (!activeYear) {
    activeYear = await prisma.schoolYear.create({
      data: {
        yearLabel: "2026-2027",
        status: "ACTIVE",
        classOpeningDate: new Date("2026-06-15"),
        classEndDate: new Date("2027-03-31"),
        earlyRegOpenDate: new Date("2026-01-01"),
        earlyRegCloseDate: new Date("2026-05-31"),
        enrollOpenDate: new Date("2026-05-01"),
        enrollCloseDate: new Date("2026-06-30"),
      },
    });
    console.log(`✅ Created Active School Year: ${activeYear.yearLabel}`);

    // Update settings to point to this active year
    await prisma.schoolSetting.update({
      where: { id: settings.id },
      data: { activeSchoolYearId: activeYear.id },
    });
  }

  // 3. Ensure Grade Levels Grade 7-Grade 10 exist for the active school year
  const grades = [
    { name: "Grade 7", legacyName: "G7", displayOrder: 7 },
    { name: "Grade 8", legacyName: "G8", displayOrder: 8 },
    { name: "Grade 9", legacyName: "G9", displayOrder: 9 },
    { name: "Grade 10", legacyName: "G10", displayOrder: 10 },
  ];

  for (const grade of grades) {
    const existingGrade = await prisma.gradeLevel.findFirst({
      where: {
        schoolYearId: activeYear.id,
        OR: [
          { name: grade.name },
          { name: grade.legacyName },
          { displayOrder: grade.displayOrder },
        ],
      },
    });

    if (!existingGrade) {
      await prisma.gradeLevel.create({
        data: {
          name: grade.name,
          displayOrder: grade.displayOrder,
          schoolYearId: activeYear.id,
        },
      });
      console.log(`✅ Created Grade Level: ${grade.name}`);
    } else if (
      existingGrade.name !== grade.name ||
      existingGrade.displayOrder !== grade.displayOrder
    ) {
      await prisma.gradeLevel.update({
        where: { id: existingGrade.id },
        data: {
          name: grade.name,
          displayOrder: grade.displayOrder,
        },
      });
      console.log(
        `✅ Updated Grade Level: ${existingGrade.name} -> ${grade.name}`,
      );
    }
  }

  // 4. Create first SYSTEM_ADMIN account
  const email = process.env.ADMIN_EMAIL ?? "admin@deped.edu.ph";
  const password = process.env.ADMIN_PASSWORD ?? "Admin2026!";

  // Refactored to granular names
  const firstName = process.env.ADMIN_FIRST_NAME ?? "System";
  const lastName = process.env.ADMIN_LAST_NAME ?? "Administrator";

  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  if (existingAdmin) {
    console.log(`Admin account already exists: ${email}`);
    return;
  }

  const hashed = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      password: hashed,
      role: "SYSTEM_ADMIN",
      isActive: true,
      mustChangePassword: true,
    },
  });

  console.log(`✅ System Admin created: ${email}`);
  console.log(`   Temporary password:   ${password}`);
  console.log(`   ⚠  Change this password immediately after first login.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
