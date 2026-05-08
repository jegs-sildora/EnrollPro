import "dotenv/config";
import { PrismaClient, Role } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🛠️ Starting Teacher User Backfill...");

  const teachers = await prisma.teacher.findMany();
  console.log(`🔍 Found ${teachers.length} teacher profiles.`);

  const defaultPasswordHash = await bcrypt.hash("DepEd2026!", 10);
  let createdCount = 0;
  let updatedCount = 0;

  for (const teacher of teachers) {
    const existingUser = await prisma.user.findUnique({
      where: { employeeId: teacher.employeeId }
    });

    if (!existingUser) {
      await prisma.user.create({
        data: {
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          middleName: teacher.middleName,
          email: teacher.email,
          employeeId: teacher.employeeId,
          password: defaultPasswordHash,
          role: "TEACHER" as Role,
          isActive: teacher.isActive,
          mustChangePassword: true,
        }
      });
      createdCount++;
    } else {
      // Sync existing user to match teacher profile
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          middleName: teacher.middleName,
          email: teacher.email,
          isActive: teacher.isActive,
        }
      });
      updatedCount++;
    }
  }

  console.log(`✅ Backfill complete.`);
  console.log(`📊 Stats: ${createdCount} users created, ${updatedCount} users updated/synced.`);
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
