import { PrismaClient } from "../../../generated/prisma/index.js";
import { AppError } from "../../../lib/AppError.js";

export interface SectioningPreview {
  schoolYearLabel: string;
  gradeLevelName: string;
  steps: {
    title: string;
    description: string;
    stats: Record<string, any>;
  }[];
  proposedAssignments: {
    applicationId: number;
    sectionId: number;
    sectionName: string;
    learnerName: string;
    lrn: string | null;
    gender: string | null;
    genAve: number | null;
    readingProfile: string | null;
    programType: string;
  }[];
}

export class SectioningEngine {
  constructor(private prisma: PrismaClient) {}

  async getPrerequisites(gradeLevelId: number, schoolYearId: number) {
    const sections = await this.prisma.section.findMany({
      where: { 
        gradeLevelId,
        gradeLevel: { schoolYearId }
      },
    });

    const steSections = sections.filter(s => s.programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING");
    const regularSections = sections.filter(s => s.programType === "REGULAR");

    // HNHS Policy: Exactly 2 SCP (STE) sections
    const hasSteSections = steSections.length === 2;
    // HNHS Policy: At least 5 Pilot BEC sections (we assume first 5 REGULAR sections by sort order are Pilot)
    const hasPilotSections = regularSections.length >= 5;

    return {
      steSectionsCount: steSections.length,
      regularSectionsCount: regularSections.length,
      isSteReady: hasSteSections,
      isPilotReady: hasPilotSections,
      isReady: hasSteSections && hasPilotSections
    };
  }

  async runBatchSectioning(gradeLevelId: number, schoolYearId: number): Promise<SectioningPreview> {
    // 0. Fetch Metadata
    const [gradeLevel, schoolYear] = await Promise.all([
      this.prisma.gradeLevel.findUnique({ where: { id: gradeLevelId } }),
      this.prisma.schoolYear.findUnique({ where: { id: schoolYearId } })
    ]);

    if (!gradeLevel || !schoolYear) {
      throw new AppError(404, "Grade level or school year not found.");
    }

    const isGrade7 = gradeLevel.name.includes("7") || gradeLevel.displayOrder === 7;

    // 1. Fetch all eligible learners (VERIFIED status, no section yet)
    const applicants = await this.prisma.enrollmentApplication.findMany({
      where: {
        gradeLevelId,
        schoolYearId,
        status: "VERIFIED",
        enrollmentRecord: null
      },
      include: {
        learner: true,
        previousSchool: true,
        earlyRegistration: {
          include: {
            assessments: {
              where: { type: "QUALIFYING_EXAMINATION" },
              orderBy: { score: "desc" },
              take: 1
            }
          }
        }
      }
    });

    if (applicants.length === 0) {
      throw new AppError(400, "No eligible learners found for sectioning.");
    }

    // Check Gen Ave lock
    const missingGenAve = applicants.filter(a => !a.previousSchool?.generalAverage);
    if (missingGenAve.length > 0) {
      throw new AppError(400, `Cannot run batch sectioning. ${missingGenAve.length} learners are missing SF9 General Average.`);
    }

    // 2. Fetch sections and their current enrollment
    const sections = await this.prisma.section.findMany({
      where: { 
        gradeLevelId,
        gradeLevel: { schoolYearId }
      },
      include: {
        _count: {
          select: { enrollmentRecords: true }
        }
      },
      orderBy: { sortOrder: "asc" }
    });

    const steSections = sections.filter(s => s.programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING");
    const regularSections = sections.filter(s => s.programType === "REGULAR");
    const pilotSections = regularSections.slice(0, 5);
    const heteroSections = regularSections.slice(5);

    if (steSections.length < 2) {
      throw new AppError(400, "HNHS policy requires exactly 2 STE sections (STE-A and STE-B).");
    }

    const preview: SectioningPreview = {
      schoolYearLabel: schoolYear.yearLabel,
      gradeLevelName: gradeLevel.name,
      steps: [],
      proposedAssignments: []
    };

    // --- STEP 1: SCP Segregation (Top 70 STE or Vacancy Fill) ---
    const steApplicants = applicants.filter(a => a.applicantType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING");
    
    // Sort by Admission Exam Score
    const sortedSte = [...steApplicants].sort((a, b) => {
      const scoreA = a.earlyRegistration?.assessments[0]?.score ?? 0;
      const scoreB = b.earlyRegistration?.assessments[0]?.score ?? 0;
      return scoreB - scoreA;
    });

    let steToAssign: any[] = [];
    let steSpillover: any[] = [];
    let steCutoffScore: number | null = null;

    if (isGrade7) {
      // Full run for Grade 7
      steToAssign = sortedSte.slice(0, 70);
      steSpillover = sortedSte.slice(70);
      
      // Calculate cutoff score of 70th student
      if (sortedSte.length >= 70) {
        steCutoffScore = sortedSte[69].earlyRegistration?.assessments[0]?.score ?? null;
      } else if (sortedSte.length > 0) {
        steCutoffScore = sortedSte[sortedSte.length - 1].earlyRegistration?.assessments[0]?.score ?? null;
      }

      steToAssign.forEach((app, index) => {
        const targetSection = index < 35 ? steSections[0] : steSections[1];
        preview.proposedAssignments.push(this.mapToProposed(app, targetSection));
      });
    } else {
      // Vacancy Fill for Grade 8-10
      sortedSte.forEach(app => {
        const secA = steSections[0];
        const secB = steSections[1];
        const slotsA = secA.maxCapacity - secA._count.enrollmentRecords;
        const slotsB = secB.maxCapacity - secB._count.enrollmentRecords;

        if (slotsA > 0) {
          preview.proposedAssignments.push(this.mapToProposed(app, secA));
          secA._count.enrollmentRecords++;
          steToAssign.push(app);
        } else if (slotsB > 0) {
          preview.proposedAssignments.push(this.mapToProposed(app, secB));
          secB._count.enrollmentRecords++;
          steToAssign.push(app);
        } else {
          steSpillover.push(app);
        }
      });
    }

    preview.steps.push({
      title: "SCP Segregation (STE)",
      description: isGrade7 
        ? "Allocated top 70 STE applicants based on Early Registration assessment scores."
        : "Filled vacancies in STE sections with qualified applicants.",
      stats: {
        assigned: steToAssign.length,
        spillover: steSpillover.length,
        steCutoffScore,
        reclassifiedLearners: steSpillover.map(app => this.mapToProposed(app, { id: 0, name: "RECLASSIFIED" })),
        sections: steSections.slice(0, 2).map(s => s.name)
      }
    });

    // --- STEP 2: BEC Pilot Slicing (Top 200 REGULAR or Vacancy Fill) ---
    const regularPool = [
      ...applicants.filter(a => a.applicantType === "REGULAR"),
      ...steSpillover // Reclassified to REGULAR
    ];

    // Sort descending by Gen Ave
    const sortedRegular = regularPool.sort((a, b) => {
      const aveA = a.previousSchool?.generalAverage ?? 0;
      const aveB = b.previousSchool?.generalAverage ?? 0;
      return aveB - aveA;
    });

    let pilotToAssign: any[] = [];
    let remainingPool: any[] = [];
    let pilotCutoffAve: number | null = null;

    if (isGrade7) {
      if (pilotSections.length < 5) {
        throw new AppError(400, "At least 5 REGULAR sections are required for BEC Pilot slicing.");
      }
      pilotToAssign = sortedRegular.slice(0, 200);
      remainingPool = sortedRegular.slice(200);

      // Calculate cutoff average of 200th student
      if (sortedRegular.length >= 200) {
        pilotCutoffAve = sortedRegular[199].previousSchool?.generalAverage ?? null;
      } else if (sortedRegular.length > 0) {
        pilotCutoffAve = sortedRegular[sortedRegular.length - 1].previousSchool?.generalAverage ?? null;
      }

      pilotToAssign.forEach((app, index) => {
        const sectionIndex = Math.floor(index / 40);
        const targetSection = pilotSections[sectionIndex];
        preview.proposedAssignments.push(this.mapToProposed(app, targetSection));
      });
    } else {
      // Vacancy fill for Pilot
      sortedRegular.forEach(app => {
        const availablePilot = pilotSections.find(s => (s.maxCapacity - s._count.enrollmentRecords) > 0);
        if (availablePilot) {
          preview.proposedAssignments.push(this.mapToProposed(app, availablePilot));
          availablePilot._count.enrollmentRecords++;
          pilotToAssign.push(app);
        } else {
          remainingPool.push(app);
        }
      });
    }

    preview.steps.push({
      title: "BEC Pilot Slicing",
      description: isGrade7
        ? "Assigned top 200 regular applicants into 5 homogeneous BEC Pilot sections."
        : "Filled available vacancies in BEC Pilot sections based on academic merit.",
      stats: {
        assigned: pilotToAssign.length,
        pilotCutoffAve,
        reclassifiedLearners: remainingPool.map(app => this.mapToProposed(app, { id: 0, name: "RECLASSIFIED" })),
        sections: pilotSections.map(s => s.name)
      }
    });

    // --- STEP 3: Heterogeneous Snake Draft (Micro-Balancing) ---
    if (remainingPool.length > 0) {
      if (heteroSections.length === 0) {
        throw new AppError(400, "Insufficient heterogeneous sections for remaining pool.");
      }

      this.distributeEquitably(remainingPool, heteroSections, preview);

      const frustratedCount = remainingPool.filter(a => 
        a.readingProfileLevel === "FRUSTRATION" || a.readingProfileLevel === "NON_READER"
      ).length;

      preview.steps.push({
        title: "Heterogeneous Snake Draft",
        description: "Distributed remaining pool equitably using a zig-zag snake draft to balance gender parity and reading profiles.",
        stats: {
          assigned: remainingPool.length,
          frustratedCount,
          sections: heteroSections.map(s => s.name)
        }
      });
    }

    return preview;
  }

  private distributeEquitably(pool: any[], sections: any[], preview: SectioningPreview) {
    // HNHS Section III: Gender Parity & Reading Profile Balancing
    
    // 1. Group by Gender
    const males = pool.filter(a => a.learner.sex === "MALE");
    const females = pool.filter(a => a.learner.sex === "FEMALE");

    // 2. Sub-group by Reading Profile (Frustrated/Non-Reader vs others)
    const isFrustrated = (level: string | null) => level === "FRUSTRATION" || level === "NON_READER";
    
    const frustratedMales = males.filter(m => isFrustrated(m.readingProfileLevel));
    const standardMales = males.filter(m => !isFrustrated(m.readingProfileLevel));
    
    const frustratedFemales = females.filter(f => isFrustrated(f.readingProfileLevel));
    const standardFemales = females.filter(f => !isFrustrated(f.readingProfileLevel));

    // 3. Sort each sub-pool by General Average to maintain academic balance during the snake
    const sortFn = (a: any, b: any) => (b.previousSchool?.generalAverage || 0) - (a.previousSchool?.generalAverage || 0);
    [frustratedMales, frustratedFemales, standardMales, standardFemales].forEach(p => p.sort(sortFn));

    // 4. Unified Snake Draft
    // We process Frustrated first to ensure they are the most spread out, then standard.
    // Within each, we alternate gender to maintain parity.
    let sectionIndex = 0;
    let direction = 1;

    const assignBatch = (batch: any[]) => {
      batch.forEach(app => {
        const targetSection = sections[sectionIndex];
        preview.proposedAssignments.push(this.mapToProposed(app, targetSection));

        sectionIndex += direction;
        if (sectionIndex >= sections.length) {
          sectionIndex = sections.length - 1;
          direction = -1;
        } else if (sectionIndex < 0) {
          sectionIndex = 0;
          direction = 1;
        }
      });
    };

    // Alternate genders within the frustrated pool
    const frustratedCombined = [];
    const maxFrustrated = Math.max(frustratedMales.length, frustratedFemales.length);
    for (let i = 0; i < maxFrustrated; i++) {
      if (frustratedMales[i]) frustratedCombined.push(frustratedMales[i]);
      if (frustratedFemales[i]) frustratedCombined.push(frustratedFemales[i]);
    }
    assignBatch(frustratedCombined);

    // Alternate genders within the standard pool
    const standardCombined = [];
    const maxStandard = Math.max(standardMales.length, standardFemales.length);
    for (let i = 0; i < maxStandard; i++) {
      if (standardMales[i]) standardCombined.push(standardMales[i]);
      if (standardFemales[i]) standardCombined.push(standardFemales[i]);
    }
    assignBatch(standardCombined);
  }

  private mapToProposed(app: any, section: any) {
    return {
      applicationId: app.id,
      sectionId: section.id,
      sectionName: section.name,
      learnerName: `${app.learner.lastName}, ${app.learner.firstName}`,
      lrn: app.learner.lrn,
      gender: app.learner.sex,
      genAve: app.previousSchool?.generalAverage ?? null,
      readingProfile: app.readingProfileLevel,
      programType: app.applicantType
    };
  }

  private distributeViaSnakeDraft(pool: any[], sections: any[], preview: SectioningPreview) {
    // Note: Replaced by distributeEquitably for micro-balancing
  }
}
