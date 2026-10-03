import { PrismaClient } from './src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log("Updating early registrants...");
  const result = await prisma.enrollmentApplication.updateMany({
    where: { status: "EARLY_REGISTRATION" },
    data: { isEarlyRegistrant: true }
  });
  console.log(`Updated ${result.count} records`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
