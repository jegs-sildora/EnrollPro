import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
  const search = "CARLO S RAMOS";
  const terms = String(search).replace(/[,.]/g, ' ').split(/\s+/).filter(Boolean);
  const learnerWhere: any = { AND: terms.map(term => ({
    OR: [
      { lrn: { contains: term, mode: "insensitive" } },
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
      { middleName: { contains: term, mode: "insensitive" } },
    ]
  })) };
  
  const res = await prisma.learner.findMany({ where: learnerWhere });
  console.log('CARLO S RAMOS found:', res.length);
  
  const search2 = "RAMOS, CARLO S";
  const terms2 = String(search2).replace(/[,.]/g, ' ').split(/\s+/).filter(Boolean);
  const learnerWhere2: any = { AND: terms2.map(term => ({
    OR: [
      { lrn: { contains: term, mode: "insensitive" } },
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
      { middleName: { contains: term, mode: "insensitive" } },
    ]
  })) };
  
  const res2 = await prisma.learner.findMany({ where: learnerWhere2 });
  console.log('RAMOS, CARLO S found:', res2.length);
}
main().finally(() => prisma.$disconnect());
