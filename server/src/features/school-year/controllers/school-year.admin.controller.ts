import {
  ensureDefaultGradeLevels,
  setActiveSchoolYear,
  getCurrentManilaYear,
  parseDateInput,
} from "../services/school-year-controller-shared.service.js";

import { normalizeDateToUtcNoon, deriveSchoolYearScheduleFromOpeningDate } from "../school-year.service.js";
import {
  buildOrderedTermContract,
  mergeStoredTermLabels,
  resolveStoredTermLabels,
  TermContractError,
  type SchoolYearTermSource,
} from "../services/term-contract.service.js";
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

function resolveTermDateInput(
  value: unknown,
  fallback: Date | null,
  label: string,
): Date | null {
  if (value === undefined) return fallback
  if (value === null || value === "") return null

  const parsed = value instanceof Date ? value : parseDateInput(value)
  if (!parsed) {
    throw new TermContractError(
      "TERM_DATE_RANGE_INVALID",
      `${label} must be a valid date.`,
    )
  }
  return normalizeDateToUtcNoon(parsed)
}

function sendTermContractMutationError(
  res: Response,
  error: unknown,
): boolean {
  if (!(error instanceof TermContractError)) return false

  res.status(400).json({
    code: error.code,
    message: error.message,
  })
  return true
}

  export async function createSchoolYear(req: Request, res: Response): Promise<void> {
    const {
      yearLabel,
      classOpeningDate,
      classEndDate,
      cloneFromId,
      termFormat,
      termLabels,
      term1Start,
      term1End,
      term2Start,
      term2End,
      term3Start,
      term3End,
      term4Start,
      term4End,
    } = req.body;

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

    const resolvedTermFormat = termFormat ?? "TRIMESTER"
    const resolvedTermLabels = resolveStoredTermLabels(
      resolvedTermFormat,
      termLabels,
    )

    let validatedTermContract: SchoolYearTermSource
    try {
      validatedTermContract = {
        termFormat: resolvedTermFormat,
        term1Start: resolveTermDateInput(term1Start, schedule.term1Start, "T1 start date"),
        term1End: resolveTermDateInput(term1End, schedule.term1End, "T1 end date"),
        term2Start: resolveTermDateInput(term2Start, schedule.term2Start, "T2 start date"),
        term2End: resolveTermDateInput(term2End, schedule.term2End, "T2 end date"),
        term3Start: resolveTermDateInput(term3Start, schedule.term3Start, "T3 start date"),
        term3End: resolveTermDateInput(term3End, schedule.term3End, "T3 end date"),
        term4Start: resolveTermDateInput(term4Start, null, "T4 start date"),
        term4End: resolveTermDateInput(term4End, null, "T4 end date"),
        term1Label: resolvedTermLabels.T1,
        term2Label: resolvedTermLabels.T2,
        term3Label: resolvedTermLabels.T3,
        term4Label: resolvedTermLabels.T4,
      }
      buildOrderedTermContract(validatedTermContract)
    } catch (error: unknown) {
      if (sendTermContractMutationError(res, error)) return
      throw error
    }

    const year = await prisma.schoolYear.create({
      data: {
        yearLabel: resolvedYearLabel,
        status: "ACTIVE",
        classOpeningDate: schedule.classOpeningDate,
        classEndDate: schedule.classEndDate,
        enrollOpenDate: schedule.enrollOpenDate,
        enrollCloseDate: schedule.enrollCloseDate,
        term1Start: validatedTermContract.term1Start,
        term1End: validatedTermContract.term1End,
        term2Start: validatedTermContract.term2Start,
        term2End: validatedTermContract.term2End,
        term3Start: validatedTermContract.term3Start,
        term3End: validatedTermContract.term3End,
        term4Start: validatedTermContract.term4Start,
        term4End: validatedTermContract.term4End,
        termFormat: validatedTermContract.termFormat,
        term1Label: validatedTermContract.term1Label,
        term2Label: validatedTermContract.term2Label,
        term3Label: validatedTermContract.term3Label,
        term4Label: validatedTermContract.term4Label,
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
    const { yearLabel, term1Start, term1End, term2Start, term2End, term3Start, term3End, term4Start, term4End, classOpeningDate, classEndDate, termFormat, termLabels, enrollOpenDate, enrollCloseDate, activeTerm } = req.body;

    const year = await prisma.schoolYear.findUnique({ where: { id } });
    if (!year) {
      res.status(404).json({ message: "School year not found" });
      return;
    }

    if (year.status === "ARCHIVED") {
      res.status(400).json({ message: "Cannot edit an archived school year" });
      return;
    }

    const touchesTermContract =
      termFormat !== undefined || termLabels !== undefined ||
      term1Start !== undefined || term1End !== undefined ||
      term2Start !== undefined || term2End !== undefined ||
      term3Start !== undefined || term3End !== undefined ||
      term4Start !== undefined || term4End !== undefined

    let validatedTermContract: SchoolYearTermSource | null = null
    if (touchesTermContract) {
      try {
        const resolvedTermFormat = termFormat ?? year.termFormat
        const formatChanged = resolvedTermFormat !== year.termFormat
        const resolvedTermLabels = mergeStoredTermLabels(
          resolvedTermFormat,
          {
            T1: year.term1Label,
            T2: year.term2Label,
            T3: year.term3Label,
            T4: year.term4Label,
          },
          termLabels,
          formatChanged,
        )

        validatedTermContract = {
          termFormat: resolvedTermFormat,
          term1Start: resolveTermDateInput(term1Start, year.term1Start, "T1 start date"),
          term1End: resolveTermDateInput(term1End, year.term1End, "T1 end date"),
          term2Start: resolveTermDateInput(term2Start, year.term2Start, "T2 start date"),
          term2End: resolveTermDateInput(term2End, year.term2End, "T2 end date"),
          term3Start: resolveTermDateInput(term3Start, year.term3Start, "T3 start date"),
          term3End: resolveTermDateInput(term3End, year.term3End, "T3 end date"),
          term4Start: resolveTermDateInput(term4Start, year.term4Start, "T4 start date"),
          term4End: resolveTermDateInput(term4End, year.term4End, "T4 end date"),
          term1Label: resolvedTermLabels.T1,
          term2Label: resolvedTermLabels.T2,
          term3Label: resolvedTermLabels.T3,
          term4Label: resolvedTermLabels.T4,
        }
        buildOrderedTermContract(validatedTermContract)
      } catch (error: unknown) {
        if (sendTermContractMutationError(res, error)) return
        throw error
      }
    }

    const updated = await prisma.schoolYear.update({
      where: { id },
      data: {
        ...(yearLabel ? { yearLabel } : {}),
        ...(classOpeningDate !== undefined ? { classOpeningDate: classOpeningDate ? normalizeDateToUtcNoon(new Date(classOpeningDate)) : year.classOpeningDate } : {}),
        ...(classEndDate !== undefined ? { classEndDate: classEndDate ? normalizeDateToUtcNoon(new Date(classEndDate)) : year.classEndDate } : {}),
        ...(validatedTermContract
          ? {
              termFormat: validatedTermContract.termFormat,
              term1Start: validatedTermContract.term1Start,
              term1End: validatedTermContract.term1End,
              term2Start: validatedTermContract.term2Start,
              term2End: validatedTermContract.term2End,
              term3Start: validatedTermContract.term3Start,
              term3End: validatedTermContract.term3End,
              term4Start: validatedTermContract.term4Start,
              term4End: validatedTermContract.term4End,
              term1Label: validatedTermContract.term1Label,
              term2Label: validatedTermContract.term2Label,
              term3Label: validatedTermContract.term3Label,
              term4Label: validatedTermContract.term4Label,
            }
          : {}),
        ...(enrollOpenDate !== undefined ? { enrollOpenDate: enrollOpenDate ? normalizeDateToUtcNoon(new Date(enrollOpenDate)) : null } : {}),
        ...(enrollCloseDate !== undefined ? { enrollCloseDate: enrollCloseDate ? normalizeDateToUtcNoon(new Date(enrollCloseDate)) : null } : {}),
        ...(activeTerm !== undefined ? { activeTerm } : {}),
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

