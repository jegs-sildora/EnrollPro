import { PrismaClient } from "./src/generated/prisma/index.js";

const prisma = new PrismaClient();
async function main() {
  const region = await prisma.region.findFirst({ where: { code: '1800000000' } });
  console.log('Region 18:', region);
}
main().finally(() => prisma.$disconnect());
