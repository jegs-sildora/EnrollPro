import { PrismaClient } from "../../../generated/prisma/index.js";
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
    status: string;
  }[];
}

export class SectioningEngine {
  constructor(private prisma: PrismaClient) {}

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
  ): Promise<any[]> {
    const PREFIX = "STE";
    const capacities = this.distributeQuotaToSections(quota, sectionCount);
    const targetNames: string[] = [];

    for (let i = 0; i < sectionCount; i++) {
      const name = this.getScpSectionName(PREFIX, i);
      targetNames.push(name);
      await this.prisma.section.upsert({
        where: { uq_sections_name_grade_sy: { name, gradeLevelId, schoolYearId } },
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
          status: { in: ["VERIFIED", "TEMPORARILY_ENROLLED", "READY_FOR_SECTIONING"] },
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

    // 1. Fetch all eligible learners (VERIFIED, TEMPORARILY_ENROLLED, or READY_FOR_SECTIONING status, no section yet)
    const applicants = await this.prisma.enrollmentApplication.findMany({
      where: {
        gradeLevelId,
        schoolYearId,
        status: { in: ["VERIFIED", "TEMPORARILY_ENROLLED", "READY_FOR_SECTIONING"] },
        enrollmentRecord: null,
      },
      include: {
        learner: true,
        previousSchool: true,
        earlyRegistration: {
          include: {
            assessments: {
              where: { type: "QUALIFYING_EXAMINATION" },
              orderBy: { score: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (applicants.length === 0) {
      throw new AppError(400, "No eligible learners found for sectioning.");
    }

    // Check Gen Ave lock
    const missingGenAve = applicants.filter(
      (a) => !a.previousSchool?.generalAverage,
    );
    if (missingGenAve.length > 0) {
      throw new AppError(
        400,
        `Cannot run batch sectioning. ${missingGenAve.length} learners are missing SF9 General Average.`,
      );
    }

    // 2. Fetch sections and their current enrollment
    const sections = await this.prisma.section.findMany({
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
    // This replaces the hard-stop and makes the engine self-provisioning.
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
      (a) => (a as any).learner?.promotionStatus !== "RETAINED",
    );

    // --- STEP 1: SCP Segregation (Top 70 STE or Vacancy Fill) ---
    const steApplicants = eligibleApplicants.filter(
      (a) => a.applicantType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
    );

    // Sort by Admission Exam Score (Grade 7) or Previous Gen Ave (Grade 8-10)
    const sortedSte = [...steApplicants].sort((a, b) => {
      if (isGrade7) {
        const scoreA = a.earlyRegistration?.assessments[0]?.score ?? 0;
        const scoreB = b.earlyRegistration?.assessments[0]?.score ?? 0;
        return scoreB - scoreA;
      } else {
        const aveA = (a as any).learner?.previousGenAve ?? 0;
        const aveB = (b as any).learner?.previousGenAve ?? 0;
        return aveB - aveA;
      }
    });

    let steToAssign: any[] = [];
    let steSpillover: any[] = [];
    let steCutoffScore: number | null = null;

    if (isGrade7) {
      // Clamp to actual eligible count if fewer than quota
      const actualSteCount = Math.min(sortedSte.length, params.steQuota);
      steToAssign = sortedSte.slice(0, actualSteCount);
      steSpillover = sortedSte.slice(actualSteCount);

      if (sortedSte.length >= params.steQuota) {
        steCutoffScore =
          sortedSte[params.steQuota - 1].earlyRegistration?.assessments[0]
            ?.score ?? null;
      } else if (sortedSte.length > 0) {
        steCutoffScore =
          sortedSte[sortedSte.length - 1].earlyRegistration?.assessments[0]
            ?.score ?? null;
      }

      // Floor + remainder distribution: 100 ÷ 3 → STE-A:34, STE-B:33, STE-C:33
      const perSectionCounts = this.distributeQuotaToSections(
        steToAssign.length,
        params.steSections,
      );
      let steOffset = 0;
      perSectionCounts.forEach((count, sectionIndex) => {
        const targetSection = steSections[sectionIndex];
        steToAssign.slice(steOffset, steOffset + count).forEach((app) => {
          preview.proposedAssignments.push(
            this.mapToProposed(app, targetSection),
          );
        });
        steOffset += count;
      });
    } else {
      // Vacancy Fill for Grade 8-10 — dynamic across all STE sections
      sortedSte.forEach((app) => {
        const availableSection = steSections.find(
          (s) => s.maxCapacity - s._count.enrollmentRecords > 0,
        );
        if (availableSection) {
          preview.proposedAssignments.push(
            this.mapToProposed(app, availableSection),
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
          : `Allocated top ${params.steQuota} STE applicants across ${params.steSections} STE section(s) based on Early Registration assessment scores.`
        : "Filled vacancies in STE sections with qualified applicants.",
      stats: {
        assigned: steToAssign.length,
        spillover: steSpillover.length,
        steCutoffScore,
        reclassifiedLearners: steSpillover.map((app) =>
          this.mapToProposed(app, { id: 0, name: "RECLASSIFIED" }),
        ),
        sections: steSections.map((s) => s.name),
      },
    });

    // --- STEP 2: BEC Pilot Slicing (Top 200 REGULAR or Vacancy Fill) ---
    const regularPool = [
      ...eligibleApplicants.filter((a) => a.applicantType === "REGULAR"),
      ...steSpillover, // Reclassified to REGULAR
    ];

    // Sort descending by Gen Ave (Grade 7 uses previous school info, Grade 8-10 uses synced SMART data)
    const sortedRegular = regularPool.sort((a, b) => {
      if (isGrade7) {
        const aveA = a.previousSchool?.generalAverage ?? 0;
        const aveB = b.previousSchool?.generalAverage ?? 0;
        return aveB - aveA;
      } else {
        const aveA = (a as any).learner?.previousGenAve ?? 0;
        const aveB = (b as any).learner?.previousGenAve ?? 0;
        return aveB - aveA;
      }
    });

    let pilotToAssign: any[] = [];
    let remainingPool: any[] = [];
    let pilotCutoffAve: number | null = null;

    if (isGrade7) {
      if (pilotSections.length < params.pilotSectionCount) {
        throw new AppError(
          400,
          `Config requires ${params.pilotSectionCount} BEC Pilot section(s), but only ${pilotSections.length} REGULAR sections found.`,
        );
      }
      const pilotPool = params.pilotSectionCount * params.sectionCapacity;
      pilotToAssign = sortedRegular.slice(0, pilotPool);
      remainingPool = sortedRegular.slice(pilotPool);

      // Calculate cutoff average
      if (sortedRegular.length >= pilotPool) {
        pilotCutoffAve =
          sortedRegular[pilotPool - 1].previousSchool?.generalAverage ?? null;
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
        const targetSection = pilotSections[sectionIndex];
        preview.proposedAssignments.push(
          this.mapToProposed(app, targetSection),
        );
      });
    } else {
      // Vacancy fill for Pilot
      sortedRegular.forEach((app) => {
        const availablePilot = pilotSections.find(
          (s) => s.maxCapacity - s._count.enrollmentRecords > 0,
        );
        if (availablePilot) {
          preview.proposedAssignments.push(
            this.mapToProposed(app, availablePilot),
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
        ? `Assigned top ${params.pilotSectionCount * params.sectionCapacity} regular applicants into ${params.pilotSectionCount} homogeneous BEC Pilot section(s) (${params.sectionCapacity} per section).`
        : "Filled available vacancies in BEC Pilot sections based on academic merit.",
      stats: {
        assigned: pilotToAssign.length,
        pilotCutoffAve,
        reclassifiedLearners: remainingPool.map((app) =>
          this.mapToProposed(app, { id: 0, name: "RECLASSIFIED" }),
        ),
        sections: pilotSections.map((s) => s.name),
      },
    });

    // --- STEP 3: Heterogeneous Snake Draft (Micro-Balancing) ---
    if (remainingPool.length > 0) {
      if (heteroSections.length === 0) {
        throw new AppError(
          400,
          "Insufficient heterogeneous sections for remaining pool.",
        );
      }

      this.distributeEquitably(remainingPool, heteroSections, preview);

      const frustratedCount = remainingPool.filter(
        (a) =>
          a.readingProfileLevel === "FRUSTRATION" ||
          a.readingProfileLevel === "NON_READER",
      ).length;

      preview.steps.push({
        title: "Heterogeneous Snake Draft",
        description:
          "Distributed remaining pool equitably using a zig-zag snake draft to balance gender parity and reading profiles.",
        stats: {
          assigned: remainingPool.length,
          frustratedCount,
          sections: heteroSections.map((s) => s.name),
        },
      });
    }

    return preview;
  }

  private distributeEquitably(
    pool: any[],
    sections: any[],
    preview: SectioningPreview,
  ) {
    // HNHS Section III: Gender Parity & Reading Profile Balancing

    // 1. Group by Gender
    const males = pool.filter((a) => a.learner.sex === "MALE");
    const females = pool.filter((a) => a.learner.sex === "FEMALE");

    // 2. Sub-group by Reading Profile (Frustrated/Non-Reader vs others)
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

    // 3. Sort each sub-pool by General Average to maintain academic balance during the snake
    const sortFn = (a: any, b: any) => {
      const isGrade7 =
        a.gradeLevel?.name?.includes("7") || a.gradeLevel?.displayOrder === 7;
      const aveA = isGrade7
        ? a.previousSchool?.generalAverage || 0
        : (a as any).learner?.previousGenAve || 0;
      const aveB = isGrade7
        ? b.previousSchool?.generalAverage || 0
        : (b as any).learner?.previousGenAve || 0;
      return aveB - aveA;
    };
    [
      frustratedMales,
      frustratedFemales,
      standardMales,
      standardFemales,
    ].forEach((p) => p.sort(sortFn));

    // 4. Unified Snake Draft
    // We process Frustrated first to ensure they are the most spread out, then standard.
    // Within each, we alternate gender to maintain parity.
    let sectionIndex = 0;
    let direction = 1;

    const assignBatch = (batch: any[]) => {
      batch.forEach((app) => {
        const targetSection = sections[sectionIndex];
        preview.proposedAssignments.push(
          this.mapToProposed(app, targetSection),
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

    // Alternate genders within the frustrated pool
    const frustratedCombined = [];
    const maxFrustrated = Math.max(
      frustratedMales.length,
      frustratedFemales.length,
    );
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
    const isGrade7 =
      app.gradeLevel?.name?.includes("7") || app.gradeLevel?.displayOrder === 7;

    return {
      applicationId: app.id,
      sectionId: section.id,
      sectionName: section.name,
      learnerName: `${app.learner.lastName}, ${app.learner.firstName}`,
      lrn: app.learner.lrn,
      gender: app.learner.sex,
      genAve: isGrade7
        ? app.previousSchool?.generalAverage ?? null
        : (app as any).learner?.previousGenAve ?? null,
      readingProfile: app.readingProfileLevel,
      programType: app.applicantType,
      status: app.status,
    };
  }

  private distributeViaSnakeDraft(
    pool: any[],
    sections: any[],
    preview: SectioningPreview,
  ) {
    // Note: Replaced by distributeEquitably for micro-balancing
  }
}
