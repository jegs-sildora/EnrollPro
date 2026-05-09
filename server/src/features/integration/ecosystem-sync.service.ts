import { prisma } from "../../lib/prisma.js";
import { Ecosystem, SyncStatus, ApplicationStatus } from "../../generated/prisma/index.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Queue a sync job for a specific learner or teacher
 */
export async function queueEcosystemSync(id: number, type: 'LEARNER' | 'TEACHER', immediate = false) {
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
        update: { status: SyncStatus.PENDING }, // Reset to pending if re-queued
        create: { ...syncData, learnerId: id }
      });
    } else if (type === "TEACHER") {
      await prisma.ecosystemSyncStatus.upsert({
        where: { teacherId_ecosystem: { teacherId: id, ecosystem } },
        update: { status: SyncStatus.PENDING },
        create: { ...syncData, teacherId: id }
      });
    }
  }

  if (immediate) {
    // Process 1.1: Event-Driven Delta Sync (Automated)
    // Fire and forget background sync for this specific entity
    processImmediateSync(id, type).catch(err => {
      console.error(`[Delta Sync Error] ${type} ${id}:`, err);
    });
  }
}

/**
 * Internal helper for immediate delta sync processing
 */
async function processImmediateSync(id: number, type: 'LEARNER' | 'TEACHER') {
  const ecosystems: Ecosystem[] = [Ecosystem.ATLAS, Ecosystem.SMART, Ecosystem.AIMS];
  
  // Load authoritative data
  const record = type === "LEARNER" 
    ? await prisma.learner.findUnique({
        where: { id },
        include: {
          enrollmentApplications: {
            where: { status: { in: [ApplicationStatus.ENROLLED, ApplicationStatus.OFFICIALLY_ENROLLED] } },
            include: {
              gradeLevel: true,
              enrollmentRecord: { include: { section: true } }
            },
            take: 1
          }
        }
      })
    : await prisma.teacher.findUnique({
        where: { id },
        include: { teacherDesignations: { orderBy: { createdAt: "desc" }, take: 1 } }
      });

  if (!record) return;

  for (const ecosystem of ecosystems) {
    if (type === "LEARNER" && ecosystem === Ecosystem.ATLAS) continue;

    try {
      // Simulate mesh network delay
      await new Promise(resolve => setTimeout(resolve, 200));

      const syncData = {
        status: SyncStatus.SYNCED,
        lastSyncedAt: new Date(),
        externalId: `FED-${ecosystem}-${uuidv4().substring(0, 8)}`
      };

      if (type === "LEARNER") {
        await prisma.ecosystemSyncStatus.update({
          where: { learnerId_ecosystem: { learnerId: id, ecosystem } },
          data: syncData
        });
      } else {
        await prisma.ecosystemSyncStatus.update({
          where: { teacherId_ecosystem: { teacherId: id, ecosystem } },
          data: syncData
        });
      }
      
      console.log(`[Delta Sync Success] ${type} ${id} -> ${ecosystem}`);
    } catch (error: any) {
      const failData = {
        status: SyncStatus.FAILED,
        errorMessage: error.message,
        lastSyncedAt: new Date()
      };

      if (type === "LEARNER") {
        await prisma.ecosystemSyncStatus.update({
          where: { learnerId_ecosystem: { learnerId: id, ecosystem } },
          data: failData
        });
      } else {
        await prisma.ecosystemSyncStatus.update({
          where: { teacherId_ecosystem: { teacherId: id, ecosystem } },
          data: failData
        });
      }
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
