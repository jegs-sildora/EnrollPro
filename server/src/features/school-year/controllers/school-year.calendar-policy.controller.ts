import type { Request, Response } from "express";
import { prisma } from "../../../lib/prisma.js";
import { normalizeDateToUtcNoon } from "../school-year.service.js";
import { broadcastSchoolYearInvalidation } from "../../../lib/realtime-events.js";

interface CalendarPolicyBody {
  yearLabel: string;
  depedIssuance: string;
  sourceUrl?: string | null;
  classOpeningDate: string | Date;
  classEndDate: string | Date;
  enrollOpenDate?: string | Date | null;
  enrollCloseDate?: string | Date | null;
  termFormat: "TRIMESTER" | "QUARTERS";
  term1Start: string | Date;
  term1End: string | Date;
  term2Start: string | Date;
  term2End: string | Date;
  term3Start: string | Date;
  term3End: string | Date;
  term4Start?: string | Date | null;
  term4End?: string | Date | null;
}

function dateValue(value: string | Date): Date {
  return normalizeDateToUtcNoon(
    value instanceof Date ? value : new Date(value),
  );
}

function optionalDateValue(
  value: string | Date | null | undefined,
): Date | null {
  return value ? dateValue(value) : null;
}

function calendarData(body: CalendarPolicyBody) {
  return {
    yearLabel: body.yearLabel,
    depedIssuance: body.depedIssuance.trim(),
    sourceUrl: body.sourceUrl?.trim() || null,
    classOpeningDate: dateValue(body.classOpeningDate),
    classEndDate: dateValue(body.classEndDate),
    enrollOpenDate: optionalDateValue(body.enrollOpenDate),
    enrollCloseDate: optionalDateValue(body.enrollCloseDate),
    termFormat: body.termFormat,
    term1Start: dateValue(body.term1Start),
    term1End: dateValue(body.term1End),
    term2Start: dateValue(body.term2Start),
    term2End: dateValue(body.term2End),
    term3Start: dateValue(body.term3Start),
    term3End: dateValue(body.term3End),
    term4Start: optionalDateValue(body.term4Start),
    term4End: optionalDateValue(body.term4End),
  };
}

function validateChronology(data: ReturnType<typeof calendarData>): string | null {
  const orderedDates = [
    data.term1Start,
    data.term1End,
    data.term2Start,
    data.term2End,
    data.term3Start,
    data.term3End,
    ...(data.termFormat === "QUARTERS" && data.term4Start && data.term4End
      ? [data.term4Start, data.term4End]
      : []),
  ];
  if (
    orderedDates.some(
      (date, index) =>
        index > 0 && date.getTime() < orderedDates[index - 1]!.getTime(),
    )
  ) {
    return "School calendar terms must be entered in chronological order.";
  }
  if (data.classEndDate <= data.classOpeningDate) {
    return "End of School Year must be after Start of Classes.";
  }
  if (
    data.termFormat === "QUARTERS" &&
    (!data.term4Start || !data.term4End)
  ) {
    return "Fourth-quarter dates are required for a quarterly calendar.";
  }
  return null;
}

export async function listCalendarPolicies(
  req: Request,
  res: Response,
): Promise<void> {
  const yearLabel =
    typeof req.query.yearLabel === "string" ? req.query.yearLabel : undefined;
  const policies = await prisma.schoolYearCalendarPolicy.findMany({
    where: yearLabel ? { yearLabel } : undefined,
    orderBy: [{ yearLabel: "desc" }, { version: "desc" }],
    include: {
      approvedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
  res.json({ policies });
}

export async function saveCalendarPolicyDraft(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as CalendarPolicyBody;
  const data = calendarData(body);
  const validationMessage = validateChronology(data);
  if (validationMessage) {
    res.status(400).json({ message: validationMessage });
    return;
  }

  const existingDraft = await prisma.schoolYearCalendarPolicy.findFirst({
    where: {
      yearLabel: data.yearLabel,
      status: "DRAFT",
    },
    orderBy: { version: "desc" },
  });

  const latestVersion = existingDraft
    ? null
    : (
        await prisma.schoolYearCalendarPolicy.aggregate({
          where: { yearLabel: data.yearLabel },
          _max: { version: true },
        })
      )._max.version;
  const policy = existingDraft
    ? await prisma.schoolYearCalendarPolicy.update({
        where: { id: existingDraft.id },
        data,
      })
    : await prisma.schoolYearCalendarPolicy.create({
        data: {
          ...data,
          version: (latestVersion ?? 0) + 1,
        },
      });

  if (!existingDraft) {
    broadcastSchoolYearInvalidation();
    res.status(201).json({ calendarPolicy: policy, rolloverDraft: policy });
    return;
  }

  broadcastSchoolYearInvalidation();
  res.json({ calendarPolicy: policy, rolloverDraft: policy });
}

export async function updateCalendarPolicyDraft(
  req: Request,
  res: Response,
): Promise<void> {
  const id = Number.parseInt(String(req.params.id), 10);
  const current = await prisma.schoolYearCalendarPolicy.findUnique({
    where: { id },
  });
  if (!current) {
    res.status(404).json({ message: "School calendar policy not found." });
    return;
  }
  if (current.status !== "DRAFT") {
    res.status(409).json({
      message:
        "Approved or applied school calendars cannot be changed. Create a new version instead.",
    });
    return;
  }

  const data = calendarData(req.body as CalendarPolicyBody);
  const validationMessage = validateChronology(data);
  if (validationMessage) {
    res.status(400).json({ message: validationMessage });
    return;
  }
  const policy = await prisma.schoolYearCalendarPolicy.update({
    where: { id },
    data,
  });
  broadcastSchoolYearInvalidation();
  res.json({ calendarPolicy: policy });
}

export async function approveCalendarPolicy(
  req: Request,
  res: Response,
): Promise<void> {
  const id = Number.parseInt(String(req.params.id), 10);
  const current = await prisma.schoolYearCalendarPolicy.findUnique({
    where: { id },
  });
  if (!current) {
    res.status(404).json({ message: "School calendar policy not found." });
    return;
  }
  if (current.status === "APPLIED") {
    res.status(409).json({
      message: "This school calendar has already been applied.",
    });
    return;
  }

  const policy = await prisma.schoolYearCalendarPolicy.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById: req.user!.userId,
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: req.user!.userId,
      actionType: "SCHOOL_CALENDAR_APPROVED",
      description:
        `Approved ${policy.depedIssuance} calendar version ${policy.version} `
        + `for school year ${policy.yearLabel}.`,
      subjectType: "SchoolYearCalendarPolicy",
      recordId: policy.id,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] ?? null,
    },
  });
  broadcastSchoolYearInvalidation();
  res.json({ calendarPolicy: policy });
}
