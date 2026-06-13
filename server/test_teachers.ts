import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const t = await prisma.teacher.findMany({
    where: {
      isActive: true,
      designation: { equals: 'CLASS ADVISER', mode: 'insensitive' },
      advisoryHistory: {
        none: {
          schoolYearId: 1,
          status: 'ACTIVE',
        }
      }
    }
  });
  console.log("No exclude:", t.length);

  const t2 = await prisma.teacher.findMany({
    where: {
      isActive: true,
      designation: { equals: 'CLASS ADVISER', mode: 'insensitive' },
      advisoryHistory: {
        none: {
          schoolYearId: 1,
          status: 'ACTIVE',
          NOT: { sectionId: 3 }
        }
      }
    }
  });
  console.log("With exclude section 3:", t2.length);
}
main().catch(console.error).finally(() => prisma.$disconnect());
