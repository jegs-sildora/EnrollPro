import "dotenv/config";
import { PrismaClient, Role, Sex } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding Custom School Head...");

  const employeeId = "1234505";
  const password = "DepEd2026!";
  
  const existingUser = await prisma.user.findFirst({
    where: { employeeId }
  });

  if (existingUser) {
    console.log(`⚠️ User with employee ID ${employeeId} already exists. Skipping.`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const newUser = await prisma.user.create({
    data: {
      firstName: "Juan",
      lastName: "Dela Cruz",
      employeeId: employeeId,
      accountName: employeeId,
      password: hashedPassword,
      roles: ["SYSTEM_ADMIN" as Role],
      designation: "School Head",
      sex: "MALE" as Sex,
      mobileNumber: "09171234505",
      mustChangePassword: true,
      isActive: true,
    },
  });

  console.log(`✅ Successfully created School Head: ${newUser.firstName} ${newUser.lastName} (${newUser.employeeId})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
