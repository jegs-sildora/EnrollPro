import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import {
  calculateActiveTally,
  calculateUtilizationPercent,
  countDistinctLearners,
} from "./dashboard.metrics.js";

interface GradeBreakdownAccumulator {
  male: number
  female: number
  current: number
  late: number
  dropped: number
  feeder: number
  transferee: number
  balikAral: number
}

interface DailyIntakeAccumulator {
  online: number
  f2f: number
}

interface DailyIntakePoint extends DailyIntakeAccumulator {
  date: string
}

interface CurriculumDistributionItem {
  programType: string
  label: string
  count: number
  isSpecialProgram: boolean
}

const PROGRAM_LABELS: Record<string, string> = {
  REGULAR: "Basic Education Curriculum",
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: "Science, Technology, and Engineering",
  SPECIAL_PROGRAM_IN_THE_ARTS: "Special Program in the Arts",
  SPECIAL_PROGRAM_IN_SPORTS: "Special Program in Sports",
  SPECIAL_PROGRAM_IN_JOURNALISM: "Special Program in Journalism",
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "Special Program in Foreign Language",
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION:
    "Special Program in Technical-Vocational Education",
  LATE_ENROLLEE: "Regular BEC Late Enrollment",
};

const ACTIVE_APPLICATION_STATUSES = [
  "READY_FOR_SECTIONING",
  "OFFICIALLY_ENROLLED",
] as const;

const PENDING_ENROLLMENT_STATUSES = new Set<string>([
  "PENDING_VERIFICATION",
  "PENDING_CONFIRMATION",
]);

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function isValidLrn(value: string | null | undefined): boolean {
  return /^\d{12}$/.test(value ?? "");
}

export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const schoolYearId = req.schoolYearId;
    
    // Fetch systemPhase
    const setting = await prisma.schoolSetting.findFirst();
    const systemPhase = setting?.systemPhase || "OFFICIAL_ENROLLMENT";

    if (!schoolYearId) {
      res.json({
        stats: {
          systemPhase: "OFFICIAL_ENROLLMENT",
          kpiHeader: {
            pendingTotal: 0,
            unassignedTotal: 0,
            deficientTotal: 0,
            enrolledTotal: 0,
          },
          summaryRibbon: {
            totalEnrollment: 0,
            activeFaculty: 0,
            enrolledSections: 0,
            pendingSystemValidations: 0,
          },
          curriculumDistribution: [],
          intakePipeline: [],
          sectionSaturation: [],
          sf1Compliance: {
            invalidLrn: 0,
            missingBirthdate: 0,
            missingMotherTongue: 0,
            missingCurrentAddress: 0,
            missingGuardianContact: 0,
            affectedLearners: 0,
          },
          activeTally: {
            verifiedBosyBaseline: 0,
            lateAdmissions: 0,
            officiallyDropped: 0,
            activeTotal: 0,
          },
          eosyReadiness: {
            pendingSections: 0,
            incompleteLearnerOutcomes: 0,
            conditionallyPromoted: 0,
            retained: 0,
            promotionCompletionPercent: 0,
            sf5Ready: false,
            sf6Ready: false,
          },
          gradeLevelBreakdown: [],
          criticalSections: [],
          totalSections: 0,
        },
      });
      return;
    }

    const schoolYearObj = await prisma.schoolYear.findUnique({
      where: { id: schoolYearId },
      select: { status: true }
    });
    const isArchived = schoolYearObj?.status === "ARCHIVED";

    const gradeLevels = await prisma.gradeLevel.findMany({
      orderBy: { displayOrder: 'asc' }
    });
    const gradeTenId = gradeLevels.find((gradeLevel) => gradeLevel.displayOrder === 10)?.id;

    const activeOfficialEnrollmentTotal = isArchived
      ? prisma.enrollmentHistory.count({ where: { schoolYearId } })
      : Promise.all([
          prisma.enrollmentRecord.count({
            where: {
              schoolYearId,
              dropOutDate: null,
              transferOutDate: null,
            },
          }),
          prisma.enrollmentApplication.count({
            where: {
              schoolYearId,
              status: "READY_FOR_SECTIONING",
              enrollmentRecord: { is: null },
            },
          }),
        ]).then(
          ([sectionedCount, confirmedUnassignedCount]) =>
            sectionedCount + confirmedUnassignedCount,
        );

    const [
      enrolledTotal,
      unassignedTotal,
      activeSchoolTallyBOSY,
      activeSchoolTallyLate,
      eosyFinalizedSections,
      eosyPendingSections,
      promotedTotal,
      retainedTotal,
      irregularTotal
    ] = await Promise.all([
      activeOfficialEnrollmentTotal,
      isArchived ? Promise.resolve(0) : prisma.enrollmentApplication.count({ where: { status: "READY_FOR_SECTIONING", enrollmentRecord: { is: null }, schoolYearId } }),
      isArchived ? Promise.resolve(0) : prisma.enrollmentRecord.count({ 
        where: { isLateEnrollee: false, schoolYearId } 
      }),
      isArchived ? Promise.resolve(0) : prisma.enrollmentRecord.count({ 
        where: { isLateEnrollee: true, schoolYearId } 
      }),
      
      // EOSY Queries
      prisma.section.count({ where: { schoolYearId, isEosyFinalized: true } }),
      prisma.section.count({ where: { schoolYearId, isEosyFinalized: false } }),
      isArchived ? prisma.enrollmentHistory.count({ where: { schoolYearId, eosyStatus: "PROMOTED" } }) : prisma.enrollmentRecord.count({ where: { schoolYearId, eosyStatus: "PROMOTED" } }),
      isArchived ? prisma.enrollmentHistory.count({ where: { schoolYearId, eosyStatus: "RETAINED" } }) : prisma.enrollmentRecord.count({ where: { schoolYearId, eosyStatus: "RETAINED" } }),
      isArchived ? prisma.enrollmentHistory.count({ where: { schoolYearId, eosyStatus: "CONDITIONALLY_PROMOTED" } }) : prisma.enrollmentRecord.count({ where: { schoolYearId, eosyStatus: "CONDITIONALLY_PROMOTED" } })
    ]);

    const sections = await prisma.section.findMany({
      where: { schoolYearId },
      include: {
        gradeLevel: true,
        enrollmentRecords: {
          select: {
            dropOutDate: true,
            transferOutDate: true,
          },
        },
        _count: {
          select: isArchived ? { enrollmentHistories: true } : { enrollmentRecords: true }
        }
      }
    });

    const criticalSections = sections
      .map(s => ({
        id: s.id,
        name: `${s.gradeLevel.name} - ${s.name}`,
        capacity: s.maxCapacity || 45,
        enrolled: isArchived
          ? s._count.enrollmentHistories
          : s.enrollmentRecords.filter(
              (record) => !record.dropOutDate && !record.transferOutDate,
            ).length,
      }))
      .sort((a, b) => b.enrolled - a.enrolled)
      .slice(0, 3);

    const totalSections = sections.length;


    const breakdownMap = new Map<number, GradeBreakdownAccumulator>();
    gradeLevels.forEach(gl => {
      breakdownMap.set(gl.id, {
        male: 0,
        female: 0,
        current: 0,
        late: 0,
        dropped: 0,
        feeder: 0,
        transferee: 0,
        balikAral: 0,
      });
    });

    if (isArchived) {
      const histRecords = await prisma.enrollmentHistory.findMany({
        where: { schoolYearId },
        select: {
          eosyStatus: true,
          gradeLevelId: true,
          learner: {
            select: { sex: true }
          }
        }
      });

      histRecords.forEach(r => {
        const glId = r.gradeLevelId;
        const sex = r.learner?.sex;
        const item = glId ? breakdownMap.get(glId) : undefined;
        if (!item) return;

        item.current += 1;
        if (r.eosyStatus === "DROPPED_OUT") item.dropped += 1;

        if (sex === "MALE") item.male += 1;
        else if (sex === "FEMALE") item.female += 1;
      });
    } else {
      const records = await prisma.enrollmentRecord.findMany({
        where: { schoolYearId },
        select: {
          isLateEnrollee: true,
          dropOutDate: true,
          enrollmentApplication: {
            select: { gradeLevelId: true }
          },
          learner: {
            select: { sex: true }
          }
        }
      });

      records.forEach(r => {
        const glId = r.enrollmentApplication?.gradeLevelId;
        const sex = r.learner?.sex;
        const item = glId ? breakdownMap.get(glId) : undefined;
        if (!item) return;

        item.current += 1;
        if (r.isLateEnrollee) item.late += 1;
        if (r.dropOutDate) item.dropped += 1;

        if (sex === "MALE") item.male += 1;
        else if (sex === "FEMALE") item.female += 1;
      });
    }

    const applications = await prisma.enrollmentApplication.findMany({
      where: { schoolYearId },
      select: {
        id: true,
        learnerId: true,
        gradeLevelId: true,
        learnerType: true,
        admissionChannel: true,
        applicantType: true,
        assignedProgram: true,
        complianceStatus: true,
        isLateEnrollee: true,
        isMissingSf9: true,
        status: true,
        contactNumber: true,
        learner: {
          select: {
            lrn: true,
            birthdate: true,
            motherTongue: true,
            hasPsaBirthCertificate: true,
            missingRequirements: true,
          },
        },
        addresses: {
          where: { addressType: "CURRENT" },
          select: {
            barangay: true,
            cityMunicipality: true,
          },
        },
        familyMembers: {
          select: { contactNumber: true },
        },
        enrollmentRecord: {
          select: {
            id: true,
            isLateEnrollee: true,
            dropOutDate: true,
            transferOutDate: true,
            eosyStatus: true,
            section: {
              select: { programType: true },
            },
          },
        },
      }
    });

    applications.forEach(app => {
      const glId = app.gradeLevelId;
      const item = glId ? breakdownMap.get(glId) : undefined;
      if (!item) return;

      if (app.learnerType === "NEW_ENROLLEE") item.feeder += 1;
      else if (app.learnerType === "TRANSFEREE") item.transferee += 1;
      else if (app.learnerType === "RETURNING") item.balikAral += 1;
    });

    const gradeLevelBreakdown = gradeLevels.map(gl => {
      const item = breakdownMap.get(gl.id);
      return {
        id: gl.id,
        name: gl.name,
        current: item?.current || 0,
        male: item?.male || 0,
        female: item?.female || 0,
        late: item?.late || 0,
        dropped: item?.dropped || 0,
        feeder: item?.feeder || 0,
        transferee: item?.transferee || 0,
        balikAral: item?.balikAral || 0,
      };
    });

    const activeFaculty = await prisma.teacher.count({
      where: {
        isActive: true,
        serviceStatus: "ACTIVE",
      },
    });

    const activeStatusSet = new Set<string>(ACTIVE_APPLICATION_STATUSES);
    const terminalPipelineStatuses = new Set<string>([
      "REJECTED",
      "WITHDRAWN",
      "ARCHIVED_NO_SHOW",
      "TRANSFERRED_OUT",
      "DROPPED",
      "REMEDIAL_HOLD",
      "REMEDIAL_RESOLVED",
    ]);
    const activeApplications = applications.filter((application) => {
      const record = application.enrollmentRecord;
      const hasActiveRecord = Boolean(
        record && !record.dropOutDate && !record.transferOutDate,
      );
      return hasActiveRecord || activeStatusSet.has(application.status);
    });
    const pipelineApplications = isArchived
      ? []
      : applications.filter(
          (application) => !terminalPipelineStatuses.has(application.status),
        );

    const invalidLrnLearners = new Set<number>();
    const missingBirthdateLearners = new Set<number>();
    const missingMotherTongueLearners = new Set<number>();
    const missingAddressLearners = new Set<number>();
    const missingGuardianContactLearners = new Set<number>();
    const documentFollowUpLearners = new Set<number>();
    const pendingValidationLearners = new Set<number>();

    pipelineApplications.forEach((application) => {
      const learnerId = application.learnerId;
      const currentAddress = application.addresses[0];
      const hasAddress = Boolean(
        currentAddress
        && hasText(currentAddress.barangay)
        && hasText(currentAddress.cityMunicipality),
      );
      const hasGuardianContact =
        hasText(application.contactNumber)
        || application.familyMembers.some((member) =>
          hasText(member.contactNumber),
        );

      if (!isValidLrn(application.learner.lrn)) {
        invalidLrnLearners.add(learnerId);
      }
      if (!application.learner.birthdate) {
        missingBirthdateLearners.add(learnerId);
      }
      if (!hasText(application.learner.motherTongue)) {
        missingMotherTongueLearners.add(learnerId);
      }
      if (!hasAddress) {
        missingAddressLearners.add(learnerId);
      }
      if (!hasGuardianContact) {
        missingGuardianContactLearners.add(learnerId);
      }

      const hasSf1Gap =
        !isValidLrn(application.learner.lrn)
        || !application.learner.birthdate
        || !hasText(application.learner.motherTongue)
        || !hasAddress
        || !hasGuardianContact;
      const hasDocumentGap =
        application.complianceStatus === "PENDING"
        || application.isMissingSf9
        || !application.learner.hasPsaBirthCertificate
        || application.learner.missingRequirements.length > 0;
      const hasQueueValidation =
        application.status === "PENDING_VERIFICATION"
        || (
          application.status === "READY_FOR_SECTIONING"
          && !application.enrollmentRecord
        );

      if (hasSf1Gap || hasDocumentGap || hasQueueValidation) {
        pendingValidationLearners.add(learnerId);
      }
      if (hasDocumentGap) documentFollowUpLearners.add(learnerId);
    });

    const pendingEnrollmentTotal = pipelineApplications.filter(
      (application) => PENDING_ENROLLMENT_STATUSES.has(application.status),
    ).length;
    const lateLearnersToProcess = pipelineApplications.filter(
      (application) =>
        application.isLateEnrollee && !application.enrollmentRecord,
    ).length;

    const curriculumCounts = new Map<string, number>();
    if (isArchived) {
      sections.forEach((section) => {
        const current = curriculumCounts.get(section.programType) ?? 0;
        curriculumCounts.set(
          section.programType,
          current + section._count.enrollmentHistories,
        );
      });
    } else {
      activeApplications.forEach((application) => {
        const rawProgram =
          application.enrollmentRecord?.section.programType
          ?? application.assignedProgram
          ?? application.applicantType;
        const programType = rawProgram === "LATE_ENROLLEE" ? "REGULAR" : rawProgram;
        curriculumCounts.set(
          programType,
          (curriculumCounts.get(programType) ?? 0) + 1,
        );
      });
    }

    const curriculumDistribution: CurriculumDistributionItem[] = Array.from(
      curriculumCounts.entries(),
    )
      .map(([programType, count]) => ({
        programType,
        label: PROGRAM_LABELS[programType] ?? programType.replaceAll("_", " "),
        count,
        isSpecialProgram: programType !== "REGULAR",
      }))
      .sort((a, b) => {
        if (a.programType === "REGULAR") return -1;
        if (b.programType === "REGULAR") return 1;
        return b.count - a.count;
      });

    const intakePipeline = gradeLevels.map((gradeLevel) => {
      const gradeApplications = pipelineApplications.filter(
        (application) => application.gradeLevelId === gradeLevel.id,
      );
      let continuingLearners = 0;
      let walkIn = 0;
      let transferee = 0;

      gradeApplications.forEach((application) => {
        if (application.learnerType === "TRANSFEREE") {
          transferee += 1;
        } else if (application.learnerType === "CONTINUING") {
          continuingLearners += 1;
        } else if (application.admissionChannel === "F2F") {
          walkIn += 1;
        }
      });

      return {
        gradeLevelId: gradeLevel.id,
        gradeLevelName: gradeLevel.name,
        displayOrder: gradeLevel.displayOrder,
        continuingLearners,
        walkIn,
        transferee,
      };
    });

    const sectionSaturation = sections
      .map((section) => {
        const enrolled = isArchived
          ? section._count.enrollmentHistories
          : section.enrollmentRecords.filter(
              (record) => !record.dropOutDate && !record.transferOutDate,
            ).length;
        const capacity = section.maxCapacity || 0;
        return {
          id: section.id,
          name: section.name,
          gradeLevelName: section.gradeLevel.name,
          programType: section.programType,
          capacity,
          enrolled,
          utilizationPercent: calculateUtilizationPercent(enrolled, capacity),
          isOverCapacity: capacity > 0 && enrolled > capacity,
        };
      })
      .sort((a, b) => {
        if (a.isOverCapacity !== b.isOverCapacity) {
          return a.isOverCapacity ? -1 : 1;
        }
        return b.utilizationPercent - a.utilizationPercent;
      });

    const activeEnrollmentRecords = applications
      .map((application) => application.enrollmentRecord)
      .filter((record): record is NonNullable<typeof record> => Boolean(record));
    const activeTally = calculateActiveTally(activeEnrollmentRecords);

    const eosyEligibleRecords = activeEnrollmentRecords.filter(
      (record) => !record.dropOutDate && !record.transferOutDate,
    );
    const incompleteLearnerOutcomes = eosyEligibleRecords.filter(
      (record) => !record.eosyStatus,
    ).length;
    const completedOutcomes = eosyEligibleRecords.length - incompleteLearnerOutcomes;
    const promotionCompletionPercent = eosyEligibleRecords.length === 0
      ? 0
      : Math.round((completedOutcomes / eosyEligibleRecords.length) * 100);
    const eosyReadiness = {
      pendingSections: eosyPendingSections,
      incompleteLearnerOutcomes,
      conditionallyPromoted: irregularTotal,
      retained: retainedTotal,
      promotionCompletionPercent,
      sf5Ready: eosyPendingSections === 0 && incompleteLearnerOutcomes === 0,
      sf6Ready: eosyPendingSections === 0 && incompleteLearnerOutcomes === 0,
    };

    const summaryRibbon = {
      totalEnrollment: enrolledTotal,
      activeFaculty,
      enrolledSections: sectionSaturation.filter(
        (section) => section.enrolled > 0,
      ).length,
      pendingSystemValidations: pendingValidationLearners.size,
    };

    const sf1Compliance = {
      invalidLrn: invalidLrnLearners.size,
      missingBirthdate: missingBirthdateLearners.size,
      missingMotherTongue: missingMotherTongueLearners.size,
      missingCurrentAddress: missingAddressLearners.size,
      missingGuardianContact: missingGuardianContactLearners.size,
      affectedLearners: countDistinctLearners([
        invalidLrnLearners,
        missingBirthdateLearners,
        missingMotherTongueLearners,
        missingAddressLearners,
        missingGuardianContactLearners,
      ]),
    };

    const sectionsList = await prisma.section.findMany({
      where: { schoolYearId },
      select: { maxCapacity: true }
    });
    const totalCapacity = sectionsList.reduce((sum, s) => sum + (s.maxCapacity || 0), 0);
    const classroomDeficitDetected = enrolledTotal > totalCapacity;

    const getManilaDateString = (date: Date): string => {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const parts = formatter.formatToParts(date);
      const year = parts.find((part) => part.type === "year")?.value ?? "0";
      const month = parts.find((part) => part.type === "month")?.value ?? "0";
      const day = parts.find((part) => part.type === "day")?.value ?? "0";
      return `${year}-${month}-${day}`;
    };

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 15);
    const recentApps = await prisma.enrollmentApplication.findMany({
      where: {
        schoolYearId,
        createdAt: { gte: startDate }
      },
      select: {
        createdAt: true,
        admissionChannel: true,
      }
    });

    const dailyMap = new Map<string, DailyIntakeAccumulator>();
    recentApps.forEach(app => {
      const dateStr = getManilaDateString(app.createdAt);
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, { online: 0, f2f: 0 });
      }
      const counts = dailyMap.get(dateStr);
      if (!counts) return;

      if (app.admissionChannel === "ONLINE") counts.online += 1;
      else counts.f2f += 1;
    });

    const dailyIntakeVelocity: DailyIntakePoint[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = getManilaDateString(d);
      const counts = dailyMap.get(dateStr) || { online: 0, f2f: 0 };
      const monthNamesFull = Array.of(
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      );
      const displayDate = `${monthNamesFull.at(d.getMonth())} ${d.getDate()}`;
      dailyIntakeVelocity.push({
        date: displayDate,
        online: counts.online,
        f2f: counts.f2f,
      });
    }

    let feederCount = 0;
    let transfereeCount = 0;
    let alsCount = 0;
    let peptCount = 0;
    let balikAralCount = 0;
    applications.forEach(app => {
      if (app.learnerType === "NEW_ENROLLEE") feederCount += 1;
      else if (app.learnerType === "TRANSFEREE") transfereeCount += 1;
      else if (app.learnerType === "ALS") alsCount += 1;
      else if (app.learnerType === "RETURNING") balikAralCount += 1;
    });

    const intakeDemographics = Array.of(
      { category: "Feeder Elementary Graduates", count: feederCount },
      { category: "External Transferees In", count: transfereeCount },
      { category: "ALS Passers", count: alsCount },
      { category: "PEPT Passers", count: peptCount },
      { category: "Balik-Aral", count: balikAralCount }
    );

    let hasSectionLoadDisparity = false;
    const gradeSectionsMap = new Map<number, number[]>();
    sections.forEach(s => {
      const glId = s.gradeLevelId;
      const counts = gradeSectionsMap.get(glId) ?? [];
      counts.push(
        isArchived
          ? s._count.enrollmentHistories
          : s.enrollmentRecords.filter(
              (record) => !record.dropOutDate && !record.transferOutDate,
            ).length,
      );
      gradeSectionsMap.set(glId, counts);
    });

    for (const counts of gradeSectionsMap.values()) {
      if (counts.length > 1) {
        const min = Math.min(...counts);
        const max = Math.max(...counts);
        if (max - min > 5) {
          hasSectionLoadDisparity = true;
        }
      }
    }

    const activeEnrolledCount = isArchived
      ? await prisma.enrollmentHistory.count({
          where: { schoolYearId, eosyStatus: { notIn: ["DROPPED_OUT", "TRANSFERRED_OUT"] } }
        })
      : await prisma.enrollmentRecord.count({
          where: { schoolYearId, dropOutDate: null, transferOutDate: null }
        });

    const cumulativeTransferredCount = isArchived
      ? await prisma.enrollmentHistory.count({
          where: { schoolYearId, eosyStatus: "TRANSFERRED_OUT" }
        })
      : await prisma.enrollmentRecord.count({
          where: { schoolYearId, transferOutDate: { not: null } }
        });

    const cumulativeDroppedCount = isArchived
      ? await prisma.enrollmentHistory.count({
          where: { schoolYearId, eosyStatus: "DROPPED_OUT" }
        })
      : await prisma.enrollmentRecord.count({
          where: { schoolYearId, dropOutDate: { not: null } }
        });

    const jhsCompleterRecords = isArchived && gradeTenId
      ? await prisma.enrollmentHistory.findMany({
          where: {
            schoolYearId,
            gradeLevelId: gradeTenId,
            eosyStatus: "PROMOTED",
          },
          select: {
            learner: {
              select: { sex: true },
            },
          },
        })
      : [];
    const jhsCompletersMale = jhsCompleterRecords.filter(
      (record) => record.learner.sex === "MALE",
    ).length;
    const jhsCompletersFemale = jhsCompleterRecords.filter(
      (record) => record.learner.sex === "FEMALE",
    ).length;

    const learnerRetention = Array.of(
      { name: "Officially Enrolled Active Tally", value: activeEnrolledCount },
      { name: "Cumulative Transferred Out", value: cumulativeTransferredCount },
      { name: "Cumulative Dropped Out", value: cumulativeDroppedCount }
    );

    const gradeLevelFinalization = gradeLevels.map(gl => {
      const glSections = sections.filter(s => s.gradeLevelId === gl.id);
      const totalCount = glSections.length;
      const finalizedCount = glSections.filter(s => s.isEosyFinalized).length;
      const percent = totalCount === 0 ? 0 : Math.round((finalizedCount / totalCount) * 100);
      return {
        id: gl.id,
        name: gl.name,
        total: totalCount,
        finalized: finalizedCount,
        percent,
      };
    });

    const activeLearnersCount = isArchived
      ? await prisma.learner.count({
          where: { enrollmentHistories: { some: { schoolYearId, eosyStatus: { notIn: ["DROPPED_OUT", "TRANSFERRED_OUT"] } } } }
        })
      : await prisma.learner.count({
          where: { enrollmentRecords: { some: { schoolYearId, dropOutDate: null, transferOutDate: null } } }
        });

    const transferredLearnersCount = isArchived
      ? await prisma.learner.count({
          where: { enrollmentHistories: { some: { schoolYearId, eosyStatus: "TRANSFERRED_OUT" } } }
        })
      : await prisma.learner.count({
          where: { enrollmentRecords: { some: { schoolYearId, transferOutDate: { not: null } } } }
        });

    const droppedLearnersCount = isArchived
      ? await prisma.learner.count({
          where: { enrollmentHistories: { some: { schoolYearId, eosyStatus: "DROPPED_OUT" } } }
        })
      : await prisma.learner.count({
          where: { enrollmentRecords: { some: { schoolYearId, dropOutDate: { not: null } } } }
        });


    const baseStats = {
      systemPhase,
      isArchived,
      classroomDeficitDetected,
      dailyIntakeVelocity,
      intakeDemographics,
      kpiHeader: {
        pendingTotal: isArchived ? 0 : pendingEnrollmentTotal,
        unassignedTotal,
        deficientTotal: isArchived ? 0 : documentFollowUpLearners.size,
        enrolledTotal,
      },
      summaryRibbon,
      curriculumDistribution,
      intakePipeline,
      sectionSaturation,
      sf1Compliance,
      activeTally,
      eosyReadiness,
      classesOngoing: {
        lateIntakeCount: isArchived ? 0 : lateLearnersToProcess,
        overdueDocumentsCount: isArchived ? 0 : documentFollowUpLearners.size,
        activeSchoolTallyBOSY,
        activeSchoolTallyLate,
        hasSectionLoadDisparity,
      },
      eosyStats: {
        eosyFinalizedSections,
        eosyPendingSections,
        promotedTotal,
        retainedTotal,
        irregularTotal,
        learnerRetention,
        gradeLevelFinalization,
        activeLearnersCount,
        transferredLearnersCount,
        droppedLearnersCount
      },
      historicalSummary: {
        promotedTotal,
        conditionallyPromotedTotal: irregularTotal,
        retainedTotal,
        jhsCompletersTotal: jhsCompleterRecords.length,
        jhsCompletersMale,
        jhsCompletersFemale,
        transferredOutTotal: cumulativeTransferredCount,
        droppedOutTotal: cumulativeDroppedCount,
      },
      criticalSections,
      totalSections,
      gradeLevelBreakdown,
    };

    res.json({ stats: baseStats });
  } catch (error) {
    console.error("Dashboard fetch error:", error);
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
}
