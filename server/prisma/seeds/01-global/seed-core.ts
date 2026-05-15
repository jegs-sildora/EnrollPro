import "dotenv/config";
import {
  PrismaClient,
  Role,
  SchoolYearStatus,
  Sex,
  PortalControl,
  TLECategory,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting Base Seed...");

  // 1. Create School Years for the Demo Timeline
  const years = [
    {
      yearLabel: "2022-2023",
      status: "ARCHIVED" as SchoolYearStatus,
      classOpeningDate: new Date("2022-06-01T00:00:00Z"),
      classEndDate: new Date("2023-03-31T00:00:00Z"),
      earlyRegOpenDate: new Date("2022-01-15T00:00:00Z"),
      earlyRegCloseDate: new Date("2022-02-28T00:00:00Z"),
      enrollOpenDate: new Date("2022-05-01T00:00:00Z"),
      enrollCloseDate: new Date("2022-05-31T00:00:00Z"),
    },
    {
      yearLabel: "2023-2024",
      status: "ARCHIVED" as SchoolYearStatus,
      classOpeningDate: new Date("2023-06-01T00:00:00Z"),
      classEndDate: new Date("2024-03-31T00:00:00Z"),
      earlyRegOpenDate: new Date("2023-01-15T00:00:00Z"),
      earlyRegCloseDate: new Date("2023-02-28T00:00:00Z"),
      enrollOpenDate: new Date("2023-05-01T00:00:00Z"),
      enrollCloseDate: new Date("2023-05-31T00:00:00Z"),
    },
    {
      yearLabel: "2024-2025",
      status: "ARCHIVED" as SchoolYearStatus,
      classOpeningDate: new Date("2024-06-01T00:00:00Z"),
      classEndDate: new Date("2025-03-31T00:00:00Z"),
      earlyRegOpenDate: new Date("2024-01-15T00:00:00Z"),
      earlyRegCloseDate: new Date("2024-02-28T00:00:00Z"),
      enrollOpenDate: new Date("2024-05-01T00:00:00Z"),
      enrollCloseDate: new Date("2024-05-31T00:00:00Z"),
    },
    {
      yearLabel: "2025-2026",
      status: "ACTIVE" as SchoolYearStatus, // The "Current" year at the start of demo
      classOpeningDate: new Date("2025-06-01T00:00:00Z"),
      classEndDate: new Date("2026-03-31T00:00:00Z"),
      earlyRegOpenDate: new Date("2025-01-15T00:00:00Z"),
      earlyRegCloseDate: new Date("2025-02-28T00:00:00Z"),
      enrollOpenDate: new Date("2025-05-01T00:00:00Z"),
      enrollCloseDate: new Date("2025-05-31T00:00:00Z"),
    },
  ];

  for (const y of years) {
    await prisma.schoolYear.upsert({
      where: { yearLabel: y.yearLabel },
      update: { status: y.status },
      create: { ...y, portalControl: "AUTO" as PortalControl },
    });
    console.log(`Γ£à Verified School Year: ${y.yearLabel} (${y.status})`);
  }

  const activeSy = await prisma.schoolYear.findFirst({
    where: { yearLabel: "2025-2026" },
  });

  if (!activeSy) throw new Error("Timeline failure: 2025-2026 not found.");

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
    console.log("Γ£à Created default SchoolSettings row.");
  } else {
    await prisma.schoolSetting.update({
      where: { id: settings.id },
      data: defaultSettings,
    });
    console.log(
      "Γ£à SchoolSettings already exists, updated with default values and active SY.",
    );
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
      },
    });
    console.log(`Γ£à Verified Permanent Grade Level: ${grade.name}`);
  }

  // 4. Seed Standard DepEd JHS Departments
  const departments = [
    {
      name: "Mathematics",
      code: "MATH",
      description: "Mathematics Department",
    },
    { name: "Science", code: "SCI", description: "Science Department" },
    { name: "English", code: "ENG", description: "English Department" },
    { name: "Filipino", code: "FIL", description: "Filipino Department" },
    {
      name: "Araling Panlipunan",
      code: "AP",
      description: "Araling Panlipunan Department",
    },
    {
      name: "Edukasyon sa Pagpapakatao",
      code: "ESP",
      description: "EsP Department",
    },
    {
      name: "MAPEH",
      code: "MAPEH",
      description: "Music, Arts, Physical Education, and Health",
    },
    {
      name: "Technology and Livelihood Education",
      code: "TLE",
      description: "TLE Department",
    },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, description: dept.description },
      create: {
        name: dept.name,
        code: dept.code,
        description: dept.description,
      },
    });
  }
  console.log("✅ Verified Standard DepEd Departments");

  // 5. Seed TLE Programs (idempotent by name)
  const tlePrograms: {
    name: string;
    category: TLECategory;
    displayOrder: number;
  }[] = [
    { name: "ICT - Computer Systems Servicing", category: "ICT", displayOrder: 1 },
    { name: "HE - Cookery", category: "HOME_ECONOMICS", displayOrder: 2 },
    {
      name: "HE - Bread and Pastry Production",
      category: "HOME_ECONOMICS",
      displayOrder: 3,
    },
    { name: "HE - Caregiving", category: "HOME_ECONOMICS", displayOrder: 4 },
    { name: "IA - Carpentry", category: "INDUSTRIAL_ARTS", displayOrder: 5 },
    {
      name: "IA - Electrical Installation and Maintenance",
      category: "INDUSTRIAL_ARTS",
      displayOrder: 6,
    },
    { name: "IA - Electronics", category: "INDUSTRIAL_ARTS", displayOrder: 7 },
    {
      name: "IA - Shielded Metal Arc Welding",
      category: "INDUSTRIAL_ARTS",
      displayOrder: 8,
    },
    {
      name: "AFA - Agricultural Crops Production",
      category: "AGRI_FISHERY_ARTS",
      displayOrder: 9,
    },
    {
      name: "AFA - Fishery Arts",
      category: "AGRI_FISHERY_ARTS",
      displayOrder: 10,
    },
    {
      name: "AFA - Swine Production",
      category: "AGRI_FISHERY_ARTS",
      displayOrder: 11,
    },
  ];
  for (const prog of tlePrograms) {
    await prisma.tLEProgram.upsert({
      where: { name: prog.name },
      update: { category: prog.category, displayOrder: prog.displayOrder },
      create: {
        name: prog.name,
        category: prog.category,
        displayOrder: prog.displayOrder,
        isActive: true,
      },
    });
  }
  console.log("✅ Verified TLE Programs");

  // 6. Create first SYSTEM_ADMIN account
  const adminId = process.env.ADMIN_EMPLOYEE_ID ?? "1000001";
  const email = process.env.ADMIN_EMAIL ?? "admin@deped.edu.ph";
  const password = process.env.ADMIN_PASSWORD ?? "Admin2026!";
  const firstName = process.env.ADMIN_FIRST_NAME ?? "SYSTEM";
  const lastName = process.env.ADMIN_LAST_NAME ?? "ADMINISTRATOR";

  const existingAdmin = await prisma.user.findUnique({
    where: { employeeId: adminId },
  });
  if (existingAdmin) {
    console.log(`Γ£à Admin account already exists: ${adminId} (${email})`);
  } else {
    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        employeeId: adminId,
        accountName: adminId,
        password: hashedPassword,
        role: "SYSTEM_ADMIN" as Role,
        isActive: true,
        mustChangePassword: true,
        sex: "MALE" as Sex,
        designation: "SYSTEM ADMINISTRATOR",
      },
    });
    console.log(`Γ£à System Admin created: ${adminId} (${email})`);
    console.log(`   Temporary password:   ${password}`);
  }

  // 6. Create default HEAD_REGISTRAR account
  const regId = process.env.REGISTRAR_EMPLOYEE_ID ?? "1000002";
  const regEmail = process.env.REGISTRAR_EMAIL ?? "registrar@deped.edu.ph";
  const regPassword = process.env.REGISTRAR_PASSWORD ?? "Registrar2026!";
  const regFirstName = process.env.REGISTRAR_FIRST_NAME ?? "HEAD";
  const regLastName = process.env.REGISTRAR_LAST_NAME ?? "REGISTRAR";

  const existingRegistrar = await prisma.user.findUnique({
    where: { employeeId: regId },
  });
  if (existingRegistrar) {
    console.log(`Γ£à Registrar account already exists: ${regId} (${regEmail})`);
  } else {
    const hashedRegPassword = await bcrypt.hash(regPassword, 12);
    await prisma.user.create({
      data: {
        firstName: regFirstName,
        lastName: regLastName,
        email: regEmail,
        employeeId: regId,
        accountName: regId,
        password: hashedRegPassword,
        role: "HEAD_REGISTRAR" as Role,
        isActive: true,
        mustChangePassword: true,
        sex: "FEMALE" as Sex,
        designation: "HEAD REGISTRAR",
      },
    });
    console.log(`Γ£à Head Registrar created: ${regId} (${regEmail})`);
    console.log(`   Temporary password:   ${regPassword}`);
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
