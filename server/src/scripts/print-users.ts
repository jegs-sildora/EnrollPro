import { prisma } from "../lib/prisma.js";

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      accountName: true,
      employeeId: true,
      roles: true,
      isActive: true,
      mustChangePassword: true,
    }
  });
  console.log("Users in DB:", JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
