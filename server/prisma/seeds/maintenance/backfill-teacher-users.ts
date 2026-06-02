import "dotenv/config";
import { PrismaClient, Role, Sex } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("≡ƒ¢á∩╕Å Starting Teacher User Backfill...");

  const teachers = await prisma.teacher.findMany();
  console.log(`≡ƒöì Found ${teachers.length} teacher profiles.`);

  const defaultPasswordHash = await bcrypt.hash("DepEd2026!", 10);
  let createdCount = 0;
  let updatedCount = 0;

  for (const teacher of teachers) {
    const existingUser = await prisma.user.findUnique({
      where: { employeeId: teacher.employeeId }
    });

    let userId = existingUser?.id;

    if (!existingUser) {
      const newUser = await prisma.user.create({
        data: {
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          middleName: teacher.middleName,
          sex: teacher.sex,
          email: teacher.email,
          employeeId: teacher.employeeId,
          mobileNumber: teacher.contactNumber,
          password: defaultPasswordHash,
          role: "TEACHER" as Role,
          isActive: teacher.isActive,
          mustChangePassword: true,
        }
      });
      userId = newUser.id;
      createdCount++;
    } else {
      // Sync existing user to match teacher profile (Master record approach)
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          middleName: teacher.middleName,
          sex: teacher.sex,
          email: teacher.email,
          mobileNumber: teacher.contactNumber,
          isActive: teacher.isActive,
        }
      });
      updatedCount++;
    }

    // CRITICAL: Link the teacher profile to the user account if not already linked
    if (teacher.userId !== userId) {
      await prisma.teacher.update({
        where: { id: teacher.id },
        data: { userId }
      });
    }
  }

  console.log(`Γ£à Backfill complete.`);
  console.log(`≡ƒôè Stats: ${createdCount} users created, ${updatedCount} users updated/synced.`);
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
