import { PrismaClient } from './src/generated/prisma';
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe('UPDATE school_years SET early_reg_open_date = NULL, early_reg_close_date = NULL');
}
main().finally(() => prisma.$disconnect());
