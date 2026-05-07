import { prisma } from "../../lib/prisma.js";
import { Ecosystem, SyncStatus } from "../../generated/prisma/index.js";

/**
 * Queue a sync job for a specific learner or teacher
 */
export async function queueEcosystemSync(id: number, type: 'LEARNER' | 'TEACHER') {
  const ecosystems: Ecosystem[] = [Ecosystem.ATLAS, Ecosystem.SMART, Ecosystem.AIMS];
  
  for (const ecosystem of ecosystems) {
    // Skip ATLAS for Learners
    if (type === "LEARNER" && ecosystem === Ecosystem.ATLAS) continue;

    const syncData = {
      status: SyncStatus.PENDING,
      ecosystem
    };

    if (type === "LEARNER") {
      await prisma.ecosystemSyncStatus.upsert({
        where: { learnerId_ecosystem: { learnerId: id, ecosystem } },
        update: {}, // Don't reset if already exists, or maybe we should?
        create: { ...syncData, learnerId: id }
      });
    } else if (type === "TEACHER") {
      await prisma.ecosystemSyncStatus.upsert({
        where: { teacherId_ecosystem: { teacherId: id, ecosystem } },
        update: {},
        create: { ...syncData, teacherId: id }
      });
    }
  }
}

/**
 * Queue sync for all learners in a section
 */
export async function queueSectionSync(sectionId: number) {
  const records = await prisma.enrollmentRecord.findMany({
    where: { sectionId },
    include: {
      enrollmentApplication: {
        select: { learnerId: true }
      }
    }
  });

  for (const record of records) {
    await queueEcosystemSync(record.enrollmentApplication.learnerId, 'LEARNER');
  }
}

/**
 * Queue sync for all learners in a school year
 */
export async function queueSchoolYearSync(schoolYearId: number) {
  const records = await prisma.enrollmentRecord.findMany({
    where: { schoolYearId },
    include: {
      enrollmentApplication: {
        select: { learnerId: true }
      }
    }
  });

  for (const record of records) {
    await queueEcosystemSync(record.enrollmentApplication.learnerId, 'LEARNER');
  }
}
