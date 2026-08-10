import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";

async function main() {
  const password = await bcrypt.hash("DepEdSY2026!", 12);
  const updated = await prisma.user.updateMany({
    where: { employeeId: "1234501" },
    data: {
      password,
      mustChangePassword: false,
      isActive: true
    }
  });
  console.log("Updated Jose Rizal user count:", updated.count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
