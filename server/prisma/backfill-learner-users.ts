import "dotenv/config";
import { PrismaClient, Role } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🛠️ Starting Learner User Backfill (Syncing Profiles to System Accounts)...");

  const learners = await prisma.learner.findMany({
    include: {
      user: true
    }
  });
  console.log(`🔍 Found ${learners.length} learner profiles.`);

  const defaultPasswordHash = await bcrypt.hash("Learner2026!", 10);
  let createdCount = 0;
  let updatedCount = 0;

  for (const learner of learners) {
    // Determine the unique identifier for the user account
    // For learners, we prefer LRN if available, otherwise externalId
    const employeeId = learner.lrn || learner.externalId;
    
    // Check if user already exists (linked by userId or matching employeeId/lrn)
    let existingUser = learner.user;
    
    if (!existingUser) {
      existingUser = await prisma.user.findUnique({
        where: { employeeId: employeeId }
      });
    }

    if (!existingUser) {
      // STEP 1: Create the User account
      const cleanFirst = learner.firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanLast = learner.lastName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const baseEmail = `${cleanFirst}.${cleanLast}`;
      let email = `${baseEmail}@deped.edu.ph`;

      // Check for email collision
      const emailCollision = await prisma.user.findUnique({ where: { email } });
      if (emailCollision) {
        email = `${baseEmail}.${learner.id}@deped.edu.ph`;
      }

      const newUser = await prisma.user.create({
        data: {
          firstName: learner.firstName,
          lastName: learner.lastName,
          middleName: learner.middleName,
          sex: learner.sex,
          email: email,
          employeeId: employeeId,
          password: defaultPasswordHash,
          role: "LEARNER" as Role,
          isActive: true,
          mustChangePassword: true,
        }
      });

      // STEP 2: Link the Learner profile to the new User
      await prisma.learner.update({
        where: { id: learner.id },
        data: { userId: newUser.id }
      });

      createdCount++;
    } else {
      // Sync existing user to match learner profile (Teacher Pattern: Profile is Master)
      const cleanFirst = learner.firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanLast = learner.lastName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const baseEmail = `${cleanFirst}.${cleanLast}`;
      let email = `${baseEmail}@deped.edu.ph`;

      // Check for email collision (excluding the current user)
      const emailCollision = await prisma.user.findFirst({ 
        where: { 
          email,
          id: { not: existingUser.id }
        } 
      });
      if (emailCollision) {
        email = `${baseEmail}.${learner.id}@deped.edu.ph`;
      }

      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          firstName: learner.firstName,
          lastName: learner.lastName,
          middleName: learner.middleName,
          sex: learner.sex,
          email: email,
          isActive: true,
        }
      });

      // Ensure the link is established if it wasn't
      if (learner.userId !== existingUser.id) {
        await prisma.learner.update({
          where: { id: learner.id },
          data: { userId: existingUser.id }
        });
      }
      
      updatedCount++;
    }
  }

  console.log(`✅ Backfill complete.`);
  console.log(`📊 Stats: ${createdCount} learner users provisioned, ${updatedCount} profiles synced.`);
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
