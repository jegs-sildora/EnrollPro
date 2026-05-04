import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting users wipe...");

  await prisma.$transaction([
    // 1. Audit logs reference users (Nullable, but better clear if wiping all users)
    prisma.auditLog.deleteMany({}),

    // 2. Enrollment records have a mandatory enrolledById
    prisma.enrollmentRecord.deleteMany({}),

    // 3. Clear other nullable user references
    prisma.enrollmentApplication.updateMany({
        data: { 
            encodedById: null,
            profileLockedById: null,
            readingProfileAssessedById: null
        }
    }),
    prisma.earlyRegistrationApplication.updateMany({
        data: { 
            encodedById: null,
            verifiedById: null
        }
    }),
    prisma.applicationChecklist.updateMany({
        data: { updatedById: null }
    }),
    prisma.schoolYear.updateMany({
        data: { bosyLockedById: null }
    }),

    // 4. Finally delete users (Accounts have CASCADE)
    prisma.user.deleteMany({})
  ]);

  console.log("✅ Wiped all users and cleared their operational audit trails.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
