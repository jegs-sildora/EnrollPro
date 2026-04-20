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

const EOSY_SKIP_OUTCOMES = new Set(["DROPPED_OUT", "TRANSFERRED_OUT"]);
const EOSY_RETAINED_OUTCOMES = new Set(["RETAINED", "IRREGULAR"]);
const MIN_ACTIVE_CALENDAR_SPAN_DAYS = 240;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface RolloverSummary {
  processedRecords: number;
  createdApplications: number;
  skippedByEosyOutcome: number;
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
  return `F2F-ENR-${startYear}-${String(enrollmentApplicationId).padStart(5, "0")}`;
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
            status: { in: ["OFFICIALLY_ENROLLED", "ENROLLED"] },
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
        where: { schoolYearId: targetSchoolYearId },
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

    const eosyStatus = record.eosyStatus ?? "PROMOTED";
    if (EOSY_SKIP_OUTCOMES.has(eosyStatus)) {
      summary.skippedByEosyOutcome += 1;
      continue;
    }

    const sourceDisplayOrder = record.section.gradeLevel.displayOrder;
    const targetDisplayOrder =
      eosyStatus === "PROMOTED" ? sourceDisplayOrder + 1 : sourceDisplayOrder;
    const targetGradeLevel =
      targetGradeLevelByDisplayOrder.get(targetDisplayOrder) ?? null;

    if (!targetGradeLevel) {
      summary.skippedNoTargetGrade += 1;
      continue;
    }

    const createdApplication = await deps.prisma.enrollmentApplication.create({
      data: {
        learnerId,
        schoolYearId: targetSchoolYearId,
        gradeLevelId: targetGradeLevel.id,
        applicantType: record.enrollmentApplication.applicantType,
        learnerType: "CONTINUING",
        status: "READY_FOR_SECTIONING",
        admissionChannel: "F2F",
        isPrivacyConsentGiven:
          record.enrollmentApplication.isPrivacyConsentGiven,
        guardianRelationship: record.enrollmentApplication.guardianRelationship,
        hasNoMother: record.enrollmentApplication.hasNoMother,
        hasNoFather: record.enrollmentApplication.hasNoFather,
        encodedById:
          record.enrollmentApplication.encodedById ?? actingUserId ?? null,
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

    await deps.prisma.applicationChecklist.create({
      data: {
        enrollmentId: createdApplication.id,
        academicStatus: EOSY_RETAINED_OUTCOMES.has(eosyStatus)
          ? "RETAINED"
          : "PROMOTED",
        updatedById: actingUserId,
      },
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
    const { yearLabel, classOpeningDate, classEndDate, cloneFromId } = req.body;

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
    if (existing) {
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

    const year = await deps.prisma.schoolYear.create({
      data: {
        yearLabel: resolvedYearLabel,
        status: "ACTIVE",
        classOpeningDate: schedule.classOpeningDate,
        classEndDate: schedule.classEndDate,
        earlyRegOpenDate: schedule.earlyRegOpenDate,
        earlyRegCloseDate: schedule.earlyRegCloseDate,
        enrollOpenDate: schedule.enrollOpenDate,
        enrollCloseDate: schedule.enrollCloseDate,
        clonedFromId: normalizedCloneFromId,
      },
    });

    await setActiveSchoolYear(deps, year.id);

    if (normalizedCloneFromId) {
      await cloneSchoolYearStructure(deps, normalizedCloneFromId, year.id);
    }

    await ensureDefaultGradeLevels(deps, year.id);

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
        gradeLevels: { orderBy: { displayOrder: "asc" } },
        _count: {
          select: {
            earlyRegistrationApplications: true,
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
    } = req.body;

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
      select: { id: true },
    });
    if (existingTargetYear) {
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

    await deps.prisma.schoolYear.updateMany({
      where: { status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });

    const newYear = await deps.prisma.schoolYear.create({
      data: {
        yearLabel: resolvedYearLabel,
        status: "ACTIVE",
        classOpeningDate: schedule.classOpeningDate,
        classEndDate: schedule.classEndDate,
        earlyRegOpenDate: schedule.earlyRegOpenDate,
        earlyRegCloseDate: schedule.earlyRegCloseDate,
        enrollOpenDate: schedule.enrollOpenDate,
        enrollCloseDate: schedule.enrollCloseDate,
        clonedFromId: activeYear.id,
      },
    });

    await setActiveSchoolYear(deps, newYear.id);

    if (cloneStructure) {
      await cloneSchoolYearStructure(deps, activeYear.id, newYear.id);
    }

    await ensureDefaultGradeLevels(deps, newYear.id);

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
        gradeLevels: { orderBy: { displayOrder: "asc" } },
        _count: {
          select: {
            earlyRegistrationApplications: true,
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
      select: { id: true },
    });
    if (existingTargetYear && existingTargetYear.id !== activeYear?.id) {
      res
        .status(400)
        .json({ message: "A school year with this label already exists" });
      return;
    }

    res.json({
      rolloverDraft: {
        yearLabel: resolvedYearLabel,
        classOpeningDate: schedule.classOpeningDate,
        classEndDate: schedule.classEndDate,
        earlyRegOpenDate: schedule.earlyRegOpenDate,
        earlyRegCloseDate: schedule.earlyRegCloseDate,
        enrollOpenDate: schedule.enrollOpenDate,
        enrollCloseDate: schedule.enrollCloseDate,
      },
    });
  }

  async function toggleOverride(req: Request, res: Response): Promise<void> {
    const id = parseSchoolYearId(req);
    const { isManualOverrideOpen } = req.body;

    const updated = await deps.prisma.schoolYear.update({
      where: { id },
      data: { isManualOverrideOpen },
    });

    await deps.auditLog({
      userId: req.user!.userId,
      actionType: "SCHOOL_YEAR_OVERRIDE_TOGGLED",
      description: `Manual override set to ${isManualOverrideOpen ? "OPEN" : "OFF"} for year "${updated.yearLabel}"`,
      subjectType: "SchoolYear",
      recordId: id,
      req,
    });

    res.json({ year: updated });
  }

  async function updateDates(req: Request, res: Response): Promise<void> {
    const id = parseSchoolYearId(req);
    const {
      classOpeningDate,
      classEndDate,
      earlyRegOpenDate,
      earlyRegCloseDate,
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

    if (nextClassOpeningDate && nextEnrollOpenDate) {
      if (nextEnrollOpenDate.getTime() > nextClassOpeningDate.getTime()) {
        res.status(400).json({
          message: "Regular enrollment cannot open after Start of Classes.",
        });
        return;
      }
    }

    if (nextClassOpeningDate && nextEnrollCloseDate) {
      if (nextEnrollCloseDate.getTime() > nextClassOpeningDate.getTime()) {
        res.status(400).json({
          message: "Regular enrollment cannot extend past Start of Classes.",
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
        ...(earlyRegOpenDate !== undefined
          ? {
              earlyRegOpenDate: earlyRegOpenDate
                ? deps.normalizeDateToUtcNoon(new Date(earlyRegOpenDate))
                : null,
            }
          : {}),
        ...(earlyRegCloseDate !== undefined
          ? {
              earlyRegCloseDate: earlyRegCloseDate
                ? deps.normalizeDateToUtcNoon(new Date(earlyRegCloseDate))
                : null,
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

    await deps.auditLog({
      userId: req.user!.userId,
      actionType: isCalendarDateUpdate
        ? "SY_UPDATED"
        : "ENROLLMENT_DATES_UPDATED",
      description: isCalendarDateUpdate
        ? `Updated school calendar dates for "${updated.yearLabel}"`
        : `Updated enrollment dates for "${updated.yearLabel}"`,
      subjectType: "SchoolYear",
      recordId: id,
      req,
    });

    res.json({ year: updated });
  }

  async function updateSchoolYear(req: Request, res: Response): Promise<void> {
    const id = parseSchoolYearId(req);
    const { yearLabel } = req.body;

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
      },
    });

    await deps.auditLog({
      userId: req.user!.userId,
      actionType: "SY_UPDATED",
      description: `Updated school year "${updated.yearLabel}"`,
      subjectType: "SchoolYear",
      recordId: id,
      req,
    });

    res.json({ year: updated });
  }

  return {
    createSchoolYear,
    rolloverSchoolYear,
    updateRolloverDraft,
    toggleOverride,
    updateDates,
    updateSchoolYear,
  };
}

const schoolYearAdminController = createSchoolYearAdminController();

export const {
  createSchoolYear,
  rolloverSchoolYear,
  updateRolloverDraft,
  toggleOverride,
  updateDates,
  updateSchoolYear,
} = schoolYearAdminController;
