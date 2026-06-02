import "dotenv/config";
import { PrismaClient, Role, Sex } from "../../../src/generated/prisma/index.js";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("DepEd@2026", 12);
  const now = new Date();

  const users = [
    {
      firstName: "JUAN",
      lastName: "DELA CRUZ",
      middleName: "SANTOS",
      suffix: "JR.",
      sex: "MALE" as Sex,
      employeeId: "1000003",
      accountName: "1000003",
      designation: "SYSTEM ADMINISTRATOR",
      mobileNumber: "09170000001",
      email: "juan.delacruz@deped.edu.ph", // Using .edu.ph to match main seed
      password: hashedPassword,
      role: "SYSTEM_ADMIN" as Role,
      isActive: true,
      lastLoginAt: now,
      mustChangePassword: false,
    },
    {
      firstName: "MARIA",
      lastName: "REYES",
      middleName: "CLARA",
      suffix: "",
      sex: "FEMALE" as Sex,
      employeeId: "1000004",
      accountName: "1000004",
      designation: "HEAD REGISTRAR",
      mobileNumber: "09180000002",
      email: "maria.reyes@deped.edu.ph",
      password: hashedPassword,
      role: "HEAD_REGISTRAR" as Role,
      isActive: true,
      lastLoginAt: now,
      mustChangePassword: true,
    },
  ];

  console.log("≡ƒî▒ Seeding DepEd Users...");

  for (const user of users) {
    await prisma.user.upsert({
      where: { employeeId: user.employeeId },
      update: {
        ...user,
        // If updating, preserve password unless it's the seed one
      },
      create: user,
    });
  }

  console.log("Γ£à Seeded DepEd users successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
