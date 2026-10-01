import { prisma } from "../../../lib/prisma.js";

type TransactionClient = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export async function executeAutoSectioningBatch(
  tx: TransactionClient,
  schoolYearId: number,
  userId: number
): Promise<void> {
  const setting = await tx.schoolSetting.findFirstOrThrow();
  const enableHomogeneousSections = setting.enableHomogeneousSections;
  const homogeneousSectionCount = setting.homogeneousSectionCount ?? 5;

  const applications = await tx.enrollmentApplication.findMany({
    where: {
      schoolYearId,
      status: "PENDING_CONFIRMATION",
      gradeLevelId: {
        in: [1, 2, 3, 4], // Include Grade 7 for retained learners and new enrollees
      },
      enrollmentRecord: null,
    },
    include: {
      learner: true,
      previousSchool: true,
    },
  });

  const sections = await tx.section.findMany({
    where: {
      schoolYearId,
      gradeLevelId: {
        in: [1, 2, 3, 4],
      },
    },
    include: {
      enrollmentRecords: true,
    },
  });

  const gradeLevels = [1, 2, 3, 4];
  const commitDate = new Date();

  for (const gradeLevelId of gradeLevels) {
    const gradeLearners = applications.filter(a => a.gradeLevelId === gradeLevelId);
    const gradeSections = sections.filter(s => s.gradeLevelId === gradeLevelId);

    if (gradeLearners.length === 0 || gradeSections.length === 0) continue;

    const programTypes = Array.from(new Set(gradeLearners.map(l => l.assignedProgram || l.applicantType)));

    for (const programType of programTypes) {
      const rawProgramLearners = gradeLearners.filter(l => (l.assignedProgram || l.applicantType) === programType);
      const programSections = gradeSections.filter(s => s.programType === programType);

      if (rawProgramLearners.length === 0 || programSections.length === 0) continue;

      const sortedLearners = [...rawProgramLearners].sort((a, b) => {
        let aAve = a.previousSchool?.generalAverage ?? -1;
        if (aAve === -1 && a.reportedGrades && typeof a.reportedGrades === 'object' && 'finalGeneralAverage' in a.reportedGrades) {
          aAve = (a.reportedGrades as any).finalGeneralAverage ?? -1;
        }

        let bAve = b.previousSchool?.generalAverage ?? -1;
        if (bAve === -1 && b.reportedGrades && typeof b.reportedGrades === 'object' && 'finalGeneralAverage' in b.reportedGrades) {
          bAve = (b.reportedGrades as any).finalGeneralAverage ?? -1;
        }

        if (aAve !== bAve) return bAve - aAve;
        
        const nameA = `${a.learner.lastName}, ${a.learner.firstName}`;
        const nameB = `${b.learner.lastName}, ${b.learner.firstName}`;
        return nameA.localeCompare(nameB);
      });

      const orderedSections = [...programSections].sort((first, second) => 
        first.sortOrder - second.sortOrder ||
        first.name.localeCompare(second.name) ||
        first.id - second.id
      );

      let remainingLearners = [...sortedLearners];
      let topSections: typeof orderedSections = [];
      let regularSections = orderedSections;

      if (programType === "REGULAR" && enableHomogeneousSections) {
        topSections = orderedSections.filter(s => s.isHomogeneous).slice(0, homogeneousSectionCount);
        const topSectionIds = new Set(topSections.map(s => s.id));
        regularSections = orderedSections.filter(s => !topSectionIds.has(s.id));
      }

      const rostersBySectionId = new Map<number, typeof sortedLearners>();

      if (topSections.length > 0) {
        const totalSections = topSections.length + regularSections.length;
        const targetPerSection = Math.ceil(remainingLearners.length / totalSections);
        const maxAvailableTopCapacity = topSections.reduce((acc, sec) => acc + Math.max(0, sec.maxCapacity - sec.enrollmentRecords.length), 0);
        const balancedTopCapacity = targetPerSection * topSections.length;
        const totalTopCapacity = Math.min(balancedTopCapacity, maxAvailableTopCapacity);

        const eligibleForTop = remainingLearners.filter(l => l.academicStatus !== "CONDITIONALLY_PROMOTED");
        const topLearners = eligibleForTop.slice(0, totalTopCapacity);

        const topRemainingCapacity = new Map(topSections.map(s => [s.id, Math.max(0, s.maxCapacity - s.enrollmentRecords.length)]));
        const topMales = topLearners.filter(l => l.learner.sex === "MALE");
        const topFemales = topLearners.filter(l => l.learner.sex === "FEMALE");

        snakeDraftLearners(topSections, topMales, topFemales, rostersBySectionId, topRemainingCapacity);

        const assignedIds = new Set(topLearners.map(l => l.id));
        remainingLearners = remainingLearners.filter(l => !assignedIds.has(l.id));
      }

      if (remainingLearners.length > 0 && regularSections.length > 0) {
        const remainingCapacity = new Map(regularSections.map(s => [s.id, Math.max(0, s.maxCapacity - s.enrollmentRecords.length)]));
        const males = remainingLearners.filter(l => l.learner.sex === "MALE");
        const females = remainingLearners.filter(l => l.learner.sex === "FEMALE");
        
        snakeDraftLearners(regularSections, males, females, rostersBySectionId, remainingCapacity);
      }

      // Perform commits
      for (const [sectionId, learners] of Array.from(rostersBySectionId.entries())) {
        for (const learner of learners) {
          await tx.enrollmentRecord.create({
            data: {
              enrollmentApplicationId: learner.id,
              sectionId: sectionId,
              learnerId: learner.learnerId,
              schoolYearId: schoolYearId,
              enrolledById: userId,
              dateSectioned: commitDate,
              enrolledAt: commitDate,
              isLateEnrollee: false,
              sectioningMethod: "BATCH_ALGORITHM",
            }
          });
        }
      }
    }
  }
}

function snakeDraftLearners<T extends { learner: { sex: string } }>(
  sections: { id: number }[],
  males: T[],
  females: T[],
  rostersBySectionId: Map<number, T[]>,
  remainingCapacity: Map<number, number>
) {
  let sectionIndex = 0;
  let forward = true;

  const getNextValidSection = () => {
    const totalRemaining = Array.from(remainingCapacity.values()).reduce((sum, c) => sum + c, 0);
    if (totalRemaining <= 0) return null;
    
    const startState = { idx: sectionIndex, fwd: forward };
    let looped = false;
    
    while (true) {
      const current = sectionIndex;
      const section = sections[current];
      
      if (forward) {
        if (sectionIndex >= sections.length - 1) forward = false;
        else sectionIndex++;
      } else {
        if (sectionIndex <= 0) forward = true;
        else sectionIndex--;
      }

      if (remainingCapacity.get(section.id)! > 0) return section;
      
      if (sectionIndex === startState.idx && forward === startState.fwd) {
        if (looped) return null;
        looped = true;
      }
    }
  };

  for (const learner of males) {
    const targetSection = getNextValidSection();
    if (targetSection) {
      if (!rostersBySectionId.has(targetSection.id)) {
        rostersBySectionId.set(targetSection.id, []);
      }
      rostersBySectionId.get(targetSection.id)!.push(learner);
      remainingCapacity.set(targetSection.id, remainingCapacity.get(targetSection.id)! - 1);
    }
  }

  sectionIndex = 0;
  forward = true;

  for (const learner of females) {
    const targetSection = getNextValidSection();
    if (targetSection) {
      if (!rostersBySectionId.has(targetSection.id)) {
        rostersBySectionId.set(targetSection.id, []);
      }
      rostersBySectionId.get(targetSection.id)!.push(learner);
      remainingCapacity.set(targetSection.id, remainingCapacity.get(targetSection.id)! - 1);
    }
  }
}
