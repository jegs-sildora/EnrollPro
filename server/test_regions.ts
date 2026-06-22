import { PrismaClient } from "./src/generated/prisma/index.js";

const prisma = new PrismaClient();
async function main() {
  const prov = await prisma.province.findFirst({ where: { code: '1804500000' } });
  console.log('Province:', prov);
  const city = await prisma.cityMunicipality.findFirst({ where: { name: { contains: 'Hinigaran' } } });
  console.log('City:', city);
}
main().finally(() => prisma.$disconnect());
