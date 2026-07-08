import { prisma } from "./src/lib/prisma.js";

async function main() {
  const sy = await prisma.schoolYear.findFirst({ where: { status: "ACTIVE" } });
  console.log("Current SY:", sy);
}

main().catch(console.error).finally(() => prisma.$disconnect());
