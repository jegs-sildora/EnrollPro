import {
  PrismaClient,
  ApplicantType,
  Sex,
  ReadingProfileLevel,
} from "../../../generated/prisma/index.js";
import { AppError } from "../../../lib/AppError.js";
import type { SectioningParams } from "@enrollpro/shared";
import { DEFAULT_SECTIONING_PARAMS } from "@enrollpro/shared";

export interface SectioningPreview {
  schoolYearLabel: string;
  gradeLevelName: string;
  params: SectioningParams;
  steps: {
    title: string;
    description: string;
    stats: Record<string, unknown>;
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
    status: string;
    rankingScore?: number | null;
    rank?: number | null;
  }[];
}

interface SectionWithCount {
  id: number;
  name: string;
  programType: ApplicantType;
  maxCapacity: number;
  _count: {
    enrollmentRecords: number;
  };
}

interface ApplicantWithRelations {
  id: number;
  status: string;
  applicantType: ApplicantType;
  readingProfileLevel: ReadingProfileLevel | null;
  learner: {
    firstName: string;
    lastName: string;
    lrn: string | null;
    sex: Sex;
    promotionStatus?: string | null;
    previousGenAve?: number | null;
    enrollmentRecords: { finalAverage: number | null }[];
  };
  gradeLevel: {
    name: string;
    displayOrder: number | null;
  };
  previousSchool?: {
    generalAverage: number | null;
  } | null;
  
}

export class SectioningEngine {
  constructor(private prisma: PrismaClient) {}

  // Helper to compute weighted score for Grade 7 STE
  private getWeightedScpScore(app: ApplicantWithRelations): number {
    const assessments: any[] = [];

    // Qualifying Exam (65%)
    const examScore =
      assessments.find((a) => a.type === "QUALIFYING_EXAMINATION")?.score ?? 0;

    // Interview (15%)
    const interviewScore =
      assessments.find((a) => a.type === "INTERVIEW")?.score ?? 0;

    // Grade Average (20%)
    const gradeAve = app.previousSchool?.generalAverage ?? 0;

    const composite = examScore * 0.65 + interviewScore * 0.15 + gradeAve * 0.2;
    return Math.round(composite * 1000) / 1000;
  }

  // ── Gen Ave Resolver ─────────────────────────────────────────────────────────
  // Resolves the best available general average for an applicant.
  // G7: SF10 previousSchool data (entered during early registration)
  // G8-10: Learner.previousGenAve (from SMART sync) → prior EnrollmentRecord.finalAverage → previousSchool fallback
  private resolveGenAve(
    app: ApplicantWithRelations,
    isGrade7: boolean,
  ): number | null {
    if (isGrade7) {
      return (
        app.previousSchool?.generalAverage ?? app.learner.previousGenAve ?? null
      );
    }
    return (
      app.learner.previousGenAve ??
      app.learner.enrollmentRecords[0]?.finalAverage ??
      app.previousSchool?.generalAverage ??
      null
    );
  }

  // ── Naming Engine ────────────────────────────────────────────────────────────
  // Converts an array index to an alphabetic suffix: 0→A, 1→B, 2→C …
  private getScpSectionName(prefix: string, index: number): string {
    const suffix = String.fromCharCode(65 + index);
    return `${prefix}-${suffix}`;
  }

  // ── Distribution Math ────────────────────────────────────────────────────────
  // Distributes quota evenly across sections using floor + remainder:
  // 100 ÷ 3 → [34, 33, 33]  |  70 ÷ 2 → [35, 35]
  private distributeQuotaToSections(
    quota: number,
    sectionCount: number,
  ): number[] {
    if (sectionCount <= 0) return [];
    const base = Math.floor(quota / sectionCount);
    const remainder = quota % sectionCount;
    return Array.from(
      { length: sectionCount },
      (_, i) => base + (i < remainder ? 1 : 0),
    );
  }

  // ── Auto-Create SCP Sections ─────────────────────────────────────────────────
  // Upserts STE sections (STE-A, STE-B, …) for a grade level.
  // maxCapacity for each section is calculated via floor+remainder distribution.
  // Returns all matching sections ordered by sortOrder.
  private async ensureScpSections(
    gradeLevelId: number,
    schoolYearId: number,
    quota: number,
    sectionCount: number,
  ): Promise<SectionWithCount[]> {
    const PREFIX = "STE";
    const capacities = this.distributeQuotaToSections(quota, sectionCount);
    const targetNames: string[] = [];

    for (let i = 0; i < sectionCount; i++) {
      const name = this.getScpSectionName(PREFIX, i);
      targetNames.push(name);
      await this.prisma.section.upsert({
        where: {
          uq_sections_name_grade_sy: { name, gradeLevelId, schoolYearId },
        },
        create: {
          name,
          programType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
          gradeLevelId,
          schoolYearId,
          maxCapacity: capacities[i],
          sortOrder: i + 1,
        },
        update: { maxCapacity: capacities[i] },
      });
    }

    return this.prisma.section.findMany({
      where: { gradeLevelId, schoolYearId, name: { in: targetNames } },
      include: { _count: { select: { enrollmentRecords: true } } },
      orderBy: { sortOrder: "asc" },
    });
  }

  async getPrerequisites(gradeLevelId: number, schoolYearId: number) {
    const [sections, schoolYear, unassignedCount] = await Promise.all([
      this.prisma.section.findMany({
        where: {
          gradeLevelId,
          schoolYearId,
        },
      }),
      this.prisma.schoolYear.findUnique({ where: { id: schoolYearId } }),
      this.prisma.enrollmentApplication.count({
        where: {
          gradeLevelId,
          schoolYearId,
          status: "VERIFIED",
          enrollmentRecord: null,
        },
      }),
    ]);

    const config: SectioningParams =
      (schoolYear?.sectioningConfig as SectioningParams | null) ??
      DEFAULT_SECTIONING_PARAMS;

    const steSections = sections.filter(
      (s) => s.programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
    );
    const regularSections = sections.filter((s) => s.programType === "REGULAR");

    const isSteReady = steSections.length >= config.steSections;
    const isPilotReady = regularSections.length >= config.pilotSectionCount;

    return {
      steSectionsCount: steSections.length,
      regularSectionsCount: regularSections.length,
      isSteReady,
      isPilotReady,
      isReady: isSteReady && isPilotReady,
      unassignedCount,
      config,
    };
  }

  async runBatchSectioning(
    gradeLevelId: number,
    schoolYearId: number,
    params: SectioningParams = DEFAULT_SECTIONING_PARAMS,
  ): Promise<SectioningPreview> {
    // 0. Fetch Metadata
    const [gradeLevel, schoolYear] = await Promise.all([
      this.prisma.gradeLevel.findUnique({ where: { id: gradeLevelId } }),
      this.prisma.schoolYear.findUnique({ where: { id: schoolYearId } }),
    ]);

    if (!gradeLevel || !schoolYear) {
      throw new AppError(404, "Grade level or school year not found.");
    }

    const isGrade7 =
      gradeLevel.name.includes("7") || gradeLevel.displayOrder === 7;

    // 1. Fetch all eligible learners (READY_FOR_SECTIONING only, no section yet)
    const applicants: ApplicantWithRelations[] =
      await (this.prisma.enrollmentApplication.findMany({
        where: {
          gradeLevelId,
          schoolYearId,
          status: "VERIFIED",
          enrollmentRecord: null,
        },
        include: {
          learner: {
            include: {
              enrollmentRecords: {
                where: { schoolYearId: { lt: schoolYearId } },
                orderBy: { schoolYearId: "desc" },
                take: 1,
                select: { finalAverage: true },
              },
            },
          },
          gradeLevel: true,
          previousSchool: true,
          
        },
      }) as any); // Type assertion needed for complex include

    if (applicants.length === 0) {
      throw new AppError(400, "No eligible learners found for sectioning.");
    }

    // Check Gen Ave lock - check BOTH previousSchool and learner profile
    const missingGenAve = applicants.filter((a) => {
      const ave = this.resolveGenAve(a, isGrade7);
      return ave === null || ave === undefined || ave === 0;
    });

    if (missingGenAve.length > 0) {
      throw new AppError(
        400,
        `Cannot run batch sectioning. ${missingGenAve.length} learners are missing General Average data.`,
      );
    }

    // 2. Fetch sections and their current enrollment
    const sections: SectionWithCount[] = await this.prisma.section.findMany({
      where: {
        gradeLevelId,
        schoolYearId,
      },
      include: {
        _count: {
          select: { enrollmentRecords: true },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    let steSections = sections.filter(
      (s) => s.programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
    );
    const regularSections = sections.filter((s) => s.programType === "REGULAR");
    const pilotSections = regularSections.slice(0, params.pilotSectionCount);
    const heteroSections = regularSections.slice(params.pilotSectionCount);

    // For Grade 7: auto-create any missing STE sections using the naming engine.
    if (isGrade7 && steSections.length < params.steSections) {
      steSections = await this.ensureScpSections(
        gradeLevelId,
        schoolYearId,
        params.steQuota,
        params.steSections,
      );
    }

    if (steSections.length < params.steSections) {
      throw new AppError(
        400,
        `Config requires ${params.steSections} STE section(s), but only ${steSections.length} found.`,
      );
    }

    const preview: SectioningPreview = {
      schoolYearLabel: schoolYear.yearLabel,
      gradeLevelName: gradeLevel.name,
      params,
      steps: [],
      proposedAssignments: [],
    };

    // --- PRE-PROCESSING: Filter out RETAINED learners ---
    const eligibleApplicants = applicants.filter(
      (a) => a.learner.promotionStatus !== "RETAINED",
    );

    // --- STEP 1: SCP Segregation (Top 70 STE or Vacancy Fill) ---
    const steApplicants = eligibleApplicants.filter(
      (a) => a.applicantType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
    );

    // Sort by Admission Exam Score (Grade 7) or Previous Gen Ave (Grade 8-10)
    const sortedSte = [...steApplicants].sort((a, b) => {
      if (isGrade7) {
        return this.getWeightedScpScore(b) - this.getWeightedScpScore(a);
      } else {
        const aveA = this.resolveGenAve(a, false) ?? 0;
        const aveB = this.resolveGenAve(b, false) ?? 0;
        return aveB - aveA;
      }
    });

    let steToAssign: ApplicantWithRelations[] = [];
    let steSpillover: ApplicantWithRelations[] = [];
    let steCutoffScore: number | null = null;

    if (isGrade7) {
      const actualSteCount = Math.min(sortedSte.length, params.steQuota);
      steToAssign = sortedSte.slice(0, actualSteCount);
      steSpillover = sortedSte.slice(actualSteCount);

      if (sortedSte.length >= params.steQuota) {
        steCutoffScore = this.getWeightedScpScore(
          sortedSte[params.steQuota - 1],
        );
      } else if (sortedSte.length > 0) {
        steCutoffScore = this.getWeightedScpScore(
          sortedSte[sortedSte.length - 1],
        );
      }

      const perSectionCounts = this.distributeQuotaToSections(
        steToAssign.length,
        params.steSections,
      );
      let steOffset = 0;
      perSectionCounts.forEach((count, sectionIndex) => {
        const targetSection = steSections[sectionIndex];
        steToAssign
          .slice(steOffset, steOffset + count)
          .forEach((app, idxInSegment) => {
            const absoluteIdx = steOffset + idxInSegment;
            preview.proposedAssignments.push(
              this.mapToProposed(app, targetSection, isGrade7, {
                rankingScore: this.getWeightedScpScore(app),
                rank: absoluteIdx + 1,
              }),
            );
          });
        steOffset += count;
      });
    } else {
      sortedSte.forEach((app, idx) => {
        const availableSection = steSections.find(
          (s) => s.maxCapacity - s._count.enrollmentRecords > 0,
        );
        if (availableSection) {
          preview.proposedAssignments.push(
            this.mapToProposed(app, availableSection, isGrade7, {
              rankingScore: this.resolveGenAve(app, false) ?? null,
              rank: idx + 1,
            }),
          );
          availableSection._count.enrollmentRecords++;
          steToAssign.push(app);
        } else {
          steSpillover.push(app);
        }
      });
    }

    preview.steps.push({
      title: "SCP Segregation (STE)",
      description: isGrade7
        ? sortedSte.length < params.steQuota
          ? `Target quota was ${params.steQuota}, but only ${sortedSte.length} eligible applicants found. Proceeded with ${steToAssign.length}.`
          : `Allocated top ${params.steQuota} STE applicants across ${params.steSections} STE section(s) based on weighted ranking (Exam 65%, Interview 15%, Grades 20%).`
        : "Filled vacancies in STE sections with qualified applicants.",
      stats: {
        assigned: steToAssign.length,
        spillover: steSpillover.length,
        steCutoffScore,
        reclassifiedLearners: steSpillover.map((app, idx) =>
          this.mapToProposed(
            app,
            { id: 0, name: "RECLASSIFIED" } as SectionWithCount,
            isGrade7,
            {
              rankingScore: isGrade7
                ? this.getWeightedScpScore(app)
                : (this.resolveGenAve(app, false) ?? null),
              rank: steToAssign.length + idx + 1,
            },
          ),
        ),
        sections: steSections.map((s) => s.name),
      },
    });

    // --- STEP 2: BEC Pilot Slicing ---
    const regularPool = [
      ...eligibleApplicants.filter((a) => a.applicantType === "REGULAR"),
      ...steSpillover,
    ];

    const sortedRegular = regularPool.sort((a, b) => {
      const aveA = this.resolveGenAve(a, isGrade7) ?? 0;
      const aveB = this.resolveGenAve(b, isGrade7) ?? 0;
      return aveB - aveA;
    });

    let pilotToAssign: ApplicantWithRelations[] = [];
    let remainingPool: ApplicantWithRelations[] = [];
    let pilotCutoffAve: number | null = null;

    if (isGrade7) {
      if (pilotSections.length < params.pilotSectionCount) {
        throw new AppError(
          400,
          `Config requires ${params.pilotSectionCount} BEC Pilot section(s), but only ${pilotSections.length} found.`,
        );
      }
      const pilotPoolLimit = params.pilotSectionCount * params.sectionCapacity;
      pilotToAssign = sortedRegular.slice(0, pilotPoolLimit);
      remainingPool = sortedRegular.slice(pilotPoolLimit);

      if (sortedRegular.length >= pilotPoolLimit) {
        pilotCutoffAve =
          pilotToAssign[pilotToAssign.length - 1].previousSchool
            ?.generalAverage ?? null;
      } else if (sortedRegular.length > 0) {
        pilotCutoffAve =
          sortedRegular[sortedRegular.length - 1].previousSchool
            ?.generalAverage ?? null;
      }

      pilotToAssign.forEach((app, index) => {
        const sectionIndex = Math.min(
          Math.floor(index / params.sectionCapacity),
          pilotSections.length - 1,
        );
        preview.proposedAssignments.push(
          this.mapToProposed(app, pilotSections[sectionIndex], isGrade7),
        );
      });
    } else {
      sortedRegular.forEach((app) => {
        const availablePilot = pilotSections.find(
          (s) => s.maxCapacity - s._count.enrollmentRecords > 0,
        );
        if (availablePilot) {
          preview.proposedAssignments.push(
            this.mapToProposed(app, availablePilot, isGrade7),
          );
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
        ? `Assigned top ${pilotToAssign.length} regular applicants into ${params.pilotSectionCount} homogeneous BEC Pilot section(s).`
        : "Filled available vacancies in BEC Pilot sections based on academic merit.",
      stats: {
        assigned: pilotToAssign.length,
        pilotCutoffAve,
        reclassifiedLearners: remainingPool.map((app) =>
          this.mapToProposed(
            app,
            { id: 0, name: "RECLASSIFIED" } as SectionWithCount,
            isGrade7,
          ),
        ),
        sections: pilotSections.map((s) => s.name),
      },
    });

    // --- STEP 3: Heterogeneous Snake Draft ---
    if (remainingPool.length > 0) {
      if (heteroSections.length === 0) {
        throw new AppError(
          400,
          "Insufficient heterogeneous sections for remaining pool.",
        );
      }

      this.distributeEquitably(
        remainingPool,
        heteroSections,
        preview,
        isGrade7,
      );

      preview.steps.push({
        title: "Heterogeneous Snake Draft",
        description:
          "Distributed remaining pool equitably using a zig-zag snake draft.",
        stats: {
          assigned: remainingPool.length,
          sections: heteroSections.map((s) => s.name),
        },
      });
    }

    return preview;
  }

  private distributeEquitably(
    pool: ApplicantWithRelations[],
    sections: SectionWithCount[],
    preview: SectioningPreview,
    isGrade7: boolean,
  ) {
    const males = pool.filter((a) => a.learner.sex === "MALE");
    const females = pool.filter((a) => a.learner.sex === "FEMALE");

    const isFrustrated = (level: string | null) =>
      level === "FRUSTRATION" || level === "NON_READER";

    const frustratedMales = males.filter((m) =>
      isFrustrated(m.readingProfileLevel),
    );
    const standardMales = males.filter(
      (m) => !isFrustrated(m.readingProfileLevel),
    );
    const frustratedFemales = females.filter((f) =>
      isFrustrated(f.readingProfileLevel),
    );
    const standardFemales = females.filter(
      (f) => !isFrustrated(f.readingProfileLevel),
    );

    const sortFn = (a: ApplicantWithRelations, b: ApplicantWithRelations) => {
      const aveA = this.resolveGenAve(a, isGrade7) || 0;
      const aveB = this.resolveGenAve(b, isGrade7) || 0;
      return aveB - aveA;
    };

    [
      frustratedMales,
      frustratedFemales,
      standardMales,
      standardFemales,
    ].forEach((p) => p.sort(sortFn));

    let sectionIndex = 0;
    let direction = 1;

    const assignBatch = (batch: ApplicantWithRelations[]) => {
      batch.forEach((app) => {
        const targetSection = sections[sectionIndex];
        preview.proposedAssignments.push(
          this.mapToProposed(app, targetSection, isGrade7),
        );

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

    const frustratedCombined: ApplicantWithRelations[] = [];
    const maxFrustrated = Math.max(
      frustratedMales.length,
      frustratedFemales.length,
    );
    for (let i = 0; i < maxFrustrated; i++) {
      if (frustratedMales[i]) frustratedCombined.push(frustratedMales[i]);
      if (frustratedFemales[i]) frustratedCombined.push(frustratedFemales[i]);
    }
    assignBatch(frustratedCombined);

    const standardCombined: ApplicantWithRelations[] = [];
    const maxStandard = Math.max(standardMales.length, standardFemales.length);
    for (let i = 0; i < maxStandard; i++) {
      if (standardMales[i]) standardCombined.push(standardMales[i]);
      if (standardFemales[i]) standardCombined.push(standardFemales[i]);
    }
    assignBatch(standardCombined);
  }

  private mapToProposed(
    app: ApplicantWithRelations,
    section: SectionWithCount,
    isGrade7: boolean,
    meta?: { rankingScore?: number | null; rank?: number | null },
  ) {
    let raw: number | null | undefined = null;

    raw = this.resolveGenAve(app, isGrade7);

    const genAve =
      raw !== null && raw !== undefined ? parseFloat(String(raw)) : null;

    return {
      applicationId: app.id,
      sectionId: section.id,
      sectionName: section.name,
      learnerName: `${app.learner.lastName}, ${app.learner.firstName}`,
      lrn: app.learner.lrn,
      gender: app.learner.sex,
      genAve: isNaN(genAve as number) ? null : genAve,
      readingProfile: app.readingProfileLevel,
      programType: app.applicantType,
      status: app.status,
      rankingScore: meta?.rankingScore ?? null,
      rank: meta?.rank ?? null,
    };
  }

  private distributeViaSnakeDraft(
    pool: ApplicantWithRelations[],
    sections: SectionWithCount[],
    preview: SectioningPreview,
  ) {
    // Replaced by distributeEquitably
  }
}
