const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const teachers = await prisma.teacher.findMany();
  console.log('teachers count:', teachers.length);
}
main().catch(console.error).finally(() => prisma.$disconnect());
