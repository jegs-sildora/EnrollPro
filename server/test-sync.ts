import { PrismaClient } from './src/generated/prisma/index.js';
import { matchesStoredSmartOutcome } from './src/features/integration/smart-outcome-envelope.js';
const prisma = new PrismaClient();

async function run() {
  const r = await prisma.enrollmentRecord.findFirst({
    where: {learner: {lrn: '100000000018'}}, 
    include: {enrollmentApplication: true}
  });
  if (r) {
    console.log(matchesStoredSmartOutcome({
      value: r.enrollmentApplication.reportedGrades, 
      schoolYearId: r.schoolYearId, 
      sectionId: r.sectionId, 
      finalAverage: Number(r.finalAverage), 
      eosyStatus: r.eosyStatus
    }));
  }
}
run().finally(() => prisma.$disconnect());
