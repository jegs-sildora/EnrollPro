import "dotenv/config";
import { PrismaClient } from "./src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting backfill of Teacher profiles for non-teaching staff...");

  const users = await prisma.user.findMany({
    where: {
      roles: {
        hasSome: ["SYSTEM_ADMIN", "HEAD_REGISTRAR", "MRF"],
      },
      employeeId: {
        not: null,
      },
    },
    include: {
      teacherProfile: true,
    },
  });

  console.log(`Found ${users.length} non-teaching staff users.`);

  let createdCount = 0;

  for (const user of users) {
    if (!user.teacherProfile) {
      console.log(`Creating Teacher profile for ${user.firstName} ${user.lastName} (${user.employeeId})...`);
      
      const teacherEmail = user.email || `${user.employeeId}@noemail.deped.local`;
      
      await prisma.teacher.create({
        data: {
          employeeId: user.employeeId!,
          firstName: user.firstName,
          lastName: user.lastName,
          middleName: user.middleName,
          sex: user.sex,
          email: teacherEmail,
          contactNumber: user.mobileNumber,
          designation: user.designation,
          isActive: user.isActive,
          userId: user.id,
        },
      });
      createdCount++;
    } else {
      console.log(`User ${user.firstName} ${user.lastName} already has a Teacher profile.`);
    }
  }

  console.log(`Backfill complete. Created ${createdCount} missing Teacher profiles.`);
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
