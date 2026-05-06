import "dotenv/config";
import { PrismaClient, Role, SchoolYearStatus, Sex, PortalControl } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting Base Seed...");

  // 1. Create an Active School Year
  const yearLabel = "2026-2027";
  let activeSy = await prisma.schoolYear.findUnique({
    where: { yearLabel },
  });

  if (!activeSy) {
    activeSy = await prisma.schoolYear.create({
      data: {
        yearLabel,
        status: "ACTIVE" as SchoolYearStatus,
        classOpeningDate: new Date("2026-06-01T00:00:00Z"),
        classEndDate: new Date("2027-03-31T00:00:00Z"),
        earlyRegOpenDate: new Date("2026-01-15T00:00:00Z"),
        earlyRegCloseDate: new Date("2026-02-28T00:00:00Z"),
        enrollOpenDate: new Date("2026-05-01T00:00:00Z"),
        enrollCloseDate: new Date("2026-05-31T00:00:00Z"),
        portalControl: "AUTO" as PortalControl,
      },
    });
    console.log(`✅ Created Active School Year: ${yearLabel}`);
  } else {
    // If it exists, ensure it's not archived so other seeds can find it
    if (activeSy.status === "ARCHIVED" as SchoolYearStatus) {
        await prisma.schoolYear.update({
            where: { id: activeSy.id },
            data: { status: "ACTIVE" as SchoolYearStatus }
        });
    }
    console.log(`✅ Active School Year already exists: ${yearLabel}`);
  }

  // 2. Ensure school settings row exists with DepEd details
  const defaultSettings = {
    schoolName: "EnrollPro",
    depedEmail: "",
    facebookPageUrl: "",
    schoolWebsite: "",
    selectedAccentHsl: "221 83% 53%",
    activeSchoolYearId: activeSy.id,
  };

  let settings = await prisma.schoolSetting.findFirst();
  if (!settings) {
    settings = await prisma.schoolSetting.create({
      data: defaultSettings,
    });
    console.log("✅ Created default SchoolSettings row.");
  } else {
    await prisma.schoolSetting.update({
      where: { id: settings.id },
      data: defaultSettings
    });
    console.log("✅ SchoolSettings already exists, updated with default values and active SY.");
  }

  // 3. Ensure Grade Levels Grade 7-Grade 10 exist permanently
  const grades = [
    { name: "Grade 7", displayOrder: 7 },
    { name: "Grade 8", displayOrder: 8 },
    { name: "Grade 9", displayOrder: 9 },
    { name: "Grade 10", displayOrder: 10 },
  ];

  for (const grade of grades) {
    await prisma.gradeLevel.upsert({
        where: { name: grade.name },
        update: { displayOrder: grade.displayOrder },
        create: {
            name: grade.name,
            displayOrder: grade.displayOrder,
        }
    });
    console.log(`✅ Verified Permanent Grade Level: ${grade.name}`);
  }

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

  // 5. Create first SYSTEM_ADMIN account
  const email = process.env.ADMIN_EMAIL ?? "admin@deped.edu.ph";
  const password = process.env.ADMIN_PASSWORD ?? "Admin2026!";
  const firstName = process.env.ADMIN_FIRST_NAME ?? "SYSTEM";
  const lastName = process.env.ADMIN_LAST_NAME ?? "ADMINISTRATOR";

  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  if (existingAdmin) {
    console.log(`✅ Admin account already exists: ${email}`);
  } else {
    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: "SYSTEM_ADMIN" as Role,
        isActive: true,
        mustChangePassword: true,
        sex: "MALE" as Sex,
        designation: "SYSTEM ADMINISTRATOR",
        employeeId: "SYSADMIN-001",
      },
    });
    console.log(`✅ System Admin created: ${email}`);
    console.log(`   Temporary password:   ${password}`);
  }
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
