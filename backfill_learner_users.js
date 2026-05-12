import { PrismaClient } from "./server/src/generated/prisma/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function backfillLearnerUsers() {
  console.log("Starting backfill for Learner User accounts...");

  const learners = await prisma.learner.findMany({
    where: { userId: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      lrn: true,
      sex: true,
      createdAt: true,
    },
  });

  console.log(`Found ${learners.length} learners without user accounts.`);

  const defaultPasswordHash = await bcrypt.hash("DepEd2026!", 12);
  let createdCount = 0;

  for (const learner of learners) {
    try {
      const accountName = learner.lrn ? `LRN-${learner.lrn}` : `LEARNER-${learner.id}`;

      // Check if account name is already taken
      const existingUser = await prisma.user.findUnique({
        where: { accountName },
      });

      if (existingUser) {
        console.log(`User already exists for ${accountName}, linking...`);
        await prisma.learner.update({
          where: { id: learner.id },
          data: { userId: existingUser.id },
        });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            firstName: learner.firstName,
            lastName: learner.lastName,
            accountName,
            password: defaultPasswordHash,
            role: "LEARNER",
            mustChangePassword: false,
            sex: learner.sex,
            isActive: true,
            createdAt: learner.createdAt,
          },
        });

        await tx.learner.update({
          where: { id: learner.id },
          data: { userId: newUser.id },
        });
      });

      createdCount++;
      if (createdCount % 50 === 0) {
        console.log(`Processed ${createdCount} accounts...`);
      }
    } catch (err) {
      console.error(`Failed to process learner ID ${learner.id}:`, err);
    }
  }

  console.log(`Backfill complete. Created ${createdCount} user accounts.`);
}

backfillLearnerUsers()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
