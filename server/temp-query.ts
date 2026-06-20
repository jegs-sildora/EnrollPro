import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.enrollmentApplication.groupBy({
  by: ['schoolYearId', 'status'],
  _count: true
}).then(r => {
  console.log(r);
  return prisma.$disconnect();
}).catch(e => {
  console.error(e);
  return prisma.$disconnect();
});
