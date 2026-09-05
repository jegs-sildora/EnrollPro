import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 Wiping Custom School Head...");

  const employeeId = "1234505";
  
  const existingUser = await prisma.user.findFirst({
    where: { employeeId }
  });

  if (!existingUser) {
    console.log(`⚠️ User with employee ID ${employeeId} does not exist. Nothing to wipe.`);
    return;
  }

  await prisma.user.delete({
    where: { id: existingUser.id }
  });

  console.log(`✅ Successfully wiped School Head (${employeeId})`);
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
