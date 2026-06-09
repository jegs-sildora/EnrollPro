import { EosyStatus, AcademicStatus } from "../../../generated/prisma/index.js";
import type { Request, Response } from "express";
import {
  createSchoolYearControllerDeps,
  SchoolYearControllerDeps,
} from "../services/school-year-controller.deps.js";
import {
  cloneSchoolYearStructure,
  ensureDefaultGradeLevels,
  getCurrentManilaYear,
  parseDateInput,
  setActiveSchoolYear,
} from "../services/school-year-controller-shared.service.js";

function parseSchoolYearId(req: Request): number {
  return Number.parseInt(String(req.params.id ?? ""), 10);
}

const EOSY_SKIP_OUTCOMES = new Set([
  "DROPPED_OUT",
  "TRANSFERRED_OUT",
  "IRREGULAR",
]);
const EOSY_RETAINED_OUTCOMES = new Set(["RETAINED"]);
const MIN_ACTIVE_CALENDAR_SPAN_DAYS = 240;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface RolloverSummary {
  processedRecords: number;
  createdApplications: number;
  skippedByEosyOutcome: number;
  skippedIrregular: number;
  skippedNoTargetGrade: number;
  skippedExistingApplications: number;
  skippedDuplicateRecords: number;
}

function parseStartYearFromLabel(yearLabel: string): number {
  const parsed = Number.parseInt(yearLabel.split("-")[0] ?? "", 10);
  return Number.isInteger(parsed) ? parsed : new Date().getUTCFullYear();
}

function resolveRequestedYearLabel(
  requestedYearLabel: unknown,
  fallbackYearLabel: string,
): string {
  if (typeof requestedYearLabel !== "string") {
    return fallbackYearLabel;
  }

  const trimmedYearLabel = requestedYearLabel.trim();
  return trimmedYearLabel.length > 0 ? trimmedYearLabel : fallbackYearLabel;
}

function buildEnrollmentTrackingNumber(
  startYear: number,
  enrollmentApplicationId: number,
): string {
  return `REG-${startYear}-${String(enrollmentApplicationId).padStart(5, "0")}`;
}

async function carryOverEligibleLearners(
  deps: SchoolYearControllerDeps,
  sourceSchoolYearId: number,
  targetSchoolYearId: number,
  targetStartYear: number,
  actingUserId: number | null,
): Promise<RolloverSummary> {
  const [sourceRecords, targetGradeLevels, existingTargetApplications] =
    await Promise.all([
      deps.prisma.enrollmentRecord.findMany({
        where: {
          schoolYearId: sourceSchoolYearId,
          enrollmentApplication: {
            status: {
              in: ["ENROLLED", "SECTIONED"],
            },
          },
        },
        select: {
          eosyStatus: true,
          enrollmentApplication: {
            select: {
              learnerId: true,
              applicantType: true,
              isPrivacyConsentGiven: true,
              guardianRelationship: true,
              hasNoMother: true,
              hasNoFather: true,
              encodedById: true,
            },
          },
          section: {
            select: {
              gradeLevelId: true,
              gradeLevel: {
                select: {
                  displayOrder: true,
                },
              },
            },
          },
        },
      }),
      deps.prisma.gradeLevel.findMany({
        select: {
          id: true,
          displayOrder: true,
        },
      }),
      deps.prisma.enrollmentApplication.findMany({
        where: { schoolYearId: targetSchoolYearId },
        select: {
          learnerId: true,
        },
      }),
    ]);

  const targetGradeLevelByDisplayOrder = new Map<number, { id: number }>();
  for (const gradeLevel of targetGradeLevels) {
    targetGradeLevelByDisplayOrder.set(gradeLevel.displayOrder, {
      id: gradeLevel.id,
    });
  }

  const existingTargetLearnerIds = new Set<number>(
    existingTargetApplications.map((application) => application.learnerId),
  );
  const processedLearnerIds = new Set<number>();

  const summary: RolloverSummary = {
    processedRecords: sourceRecords.length,
    createdApplications: 0,
    skippedByEosyOutcome: 0,
    skippedIrregular: 0,
    skippedNoTargetGrade: 0,
    skippedExistingApplications: 0,
    skippedDuplicateRecords: 0,
  };

  for (const record of sourceRecords) {
    const learnerId = record.enrollmentApplication.learnerId;

    if (processedLearnerIds.has(learnerId)) {
      summary.skippedDuplicateRecords += 1;
      continue;
    }
    processedLearnerIds.add(learnerId);

    if (existingTargetLearnerIds.has(learnerId)) {
      summary.skippedExistingApplications += 1;
      continue;
    }

    const eosyStatus = record.eosyStatus ?? EosyStatus.PROMOTED;
    const isIrregular = eosyStatus === EosyStatus.CONDITIONALLY_PROMOTED;

    if (isIrregular) {
      summary.skippedIrregular += 1;
      continue;
    }
    if (EOSY_SKIP_OUTCOMES.has(eosyStatus)) {
      summary.skippedByEosyOutcome += 1;
      continue;
    }

    const sourceDisplayOrder = record.section.gradeLevel.displayOrder;
    const targetDisplayOrder =
      eosyStatus === EosyStatus.PROMOTED
        ? sourceDisplayOrder + 1
        : sourceDisplayOrder;
    const targetGradeLevel =
      targetGradeLevelByDisplayOrder.get(targetDisplayOrder) ?? null;

    if (!targetGradeLevel) {
      summary.skippedNoTargetGrade += 1;
      // A PROMOTED learner with no target grade is a JHS Completer (e.g. Grade 10 → no Grade 11).
      // EOSY section finalization should already have set this, but we enforce it here as a
      // belt-and-suspenders guard so the Alumni / JHS Completers table is always consistent.
      if (eosyStatus === EosyStatus.PROMOTED) {
        await deps.prisma.learner.update({
          where: { id: learnerId },
          data: { status: "JHS_COMPLETER" },
        });
      }
      continue;
    }

    const resolvedAcademicStatus =
      eosyStatus === EosyStatus.PROMOTED
        ? AcademicStatus.PROMOTED
        : AcademicStatus.RETAINED;

    const createdApplication = await deps.prisma.enrollmentApplication.create({
      data: {
        learnerId,
        schoolYearId: targetSchoolYearId,
        gradeLevelId: targetGradeLevel.id,
        applicantType: record.enrollmentApplication.applicantType,
        learnerType: "CONTINUING",
        status: "VERIFIED",
        admissionChannel: "F2F",
        isPrivacyConsentGiven:
          record.enrollmentApplication.isPrivacyConsentGiven,
        guardianRelationship: record.enrollmentApplication.guardianRelationship,
        hasNoMother: record.enrollmentApplication.hasNoMother,
        hasNoFather: record.enrollmentApplication.hasNoFather,
        encodedById:
          record.enrollmentApplication.encodedById ?? actingUserId ?? null,
        academicStatus: resolvedAcademicStatus,
        isRemedialRequired: isIrregular,
      },
      select: {
        id: true,
      },
    });

    const trackingNumber = buildEnrollmentTrackingNumber(
      targetStartYear,
      createdApplication.id,
    );
    await deps.prisma.enrollmentApplication.update({
      where: { id: createdApplication.id },
      data: { trackingNumber },
    });

    await deps.prisma.learner.update({
      where: { id: learnerId },
      data: { promotionStatus: eosyStatus },
    });

    existingTargetLearnerIds.add(learnerId);
    summary.createdApplications += 1;
  }

  return summary;
}

export function createSchoolYearAdminController(
  deps: SchoolYearControllerDeps = createSchoolYearControllerDeps(),
) {
  async function createSchoolYear(req: Request, res: Response): Promise<void> {
    const { yearLabel, classOpeningDate, classEndDate, cloneFromId, termFormat } = req.body;

    const parsedOpeningDate = parseDateInput(classOpeningDate);
    if (!parsedOpeningDate) {
      res.status(400).json({ message: "A valid classOpeningDate is required" });
      return;
    }

    const normalizedOpeningDate =
      deps.normalizeDateToUtcNoon(parsedOpeningDate);
    const openingYear = normalizedOpeningDate.getUTCFullYear();
    const currentManilaYear = getCurrentManilaYear();

    if (
      openingYear < currentManilaYear ||
      openingYear > currentManilaYear + 1
    ) {
      res.status(400).json({
        message: `Class opening year must be within ${currentManilaYear} and ${currentManilaYear + 1}`,
      });
      return;
    }

    const parsedClassEndDate = classEndDate
      ? parseDateInput(classEndDate)
      : null;
    if (classEndDate && !parsedClassEndDate) {
      res.status(400).json({ message: "classEndDate must be a valid date" });
      return;
    }

    const schedule = deps.deriveSchoolYearScheduleFromOpeningDate(
      normalizedOpeningDate,
      parsedClassEndDate
        ? deps.normalizeDateToUtcNoon(parsedClassEndDate)
        : undefined,
    );

    const resolvedYearLabel = resolveRequestedYearLabel(
      yearLabel,
      schedule.yearLabel,
    );

    const existing = await deps.prisma.schoolYear.findUnique({
      where: { yearLabel: resolvedYearLabel },
    });
    if (existing && existing.status !== "DRAFT") {
      res
        .status(400)
        .json({ message: "A school year with this label already exists" });
      return;
    }

    await deps.prisma.schoolYear.updateMany({
      where: { status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });

    const normalizedCloneFromId =
      cloneFromId === null || cloneFromId === undefined
        ? null
        : Number(cloneFromId);

    const year = await deps.prisma.schoolYear.upsert({
      where: { yearLabel: resolvedYearLabel },
      update: {
        status: "ACTIVE",
        classOpeningDate: schedule.classOpeningDate,
        classEndDate: schedule.classEndDate,
        enrollOpenDate: schedule.enrollOpenDate,
        enrollCloseDate: schedule.enrollCloseDate,
        term1Start: schedule.term1Start,
        term1End: schedule.term1End,
        term2Start: schedule.term2Start,
        term2End: schedule.term2End,
        term3Start: schedule.term3Start,
        term3End: schedule.term3End,
        termFormat: termFormat ?? "TRIMESTER",
        clonedFromId: normalizedCloneFromId,
      },
      create: {
        yearLabel: resolvedYearLabel,
        status: "ACTIVE",
        classOpeningDate: schedule.classOpeningDate,
        classEndDate: schedule.classEndDate,
        enrollOpenDate: schedule.enrollOpenDate,
        enrollCloseDate: schedule.enrollCloseDate,
        term1Start: schedule.term1Start,
        term1End: schedule.term1End,
        term2Start: schedule.term2Start,
        term2End: schedule.term2End,
        term3Start: schedule.term3Start,
        term3End: schedule.term3End,
        termFormat: termFormat ?? "TRIMESTER",
        clonedFromId: normalizedCloneFromId,
      },
    });

    await setActiveSchoolYear(deps, year.id);

    if (normalizedCloneFromId) {
      await cloneSchoolYearStructure(deps, normalizedCloneFromId, year.id);
    }

    await ensureDefaultGradeLevels(deps);

    await deps.auditLog({
      userId: req.user!.userId,
      actionType: "SY_CREATED",
      description: `Created and activated school year "${resolvedYearLabel}"${normalizedCloneFromId ? ` (cloned from ID ${normalizedCloneFromId})` : ""}`,
      subjectType: "SchoolYear",
      recordId: year.id,
      req,
    });

    const full = await deps.prisma.schoolYear.findUnique({
      where: { id: year.id },
      include: {
        sections: {
          orderBy: [
            { gradeLevel: { displayOrder: "asc" } },
            { sortOrder: "asc" },
          ],
          include: { gradeLevel: true },
        },
        _count: {
          select: {
            enrollmentApplications: true,
            enrollmentRecords: true,
          },
        },
      },
    });

    res.status(201).json({ year: full });
  }

  async function rolloverSchoolYear(
    req: Request,
    res: Response,
  ): Promise<void> {
    const {
      yearLabel,
      classOpeningDate,
      classEndDate,
      cloneStructure = true,
      carryOverLearners = true,
      pin,
      termFormat,
    } = req.body;

    const adminPin = process.env.ADMIN_BOSY_LOCK_PIN || "123456";
    if (!pin || pin !== adminPin) {
      res.status(403).json({ message: "Invalid Security PIN. Rollover aborted." });
      return;
    }

    const parsedOpeningDate = parseDateInput(classOpeningDate);
    if (!parsedOpeningDate) {
      res.status(400).json({ message: "A valid classOpeningDate is required" });
      return;
    }

    const normalizedOpeningDate =
      deps.normalizeDateToUtcNoon(parsedOpeningDate);
    const openingYear = normalizedOpeningDate.getUTCFullYear();
    const currentManilaYear = getCurrentManilaYear();

    if (
      openingYear < currentManilaYear ||
      openingYear > currentManilaYear + 1
    ) {
      res.status(400).json({
        message: `Class opening year must be within ${currentManilaYear} and ${currentManilaYear + 1}`,
      });
      return;
    }

    const parsedClassEndDate = classEndDate
      ? parseDateInput(classEndDate)
      : null;
    if (classEndDate && !parsedClassEndDate) {
      res.status(400).json({ message: "classEndDate must be a valid date" });
      return;
    }

    const schedule = deps.deriveSchoolYearScheduleFromOpeningDate(
      normalizedOpeningDate,
      parsedClassEndDate
        ? deps.normalizeDateToUtcNoon(parsedClassEndDate)
        : undefined,
    );

    const resolvedYearLabel = resolveRequestedYearLabel(
      yearLabel,
      schedule.yearLabel,
    );

    const existingTargetYear = await deps.prisma.schoolYear.findUnique({
      where: { yearLabel: resolvedYearLabel },
      select: { id: true, status: true },
    });
    if (existingTargetYear && existingTargetYear.status !== "DRAFT") {
      res
        .status(400)
        .json({ message: "A school year with this label already exists" });
      return;
    }

    const schoolSetting = await deps.prisma.schoolSetting.findFirst({
      select: {
        activeSchoolYearId: true,
      },
    });

    let activeYear = null;
    if (schoolSetting?.activeSchoolYearId) {
      activeYear = await deps.prisma.schoolYear.findUnique({
        where: { id: schoolSetting.activeSchoolYearId },
        select: { id: true, yearLabel: true, isEosyFinalized: true },
      });
    }

    if (!activeYear) {
      activeYear = await deps.prisma.schoolYear.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: { id: true, yearLabel: true, isEosyFinalized: true },
      });
    }

    if (!activeYear) {
      res.status(422).json({
        message:
          "No active school year found. Use School Year initialization instead.",
      });
      return;
    }

    if (!activeYear.isEosyFinalized) {
      res.status(422).json({
        message:
          "Active school year must be EOSY-finalized before rollover can proceed.",
      });
      return;
    }

    const irregularBlockerCount = await deps.prisma.enrollmentRecord.count({
      where: {
        schoolYearId: activeYear.id,
        eosyStatus: "CONDITIONALLY_PROMOTED",
      },
    });

    if (irregularBlockerCount > 0) {
      res.status(422).json({
        message: `Cannot roll over: ${irregularBlockerCount} learner(s) remain CONDITIONALLY_PROMOTED. Resolve their remedial results in the EOSY module first.`,
      });
      return;
    }

    await deps.prisma.schoolYear.updateMany({
      where: { status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });

    const newYear = await deps.prisma.schoolYear.upsert({
      where: { yearLabel: resolvedYearLabel },
      update: {
        status: "ACTIVE",
        classOpeningDate: schedule.classOpeningDate,
        classEndDate: schedule.classEndDate,
        enrollOpenDate: schedule.enrollOpenDate,
        enrollCloseDate: schedule.enrollCloseDate,
        term1Start: schedule.term1Start,
        term1End: schedule.term1End,
        term2Start: schedule.term2Start,
        term2End: schedule.term2End,
        term3Start: schedule.term3Start,
        term3End: schedule.term3End,
        termFormat: termFormat ?? "TRIMESTER",
        clonedFromId: activeYear.id,
      },
      create: {
        yearLabel: resolvedYearLabel,
        status: "ACTIVE",
        classOpeningDate: schedule.classOpeningDate,
        classEndDate: schedule.classEndDate,
        enrollOpenDate: schedule.enrollOpenDate,
        enrollCloseDate: schedule.enrollCloseDate,
        term1Start: schedule.term1Start,
        term1End: schedule.term1End,
        term2Start: schedule.term2Start,
        term2End: schedule.term2End,
        term3Start: schedule.term3Start,
        term3End: schedule.term3End,
        termFormat: termFormat ?? "TRIMESTER",
        clonedFromId: activeYear.id,
      },
    });

    await setActiveSchoolYear(deps, newYear.id);

    if (cloneStructure) {
      await cloneSchoolYearStructure(deps, activeYear.id, newYear.id);
    }

    await ensureDefaultGradeLevels(deps);

    const rolloverSummary = carryOverLearners
      ? await carryOverEligibleLearners(
          deps,
          activeYear.id,
          newYear.id,
          parseStartYearFromLabel(resolvedYearLabel),
          req.user?.userId ?? null,
        )
      : null;

    await deps.auditLog({
      userId: req.user!.userId,
      actionType: "SY_ROLLOVER_COMPLETED",
      description: `Rolled over school year from "${activeYear.yearLabel}" to "${resolvedYearLabel}"${carryOverLearners && rolloverSummary ? ` with ${rolloverSummary.createdApplications} carried learner application(s)` : ""}`,
      subjectType: "SchoolYear",
      recordId: newYear.id,
      req,
    });

    const full = await deps.prisma.schoolYear.findUnique({
      where: { id: newYear.id },
      include: {
        sections: {
          orderBy: [
            { gradeLevel: { displayOrder: "asc" } },
            { sortOrder: "asc" },
          ],
          include: { gradeLevel: true },
        },
        _count: {
          select: {
            enrollmentApplications: true,
            enrollmentRecords: true,
          },
        },
      },
    });

    res.status(201).json({
      year: full,
      rolloverFrom: {
        id: activeYear.id,
        yearLabel: activeYear.yearLabel,
      },
      rolloverSummary,
    });
  }

  async function updateRolloverDraft(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { yearLabel, classOpeningDate, classEndDate } = req.body;

    const parsedOpeningDate = parseDateInput(classOpeningDate);
    if (!parsedOpeningDate) {
      res.status(400).json({ message: "A valid classOpeningDate is required" });
      return;
    }

    const normalizedOpeningDate =
      deps.normalizeDateToUtcNoon(parsedOpeningDate);
    const openingYear = normalizedOpeningDate.getUTCFullYear();
    const currentManilaYear = getCurrentManilaYear();

    if (
      openingYear < currentManilaYear ||
      openingYear > currentManilaYear + 1
    ) {
      res.status(400).json({
        message: `Class opening year must be within ${currentManilaYear} and ${currentManilaYear + 1}`,
      });
      return;
    }

    const parsedClassEndDate = classEndDate
      ? parseDateInput(classEndDate)
      : null;
    if (classEndDate && !parsedClassEndDate) {
      res.status(400).json({ message: "classEndDate must be a valid date" });
      return;
    }

    const schedule = deps.deriveSchoolYearScheduleFromOpeningDate(
      normalizedOpeningDate,
      parsedClassEndDate
        ? deps.normalizeDateToUtcNoon(parsedClassEndDate)
        : undefined,
    );

    const resolvedYearLabel = resolveRequestedYearLabel(
      yearLabel,
      schedule.yearLabel,
    );

    let activeYear = null;
    const schoolSetting = await deps.prisma.schoolSetting.findFirst({
      select: { activeSchoolYearId: true },
    });

    if (schoolSetting?.activeSchoolYearId) {
      activeYear = await deps.prisma.schoolYear.findUnique({
        where: { id: schoolSetting.activeSchoolYearId },
        select: { id: true, yearLabel: true },
      });
    }

    if (!activeYear) {
      activeYear = await deps.prisma.schoolYear.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: { id: true, yearLabel: true },
      });
    }

    if (activeYear && resolvedYearLabel === activeYear.yearLabel) {
      res.status(400).json({
        message:
          "Next school year label must be different from active school year.",
      });
      return;
    }

    const existingTargetYear = await deps.prisma.schoolYear.findUnique({
      where: { yearLabel: resolvedYearLabel },
      select: { id: true, status: true },
    });

    if (
      existingTargetYear &&
      existingTargetYear.id !== activeYear?.id &&
      existingTargetYear.status !== "DRAFT"
    ) {
      res
        .status(400)
        .json({ message: "A school year with this label already exists" });
      return;
    }

    const draft = await deps.prisma.schoolYear.upsert({
      where: { yearLabel: resolvedYearLabel },
      update: {
        classOpeningDate: schedule.classOpeningDate,
        classEndDate: schedule.classEndDate,
        enrollOpenDate: schedule.enrollOpenDate,
        enrollCloseDate: schedule.enrollCloseDate,
        term1Start: schedule.term1Start,
        term1End: schedule.term1End,
        term2Start: schedule.term2Start,
        term2End: schedule.term2End,
        term3Start: schedule.term3Start,
        term3End: schedule.term3End,
        status: "DRAFT",
      },
      create: {
        yearLabel: resolvedYearLabel,
        status: "DRAFT",
        classOpeningDate: schedule.classOpeningDate,
        classEndDate: schedule.classEndDate,
        enrollOpenDate: schedule.enrollOpenDate,
        enrollCloseDate: schedule.enrollCloseDate,
        term1Start: schedule.term1Start,
        term1End: schedule.term1End,
        term2Start: schedule.term2Start,
        term2End: schedule.term2End,
        term3Start: schedule.term3Start,
        term3End: schedule.term3End,
        clonedFromId: activeYear?.id ?? null,
      },
    });

    res.json({
      rolloverDraft: draft,
    });
  }



  async function updateDates(req: Request, res: Response): Promise<void> {
    const id = parseSchoolYearId(req);
    const {
      classOpeningDate,
      classEndDate,
      enrollOpenDate,
      enrollCloseDate,
    } = req.body;

    const existingYear = await deps.prisma.schoolYear.findUnique({
      where: { id },
      select: {
        id: true,
        yearLabel: true,
        classOpeningDate: true,
        classEndDate: true,
        enrollOpenDate: true,
        enrollCloseDate: true,
      },
    });

    if (!existingYear) {
      res.status(404).json({ message: "School year not found" });
      return;
    }

    const parsedClassOpeningDate =
      classOpeningDate !== undefined ? parseDateInput(classOpeningDate) : null;
    if (classOpeningDate !== undefined && !parsedClassOpeningDate) {
      res
        .status(400)
        .json({ message: "classOpeningDate must be a valid date" });
      return;
    }

    const parsedClassEndDate =
      classEndDate !== undefined ? parseDateInput(classEndDate) : null;
    if (classEndDate !== undefined && !parsedClassEndDate) {
      res.status(400).json({ message: "classEndDate must be a valid date" });
      return;
    }

    const nextClassOpeningDate =
      classOpeningDate !== undefined
        ? deps.normalizeDateToUtcNoon(parsedClassOpeningDate!)
        : existingYear.classOpeningDate;

    const nextClassEndDate =
      classEndDate !== undefined
        ? deps.normalizeDateToUtcNoon(parsedClassEndDate!)
        : existingYear.classEndDate;

    if (classOpeningDate !== undefined || classEndDate !== undefined) {
      if (nextClassOpeningDate && nextClassEndDate) {
        if (nextClassEndDate.getTime() <= nextClassOpeningDate.getTime()) {
          res.status(400).json({
            message: "End of School Year must be later than Start of Classes.",
          });
          return;
        }

        const activeCalendarSpanDays = Math.floor(
          (nextClassEndDate.getTime() - nextClassOpeningDate.getTime()) /
            DAY_IN_MS,
        );
        if (activeCalendarSpanDays < MIN_ACTIVE_CALENDAR_SPAN_DAYS) {
          res.status(400).json({
            message:
              "End of School Year must be at least 240 days after Start of Classes.",
          });
          return;
        }
      }
    }

    const nextEnrollOpenDate =
      enrollOpenDate !== undefined
        ? enrollOpenDate
          ? deps.normalizeDateToUtcNoon(new Date(enrollOpenDate))
          : null
        : existingYear.enrollOpenDate;

    const nextEnrollCloseDate =
      enrollCloseDate !== undefined
        ? enrollCloseDate
          ? deps.normalizeDateToUtcNoon(new Date(enrollCloseDate))
          : null
        : existingYear.enrollCloseDate;

    if (nextEnrollOpenDate && nextEnrollCloseDate) {
      if (nextEnrollCloseDate.getTime() < nextEnrollOpenDate.getTime()) {
        res.status(400).json({
          message:
            "Official Enrollment close date cannot be earlier than its open date.",
        });
        return;
      }
    }

    const updated = await deps.prisma.schoolYear.update({
      where: { id },
      data: {
        ...(classOpeningDate !== undefined
          ? {
              classOpeningDate: nextClassOpeningDate,
            }
          : {}),
        ...(classEndDate !== undefined
          ? {
              classEndDate: nextClassEndDate,
            }
          : {}),
        ...(enrollOpenDate !== undefined
          ? {
              enrollOpenDate: enrollOpenDate
                ? deps.normalizeDateToUtcNoon(new Date(enrollOpenDate))
                : null,
            }
          : {}),
        ...(enrollCloseDate !== undefined
          ? {
              enrollCloseDate: enrollCloseDate
                ? deps.normalizeDateToUtcNoon(new Date(enrollCloseDate))
                : null,
            }
          : {}),
      },
    });

    const isCalendarDateUpdate =
      classOpeningDate !== undefined || classEndDate !== undefined;

    res.json({ year: updated });
  }

  async function updateSchoolYear(req: Request, res: Response): Promise<void> {
    const id = parseSchoolYearId(req);
    const { yearLabel, term1Start, term1End, term2Start, term2End, term3Start, term3End, term4Start, term4End, classOpeningDate, classEndDate, termFormat } = req.body;

    const year = await deps.prisma.schoolYear.findUnique({ where: { id } });
    if (!year) {
      res.status(404).json({ message: "School year not found" });
      return;
    }

    if (year.status === "ARCHIVED") {
      res.status(400).json({ message: "Cannot edit an archived school year" });
      return;
    }

    const updated = await deps.prisma.schoolYear.update({
      where: { id },
      data: {
        ...(yearLabel ? { yearLabel } : {}),
        ...(classOpeningDate ? { classOpeningDate: new Date(classOpeningDate) } : {}),
        ...(classOpeningDate !== undefined ? { classOpeningDate: classOpeningDate ? deps.normalizeDateToUtcNoon(new Date(classOpeningDate)) : year.classOpeningDate } : {}),
        ...(classEndDate !== undefined ? { classEndDate: classEndDate ? deps.normalizeDateToUtcNoon(new Date(classEndDate)) : year.classEndDate } : {}),
        ...(term1Start !== undefined ? { term1Start: term1Start ? deps.normalizeDateToUtcNoon(new Date(term1Start)) : null } : {}),
        ...(term1End !== undefined ? { term1End: term1End ? deps.normalizeDateToUtcNoon(new Date(term1End)) : null } : {}),
        ...(term2Start !== undefined ? { term2Start: term2Start ? deps.normalizeDateToUtcNoon(new Date(term2Start)) : null } : {}),
        ...(term2End !== undefined ? { term2End: term2End ? deps.normalizeDateToUtcNoon(new Date(term2End)) : null } : {}),
        ...(term3Start !== undefined ? { term3Start: term3Start ? deps.normalizeDateToUtcNoon(new Date(term3Start)) : null } : {}),
        ...(term3End !== undefined ? { term3End: term3End ? deps.normalizeDateToUtcNoon(new Date(term3End)) : null } : {}),
        ...(term4Start !== undefined ? { term4Start: term4Start ? deps.normalizeDateToUtcNoon(new Date(term4Start)) : null } : {}),
        ...(term4End !== undefined ? { term4End: term4End ? deps.normalizeDateToUtcNoon(new Date(term4End)) : null } : {}),
        ...(termFormat !== undefined ? { termFormat } : {}),
      },
    });

    const isTermDateUpdate =
      yearLabel !== undefined ||
      term1Start !== undefined || term1End !== undefined ||
      term2Start !== undefined || term2End !== undefined ||
      term3Start !== undefined || term3End !== undefined ||
      term4Start !== undefined || term4End !== undefined;

    const isCalendarDateUpdate = classOpeningDate !== undefined || classEndDate !== undefined;
    const isYearLabelUpdate = yearLabel !== undefined;

    res.json({ year: updated });
  }

  async function updateAssessmentConfig(
    req: Request,
    res: Response,
  ): Promise<void> {
    const id = parseSchoolYearId(req);
    const { requireReadingAssessmentNew, requireReadingAssessmentContinuing } =
      req.body;

    const year = await deps.prisma.schoolYear.findUnique({ where: { id } });
    if (!year) {
      res.status(404).json({ message: "School year not found" });
      return;
    }

    const updated = await deps.prisma.schoolYear.update({
      where: { id },
      data: { requireReadingAssessmentNew, requireReadingAssessmentContinuing },
    });

    res.json({ year: updated });
  }

  return {
    createSchoolYear,
    rolloverSchoolYear,
    updateRolloverDraft,
    updateDates,
    updateSchoolYear,
    updateAssessmentConfig,
  };
}

const schoolYearAdminController = createSchoolYearAdminController();

export const {
  createSchoolYear,
  rolloverSchoolYear,
  updateRolloverDraft,
  updateDates,
  updateSchoolYear,
  updateAssessmentConfig,
} = schoolYearAdminController;
