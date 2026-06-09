import "dotenv/config";
import { PrismaClient, SchoolYearStatus, Role, Sex } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding Default School Year (2026-2027)...");

  const yearLabel = "2026-2027";
  const status: SchoolYearStatus = "ACTIVE";
  
  const sy = await prisma.schoolYear.upsert({
    where: { yearLabel },
    update: { status },
    create: {
      yearLabel,
      status,
      classOpeningDate: new Date("2026-06-01T00:00:00Z"),
      classEndDate: new Date("2027-03-31T00:00:00Z"),
      enrollOpenDate: new Date("2026-05-01T00:00:00Z"),
      enrollCloseDate: new Date("2026-05-31T00:00:00Z"),
    },
  });

  console.log(`✅ Default School Year created: ${sy.yearLabel}`);

  const defaultSettings = {
    schoolName: "EnrollPro",
    depedEmail: "",
    facebookPageUrl: "",
    schoolWebsite: "",
    selectedAccentHsl: "221 83% 53%",
    activeSchoolYearId: sy.id,
  };

  const existingSettings = await prisma.schoolSetting.findFirst();
  if (!existingSettings) {
    await prisma.schoolSetting.create({ data: defaultSettings });
    console.log("✅ Created default SchoolSettings.");
  } else {
    await prisma.schoolSetting.update({
      where: { id: existingSettings.id },
      data: defaultSettings,
    });
    console.log("✅ Updated SchoolSettings to use 2026-2027.");
  }

  console.log("🌱 Seeding Default Users...");

  const usersToCreate = [
    {
      firstName: "Jose",
      lastName: "Rizal",
      email: "jrizal.admin@deped.edu.ph",
      employeeId: "1234501", // 7-digit
      role: "SYSTEM_ADMIN" as Role,
      designation: "School Head",
      sex: "MALE" as Sex,
      mobileNumber: "09171234501",
    },
    {
      firstName: "Gabriela",
      lastName: "Silang",
      email: "gsilang.reg@deped.edu.ph",
      employeeId: "1234502",
      role: "HEAD_REGISTRAR" as Role,
      designation: "Registrar",
      sex: "FEMALE" as Sex,
      mobileNumber: "09171234502",
    },
    {
      firstName: "Andres",
      lastName: "Bonifacio",
      email: "abonifacio.mrf@deped.edu.ph",
      employeeId: "1234503",
      role: "MRF" as Role,
      designation: "MRF Staff",
      sex: "MALE" as Sex,
      mobileNumber: "09171234503",
    },
  ];

  const defaultPassword = "DepEd2026!";
  const hashedPassword = await bcrypt.hash(defaultPassword, 12);

  for (const u of usersToCreate) {
    await prisma.user.upsert({
      where: { employeeId: u.employeeId },
      update: {
        password: hashedPassword, // Reset password to default
        mustChangePassword: true, // Force password change
        role: u.role,
        isActive: true,
      },
      create: {
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        employeeId: u.employeeId,
        accountName: u.employeeId,
        password: hashedPassword,
        role: u.role,
        isActive: true,
        mustChangePassword: true,
        sex: u.sex,
        designation: u.designation,
        mobileNumber: u.mobileNumber,
      },
    });
    console.log(`✅ Upserted User: ${u.firstName} ${u.lastName} (${u.role})`);
  }

  console.log("🌱 Seeding Grade Levels...");
  const gradeLevels = [
    { name: "Grade 7", displayOrder: 7 },
    { name: "Grade 8", displayOrder: 8 },
    { name: "Grade 9", displayOrder: 9 },
    { name: "Grade 10", displayOrder: 10 },
  ];

  for (const gl of gradeLevels) {
    await prisma.gradeLevel.upsert({
      where: { name: gl.name },
      update: { displayOrder: gl.displayOrder },
      create: gl,
    });
  }
  console.log("✅ Seeded Grade Levels.");

  console.log("✅ Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
