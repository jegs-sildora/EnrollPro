import {
  ensureDefaultGradeLevels,
  setActiveSchoolYear,
  getCurrentManilaYear,
  parseDateInput,
} from "../services/school-year-controller-shared.service.js";

import { normalizeDateToUtcNoon, deriveSchoolYearScheduleFromOpeningDate } from "../school-year.service.js";
import { prisma } from "../../../lib/prisma.js";
import type { Request, Response } from "express";
import {
  executeSchoolYearRollover,
  RolloverNotReadyError,
} from "../services/school-year-rollover.service.js";
import {
  broadcastRolloverInvalidation,
  broadcastSchoolYearInvalidation,
} from "../../../lib/realtime-events.js";



function parseSchoolYearId(req: Request): number {
  return Number.parseInt(String(req.params.id ?? ""), 10);
}

const MIN_ACTIVE_CALENDAR_SPAN_DAYS = 240;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function isSerializableWriteConflict(
  error: unknown,
): error is Error & { code: "P2034" } {
  return error instanceof Error
    && "code" in error
    && error.code === "P2034";
}

function resolveRequestedYearLabel(
  requestedYearLabel: unknown,
  fallbackYearLabel: string): string {
  if (typeof requestedYearLabel !== "string") {
    return fallbackYearLabel;
  }

  const trimmedYearLabel = requestedYearLabel.trim();
  return trimmedYearLabel.length > 0 ? trimmedYearLabel : fallbackYearLabel;
}

function nextYearLabel(yearLabel: string): string | null {
  const match = /^(\d{4})-(\d{4})$/.exec(yearLabel);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return end === start + 1 ? `${start + 1}-${end + 1}` : null;
}

function requiredCalendarDate(value: unknown, label: string): Date {
  const parsed = value instanceof Date ? value : parseDateInput(value);
  if (!parsed) {
    throw new Error(`${label} must be a valid date.`);
  }
  return normalizeDateToUtcNoon(parsed);
}

  export async function createSchoolYear(req: Request, res: Response): Promise<void> {
    const { yearLabel, classOpeningDate, classEndDate, cloneFromId, termFormat } = req.body;

    const [schoolYearCount, settings] = await Promise.all([
      prisma.schoolYear.count(),
      prisma.schoolSetting.findMany({
        take: 2,
        orderBy: { id: "asc" },
        select: { id: true, activeSchoolYearId: true },
      }),
    ]);
    if (settings.length !== 1) {
      res.status(409).json({
        code: "SCHOOL_SETTINGS_CONFLICT",
        message:
          "Exactly one school settings record is required before the first school year can be activated.",
      });
      return;
    }
    const setting = settings[0]!;
    if (schoolYearCount > 0 || setting?.activeSchoolYearId) {
      res.status(409).json({
        code: "ROLLOVER_REQUIRED",
        message:
          "School year activation is only available during first-time setup. Use the approved rollover process for the next school year.",
      });
      return;
    }
    if (cloneFromId) {
      res.status(400).json({
        message:
          "First-time setup cannot clone a previous school year.",
      });
      return;
    }

    const parsedOpeningDate = parseDateInput(classOpeningDate);
    if (!parsedOpeningDate) {
      res.status(400).json({ message: "A valid classOpeningDate is required" });
      return;
    }

    const normalizedOpeningDate =
      normalizeDateToUtcNoon(parsedOpeningDate);
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

    const schedule = deriveSchoolYearScheduleFromOpeningDate(
      normalizedOpeningDate,
      parsedClassEndDate
        ? normalizeDateToUtcNoon(parsedClassEndDate)
        : undefined);

    const resolvedYearLabel = resolveRequestedYearLabel(
      yearLabel,
      schedule.yearLabel);

    const existing = await prisma.schoolYear.findUnique({
      where: { yearLabel: resolvedYearLabel },
    });
    if (existing && existing.status !== "ARCHIVED") {
      res
        .status(400)
        .json({ message: "A school year with this label already exists" });
      return;
    }

    const year = await prisma.schoolYear.create({
      data: {
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
      },
    });

    await setActiveSchoolYear(setting.id, year.id);

    await ensureDefaultGradeLevels();

    await prisma.auditLog.create({ data: { ipAddress: req.ip || "unknown", userAgent: req.headers["user-agent"] || null, userId: req.user!.userId,
      actionType: "SY_CREATED",
      description: `Created and activated initial school year "${resolvedYearLabel}"`,
      subjectType: "SchoolYear",
      recordId: year.id,
      } });

    const full = await prisma.schoolYear.findUnique({
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

    broadcastSchoolYearInvalidation(year.id);

    res.status(201).json({ year: full });
  }

  export async function rolloverSchoolYear(
    req: Request,
    res: Response): Promise<void> {
    const {
      sourceSchoolYearId,
    } = req.body;

    try {
      const result = await executeSchoolYearRollover({
        sourceSchoolYearId,
        actingUserId: req.user!.userId,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] ?? null,
      });

      const rolloverAt = new Date().toISOString()
      broadcastRolloverInvalidation({
        sourceSchoolYearId: result.rolloverFrom.id,
        activeSchoolYearId: result.year.id,
        rolloverAt,
        eventRevision: `${result.rolloverFrom.id}:${result.year.id}:${rolloverAt}`,
      })

      res.status(201).json(result);
    } catch (error: unknown) {
      if (error instanceof RolloverNotReadyError) {
        res.status(422).json({
          code: error.code,
          message: error.message,
          ...error.readiness,
        });
        return;
      }
      if (isSerializableWriteConflict(error)) {
        res.status(409).json({
          code: "ROLLOVER_CONFLICT",
          message:
            "Another school year rollover was completed at the same time. Refresh the active school year before trying again.",
        });
        return;
      }
      throw error;
    }
  }

  export async function prepareNextSchoolYear(
    req: Request,
    res: Response,
  ): Promise<void> {
    const {
      sourceSchoolYearId,
      yearLabel,
      classOpeningDate,
      classEndDate,
      enrollOpenDate,
      enrollCloseDate,
      term1Start,
      term1End,
      term2Start,
      term2End,
      term3Start,
      term3End,
      term4Start,
      term4End,
      termFormat,
    } = req.body;

    const [sourceYear, settings, activeYears] = await Promise.all([
      prisma.schoolYear.findUnique({
        where: { id: sourceSchoolYearId },
        select: { id: true, yearLabel: true, status: true },
      }),
      prisma.schoolSetting.findMany({
        select: { activeSchoolYearId: true },
        take: 2,
      }),
      prisma.schoolYear.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      }),
    ]);
    const setting = settings.length === 1 ? settings[0] : null;
    if (!sourceYear || sourceYear.status !== "ACTIVE") {
      res.status(409).json({ message: "The source school year is not active." });
      return;
    }
    if (
      settings.length !== 1
      || setting?.activeSchoolYearId !== sourceYear.id
      || activeYears.length !== 1
      || activeYears[0]?.id !== sourceYear.id
    ) {
      res.status(409).json({
        code: "ACTIVE_SCHOOL_YEAR_CONFLICT",
        message: "Resolve the active school year conflict before preparing the next calendar.",
      });
      return;
    }
    const expectedLabel = nextYearLabel(sourceYear.yearLabel);
    if (!expectedLabel || yearLabel !== expectedLabel) {
      res.status(400).json({
        message: `The next school year must be ${expectedLabel ?? "a consecutive YYYY-YYYY label"}.`,
      });
      return;
    }

    let calendar: {
      classOpeningDate: Date;
      classEndDate: Date;
      enrollOpenDate: Date;
      enrollCloseDate: Date;
      term1Start: Date;
      term1End: Date;
      term2Start: Date;
      term2End: Date;
      term3Start: Date;
      term3End: Date;
      term4Start: Date | null;
      term4End: Date | null;
    };
    try {
      calendar = {
        classOpeningDate: requiredCalendarDate(classOpeningDate, "Start of classes"),
        classEndDate: requiredCalendarDate(classEndDate, "End of classes"),
        enrollOpenDate: requiredCalendarDate(enrollOpenDate, "Enrollment opening"),
        enrollCloseDate: requiredCalendarDate(enrollCloseDate, "Enrollment closing"),
        term1Start: requiredCalendarDate(term1Start, "Term 1 start"),
        term1End: requiredCalendarDate(term1End, "Term 1 end"),
        term2Start: requiredCalendarDate(term2Start, "Term 2 start"),
        term2End: requiredCalendarDate(term2End, "Term 2 end"),
        term3Start: requiredCalendarDate(term3Start, "Term 3 start"),
        term3End: requiredCalendarDate(term3End, "Term 3 end"),
        term4Start: term4Start
          ? requiredCalendarDate(term4Start, "Term 4 start")
          : null,
        term4End: term4End
          ? requiredCalendarDate(term4End, "Term 4 end")
          : null,
      };
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "The calendar is invalid.",
      });
      return;
    }
    const orderedDates = [
      calendar.classOpeningDate,
      calendar.term1Start,
      calendar.term1End,
      calendar.term2Start,
      calendar.term2End,
      calendar.term3Start,
      calendar.term3End,
      ...(termFormat === "QUARTERS" && calendar.term4Start && calendar.term4End
        ? [calendar.term4Start, calendar.term4End]
        : []),
      calendar.classEndDate,
    ];
    if (
      orderedDates.some((date, index) => (
        index > 0 && date.getTime() < orderedDates[index - 1]!.getTime()
      ))
      || calendar.enrollCloseDate < calendar.enrollOpenDate
    ) {
      res.status(400).json({
        message: "Calendar dates must be complete and in chronological order.",
      });
      return;
    }

    const existing = await prisma.schoolYear.findUnique({
      where: { yearLabel },
      select: {
        id: true,
        status: true,
        clonedFromId: true,
        _count: {
          select: {
            sections: true,
            enrollmentApplications: true,
            enrollmentRecords: true,
            enrollmentHistories: true,
            sectionAdvisers: true,
            teacherDesignations: true,
            teacherSchedulePeriods: true,
            healthRecords: true,
            schoolFormArtifacts: true,
          },
        },
      },
    });
    const operationalCount = existing
      ? Object.values(existing._count).reduce((sum, value) => sum + value, 0)
      : 0;
    if (
      existing
      && (existing.status === "ACTIVE"
        || operationalCount > 0
        || (existing.clonedFromId !== null
          && existing.clonedFromId !== sourceYear.id))
    ) {
      res.status(409).json({
        message: "The incoming school year already contains operational records.",
      });
      return;
    }

    const target = existing
      ? await prisma.schoolYear.update({
          where: { id: existing.id },
          data: {
            ...calendar,
            termFormat,
            status: "ARCHIVED",
            isEosyFinalized: false,
          },
        })
      : await prisma.schoolYear.create({
          data: {
            yearLabel,
            ...calendar,
            termFormat,
            status: "ARCHIVED",
          },
        });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        actionType: "SY_TARGET_CALENDAR_PREPARED",
        description: `Prepared the reviewed calendar for ${target.yearLabel}.`,
        subjectType: "SchoolYear",
        recordId: target.id,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] ?? null,
      },
    });
    broadcastSchoolYearInvalidation(target.id);
    res.status(existing ? 200 : 201).json({ year: target });
  }

  export async function updateDates(req: Request, res: Response): Promise<void> {
    const id = parseSchoolYearId(req);
    const {
      classOpeningDate,
      classEndDate,
      enrollOpenDate,
      enrollCloseDate,
    } = req.body;

    const existingYear = await prisma.schoolYear.findUnique({
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
        ? normalizeDateToUtcNoon(parsedClassOpeningDate!)
        : existingYear.classOpeningDate;

    const nextClassEndDate =
      classEndDate !== undefined
        ? normalizeDateToUtcNoon(parsedClassEndDate!)
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
            DAY_IN_MS);
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
          ? normalizeDateToUtcNoon(new Date(enrollOpenDate))
          : null
        : existingYear.enrollOpenDate;

    const nextEnrollCloseDate =
      enrollCloseDate !== undefined
        ? enrollCloseDate
          ? normalizeDateToUtcNoon(new Date(enrollCloseDate))
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

    const updated = await prisma.schoolYear.update({
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
                ? normalizeDateToUtcNoon(new Date(enrollOpenDate))
                : null,
            }
          : {}),
        ...(enrollCloseDate !== undefined
          ? {
              enrollCloseDate: enrollCloseDate
                ? normalizeDateToUtcNoon(new Date(enrollCloseDate))
                : null,
            }
          : {}),
      },
    });

    const isCalendarDateUpdate =
      classOpeningDate !== undefined || classEndDate !== undefined;

    broadcastSchoolYearInvalidation(updated.id);

    res.json({ year: updated });
  }

  export async function updateSchoolYear(req: Request, res: Response): Promise<void> {
    const id = parseSchoolYearId(req);
    const { yearLabel, term1Start, term1End, term2Start, term2End, term3Start, term3End, term4Start, term4End, classOpeningDate, classEndDate, termFormat, enrollOpenDate, enrollCloseDate } = req.body;

    const year = await prisma.schoolYear.findUnique({ where: { id } });
    if (!year) {
      res.status(404).json({ message: "School year not found" });
      return;
    }

    if (year.status === "ARCHIVED") {
      res.status(400).json({ message: "Cannot edit an archived school year" });
      return;
    }

    const updated = await prisma.schoolYear.update({
      where: { id },
      data: {
        ...(yearLabel ? { yearLabel } : {}),
        ...(classOpeningDate ? { classOpeningDate: new Date(classOpeningDate) } : {}),
        ...(classOpeningDate !== undefined ? { classOpeningDate: classOpeningDate ? normalizeDateToUtcNoon(new Date(classOpeningDate)) : year.classOpeningDate } : {}),
        ...(classEndDate !== undefined ? { classEndDate: classEndDate ? normalizeDateToUtcNoon(new Date(classEndDate)) : year.classEndDate } : {}),
        ...(term1Start !== undefined ? { term1Start: term1Start ? normalizeDateToUtcNoon(new Date(term1Start)) : null } : {}),
        ...(term1End !== undefined ? { term1End: term1End ? normalizeDateToUtcNoon(new Date(term1End)) : null } : {}),
        ...(term2Start !== undefined ? { term2Start: term2Start ? normalizeDateToUtcNoon(new Date(term2Start)) : null } : {}),
        ...(term2End !== undefined ? { term2End: term2End ? normalizeDateToUtcNoon(new Date(term2End)) : null } : {}),
        ...(term3Start !== undefined ? { term3Start: term3Start ? normalizeDateToUtcNoon(new Date(term3Start)) : null } : {}),
        ...(term3End !== undefined ? { term3End: term3End ? normalizeDateToUtcNoon(new Date(term3End)) : null } : {}),
        ...(term4Start !== undefined ? { term4Start: term4Start ? normalizeDateToUtcNoon(new Date(term4Start)) : null } : {}),
        ...(term4End !== undefined ? { term4End: term4End ? normalizeDateToUtcNoon(new Date(term4End)) : null } : {}),
        ...(termFormat !== undefined ? { termFormat } : {}),
        ...(enrollOpenDate !== undefined ? { enrollOpenDate: enrollOpenDate ? normalizeDateToUtcNoon(new Date(enrollOpenDate)) : null } : {}),
        ...(enrollCloseDate !== undefined ? { enrollCloseDate: enrollCloseDate ? normalizeDateToUtcNoon(new Date(enrollCloseDate)) : null } : {}),
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

    broadcastSchoolYearInvalidation(updated.id);

    res.json({ year: updated });
  }

