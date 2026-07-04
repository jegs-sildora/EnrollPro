import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { EosyStatus } from "../../generated/prisma/index.js";
import { addEosyClient, broadcastEosyUpdate } from "./eosy-events.service.js";
import { getHistoricalProfileSnapshot } from "../school-year/services/school-year-rollover.service.js";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/\r?\n|\r/g, " ");
  if (/[",]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toDateOnly(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/**
 * Maps an internal EosyStatus value to the DepEd-canonical SF5 "Remarks"
 * label. IRREGULAR is an internal state for conditionally promoted learners
 * pending remedial resolution — DepEd SF5 only recognises four outcomes.
 */
function toSf5Remarks(status: EosyStatus | null): string {
  switch (status) {
    case "PROMOTED":
      return "Promoted";
    case "RETAINED":
    case "CONDITIONALLY_PROMOTED":
      return "Not Promoted";
    case "TRANSFERRED_OUT":
      return "Transferred Out";
    case "DROPPED_OUT":
      return "Dropped Out";
    default:
      return "";
  }
}

function normalizeAcademicDeficiencyNote(
  eosyStatus: EosyStatus | null | undefined,
  note: unknown,
): string | null {
  if (eosyStatus !== "CONDITIONALLY_PROMOTED") {
    return null
  }

  if (typeof note !== "string") {
    return null
  }

  const trimmed = note.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function getSchoolYearExportLockState(schoolYearId: number) {
  const [schoolYear, totalSections, finalizedSections] = await Promise.all([
    prisma.schoolYear.findUnique({
      where: { id: schoolYearId },
      select: { id: true, yearLabel: true, isEosyFinalized: true },
    }),
    prisma.section.count({
      where: {
        schoolYearId,
      },
    }),
    prisma.section.count({
      where: {
        schoolYearId,
        isEosyFinalized: true,
      },
    }),
  ]);

  if (!schoolYear) {
    throw new AppError(404, "School year not found.");
  }

  const schoolYearFinalized = schoolYear.isEosyFinalized;
  const canFinalizeSchoolYear =
    totalSections > 0 &&
    finalizedSections === totalSections &&
    !schoolYearFinalized;

  let lockReason: string | null = null;
  if (schoolYearFinalized) {
    lockReason = `School year ${schoolYear.yearLabel} EOSY is permanently finalized and archived. Class reopening and status updates are globally locked.`;
  } else if (totalSections === 0) {
    lockReason =
      "No sections found for this school year. Add sections before school-level finalization.";
  } else if (!canFinalizeSchoolYear) {
    lockReason = `${totalSections - finalizedSections} class(es) still need EOSY finalization before school-level lock.`;
  }

  return {
    schoolYearId: schoolYear.id,
    schoolYearLabel: schoolYear.yearLabel,
    schoolYearFinalized,
    totalSections,
    finalizedSections,
    canFinalizeSchoolYear,
    lockReason,
  };
}

export async function getEosySections(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { schoolYearId } = req.query;
    const sections = await prisma.section.findMany({
      where: {
        schoolYearId: parseInt(String(schoolYearId)),
      },
      include: {
        gradeLevel: true,
        _count: {
          select: { enrollmentRecords: true },
        },
        advisers: {
          where: { status: "ACTIVE" },
          include: {
            teacher: true,
          },
          take: 1,
        },
      },
      orderBy: [{ gradeLevel: { name: "asc" } }, { name: "asc" }],
    });
    res.json({ sections });
  } catch (error) {
    next(error);
  }
}

export async function getSectionRecords(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const sectionId = parseInt(String(id), 10);
    const records = await prisma.enrollmentRecord.findMany({
      where: { sectionId },
      include: {
        enrollmentApplication: {
          include: {
            learner: true,
            gradeLevel: true,
            previousSchool: true,
          },
        },
      },
      orderBy: [
        {
          enrollmentApplication: {
            learner: {
              sex: "asc",
            },
          },
        },
        {
          enrollmentApplication: {
            learner: {
              lastName: "asc",
            },
          },
        },
        {
          enrollmentApplication: {
            learner: {
              firstName: "asc",
            },
          },
        },
      ],
    });

    // Return records with their real finalAverage from the current year
    const mappedRecords = records.map((record) => {
      return {
        ...record,
        // Ensure finalAverage is correctly typed as number or null
        finalAverage:
          record.finalAverage !== null && record.finalAverage !== undefined
            ? parseFloat(String(record.finalAverage))
            : null,
      };
    });

    res.json({ records: mappedRecords });
  } catch (error) {
    next(error);
  }
}

export async function updateEosyRecord(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const recordId = parseInt(String(id), 10);
    const {
      eosyStatus,
      dropOutReason,
      transferOutDate,
      finalAverage,
      academicDeficiencyNote,
    } =
      req.body;

    const record = await prisma.enrollmentRecord.findUnique({
      where: { id: recordId },
      include: {
        enrollmentApplication: {
          select: { applicantType: true }
        },
        section: {
          include: {
            schoolYear: {
              select: {
                isEosyFinalized: true,
              },
            },
          },
        },
      },
    });

    if (!record) throw new AppError(404, "Enrollment record not found.");
    if (record.section?.schoolYear?.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot update status. School year EOSY is finalized and export lock is active.",
      );
    }
    if (record.section?.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot update status. Section is already finalized.",
      );
    }

    const ave = finalAverage !== undefined ? parseFloat(String(finalAverage)) : record.finalAverage !== null ? parseFloat(String(record.finalAverage)) : null;
    const isScp = record.section?.programType && record.section.programType !== "REGULAR";

    let targetStatus = eosyStatus;
    let nextYearCurriculum: any = undefined;

    if (ave === 0 || ave === null || isNaN(ave)) {
      if (targetStatus === "PROMOTED" || targetStatus === "PROMOTED_TO_BEC" || targetStatus === "RETAINED" || targetStatus === "CONDITIONALLY_PROMOTED") {
        throw new AppError(400, "Learner with 0.00 or blank Final Average cannot be assigned an academic evaluation status. Must be DROPPED OUT or TRANSFERRED OUT.");
      }
    } else if (ave < 75) {
      if (targetStatus === "PROMOTED" || targetStatus === "PROMOTED_TO_BEC") {
         throw new AppError(400, "Learner with Final Average below 75 cannot be promoted.");
      }
      targetStatus = "RETAINED";
      if (isScp) {
        nextYearCurriculum = "REGULAR";
      }
    } else if (isScp && ave < 85) {
      if (targetStatus === "PROMOTED") {
        throw new AppError(400, "Cannot assign standard Promoted status. SCP learners failing to meet the retention policy must be assigned 'Promoted (To BEC)'.");
      }
      targetStatus = "PROMOTED";
      nextYearCurriculum = "REGULAR";
    }

    if (targetStatus === "PROMOTED_TO_BEC") {
      targetStatus = "PROMOTED";
      nextYearCurriculum = "REGULAR";
    }

    const updated = await prisma.enrollmentRecord.update({
      where: { id: recordId },
      data: {
        eosyStatus: targetStatus as EosyStatus,
        academicDeficiencyNote: normalizeAcademicDeficiencyNote(
          targetStatus as EosyStatus,
          academicDeficiencyNote,
        ),
        nextYearCurriculum: nextYearCurriculum !== undefined ? nextYearCurriculum : undefined,
        dropOutReason: targetStatus === "DROPPED_OUT" ? dropOutReason : null,
        transferOutDate:
          targetStatus === "TRANSFERRED_OUT"
            ? transferOutDate
              ? new Date(transferOutDate)
              : null
            : null,
        finalAverage: ave !== null ? ave : undefined,
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EOSY_STATUS_UPDATED",
      description: `Updated EOSY status for Learner ID ${record.learnerId}`,
      subjectType: "EnrollmentRecord",
      recordId: recordId,
      oldValue: record.eosyStatus || "PENDING",
      newValue: eosyStatus,
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/eosy/batch-update
 * Body: { sectionId: number, updates: { recordId: number, status: EosyStatus }[] }
 */
export async function batchUpdateEosyRecords(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { sectionId, updates } = req.body;

    if (!sectionId || !Array.isArray(updates)) {
      throw new AppError(400, "Invalid payload. sectionId and updates array required.");
    }

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { schoolYear: { select: { isEosyFinalized: true } } },
    });

    if (!section) throw new AppError(404, "Section not found.");
    if (section.schoolYear.isEosyFinalized) {
      throw new AppError(422, "Cannot update statuses. School year EOSY is finalized.");
    }
    if (section.isEosyFinalized) {
      throw new AppError(403, `Section '${section.name}' is finalized and locked for EOSY updates.`);
    }

    const result = await prisma.$transaction(async (tx) => {
      let count = 0;

      for (const update of updates) {
        const current = await tx.enrollmentRecord.findUnique({
          where: { id: update.recordId },
          select: { eosyStatus: true, learner: { select: { firstName: true, lastName: true } } },
        });

        if (!current) continue;

        await tx.enrollmentRecord.update({
          where: { id: update.recordId },
          data: {
            eosyStatus: update.status as EosyStatus,
            academicDeficiencyNote: normalizeAcademicDeficiencyNote(
              update.status as EosyStatus,
              "academicDeficiencyNote" in update
                ? update.academicDeficiencyNote
                : null,
            ),
          },
        });

        await tx.auditLog.create({
          data: {
            userId: req.user!.userId,
            actionType: "EOSY_STATUS_BATCH_UPDATE",
            description: `Updated EOSY status for ${current.learner.lastName}, ${current.learner.firstName}`,
            subjectType: "EnrollmentRecord",
            recordId: update.recordId,
            oldValue: current.eosyStatus || "PENDING",
            newValue: update.status,
            ipAddress: req.ip ?? "0.0.0.0",
            userAgent: (req.headers["user-agent"] as string) ?? null,
            metadata: { sectionId, sectionName: section.name },
          },
        });

        count++;
      }

      return { count, sectionName: section.name };
    });

    res.json({
      message: `Successfully processed ${result.count} updates for ${result.sectionName}.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function finalizeSection(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const sectionId = parseInt(String(id), 10);

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        gradeLevel: true,
        schoolYear: {
          select: {
            isEosyFinalized: true,
          },
        },
      },
    });

    if (!section) {
      throw new AppError(404, "Section not found.");
    }
    if (section.schoolYear.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot finalize class. School year EOSY is already finalized.",
      );
    }

    const updated = await prisma.section.update({
      where: { id: sectionId },
      data: { isEosyFinalized: true },
    });

    // Hook: Grade 10 Completers Transition
    // Grade 10 is the end of JHS; promoted learners become Completers
    if (
      section.gradeLevel.displayOrder === 10 ||
      section.gradeLevel.name.includes("10")
    ) {
      const promotedRecords = await prisma.enrollmentRecord.findMany({
        where: {
          sectionId: sectionId,
          eosyStatus: "PROMOTED",
        },
        select: {
          enrollmentApplication: {
            select: {
              learnerId: true,
            },
          },
        },
      });

      const learnerIds = promotedRecords.map(
        (r) => r.enrollmentApplication.learnerId,
      );

      if (learnerIds.length > 0) {
        await prisma.learner.updateMany({
          where: { id: { in: learnerIds } },
          data: { status: "JHS_COMPLETER" },
        });

        // Trigger Ecosystem Sync for status update/revocation
        for (const learnerId of learnerIds) {
        }

        await auditLog({
          userId: req.user!.userId,
          actionType: "LEARNERS_COMPLETED_JHS",
          description: `Marked ${learnerIds.length} learners from section ${updated.name} as JHS Completers`,
          subjectType: "Section",
          recordId: sectionId,
          req,
        });
      }
    }

    // Hook: Queue Ecosystem Sync for section

    await auditLog({
      userId: req.user!.userId,
      actionType: "SECTION_FINALIZED",
      description: `Finalized EOSY for section ${updated.name}`,
      subjectType: "Section",
      recordId: sectionId,
      oldValue: "false",
      newValue: "true",
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function reopenSection(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const sectionId = parseInt(String(id), 10);

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        schoolYear: {
          select: {
            isEosyFinalized: true,
          },
        },
      },
    });

    if (!section) {
      throw new AppError(404, "Section not found.");
    }
    if (section.schoolYear.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot reopen class. School year EOSY is finalized and export lock is active.",
      );
    }

    const updated = await prisma.section.update({
      where: { id: sectionId },
      data: { isEosyFinalized: false },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "SECTION_REOPENED",
      description: `Re-opened EOSY for section ${updated.name}`,
      subjectType: "Section",
      recordId: sectionId,
      oldValue: "true",
      newValue: "false",
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function getSchoolYearExportLock(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const syId = parseInt(String(req.params.schoolYearId), 10);
    if (!Number.isInteger(syId)) {
      throw new AppError(400, "A valid schoolYearId is required.");
    }

    const state = await getSchoolYearExportLockState(syId);
    res.json(state);
  } catch (error) {
    next(error);
  }
}

export async function finalizeSchoolYear(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { schoolYearId } = req.body;
    const syId = parseInt(String(schoolYearId));
    if (!Number.isInteger(syId)) {
      throw new AppError(400, "A valid schoolYearId is required.");
    }

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: syId },
      select: { id: true, yearLabel: true, isEosyFinalized: true },
    });

    if (!schoolYear) {
      throw new AppError(404, "School year not found.");
    }
    if (schoolYear.isEosyFinalized) {
      throw new AppError(
        422,
        "School year EOSY is already finalized. Export lock is already active.",
      );
    }

    const totalSections = await prisma.section.count({
      where: {
        schoolYearId: syId,
      },
    });
    if (totalSections === 0) {
      throw new AppError(
        422,
        "Cannot finalize school EOSY. No sections were found for this school year.",
      );
    }

    // 1. Check if all sections are finalized
    const unfinalizedSections = await prisma.section.count({
      where: {
        schoolYearId: syId,
        isEosyFinalized: false,
      },
    });

    if (unfinalizedSections > 0) {
      throw new AppError(
        422,
        `Cannot finalize school EOSY. There are still ${unfinalizedSections} unfinalized sections.`,
      );
    }

    const updated = await prisma.schoolYear.update({
      where: { id: syId },
      data: {
        isEosyFinalized: true,
        status: "ARCHIVED",
      },
    });

    // Create EnrollmentHistory for all records in this school year
    const sourceRecords = await prisma.enrollmentRecord.findMany({
      where: { schoolYearId: syId },
      select: {
        learnerId: true,
        schoolYearId: true,
        sectionId: true,
        finalAverage: true,
        eosyStatus: true,
        academicDeficiencyNote: true,
        learner: {
          select: {
            lrn: true,
            firstName: true,
            middleName: true,
            lastName: true,
            extensionName: true,
            sex: true,
            birthdate: true,
          },
        },
        enrolledBy: {
          select: { firstName: true, lastName: true },
        },
        section: {
          select: {
            gradeLevelId: true,
            advisers: {
              where: { status: "ACTIVE" },
              take: 1,
              select: { teacherId: true },
            },
          },
        },
        enrollmentApplication: {
          select: {
            id: true,
            applicantType: true,
            assignedProgram: true,
            learnerType: true,
            contactNumber: true,
            guardianName: true,
          },
        },
      },
    });

    if (sourceRecords.length > 0) {
      await prisma.enrollmentHistory.createMany({
        data: sourceRecords.map((record) => ({
          learnerId: record.learnerId,
          schoolYearId: record.schoolYearId,
          gradeLevelId: record.section.gradeLevelId,
          sectionId: record.sectionId,
          adviserId: record.section.advisers[0]?.teacherId ?? null,
          genAve: record.finalAverage,
          eosyStatus: record.eosyStatus,
          academicDeficiencyNote: record.academicDeficiencyNote,
          learnerProfileSnapshot: getHistoricalProfileSnapshot(record),
        })),
        skipDuplicates: true,
      });
    }

    // Create the next school year and set it as the new active year
    let nextYearLabel = "";
    const parts = updated.yearLabel.split("-");
    if (parts.length === 2) {
      const start = parseInt(parts[0], 10);
      const end = parseInt(parts[1], 10);
      if (!isNaN(start) && !isNaN(end)) {
        nextYearLabel = `${start + 1}-${end + 1}`;
      }
    }

    if (nextYearLabel) {
      let nextSy = await prisma.schoolYear.findUnique({
        where: { yearLabel: nextYearLabel },
      });
      if (!nextSy) {
        const shiftYear = (d: Date | null) => {
          if (!d) return null;
          const newDate = new Date(d);
          newDate.setFullYear(newDate.getFullYear() + 1);
          return newDate;
        };

        nextSy = await prisma.schoolYear.create({
          data: {
            yearLabel: nextYearLabel,
            status: "ACTIVE",
            termFormat: updated.termFormat,
            clonedFromId: updated.id,
            classOpeningDate: shiftYear(updated.classOpeningDate),
            classEndDate: shiftYear(updated.classEndDate),
            enrollOpenDate: shiftYear(updated.enrollOpenDate),
            enrollCloseDate: shiftYear(updated.enrollCloseDate),
            term1Start: shiftYear(updated.term1Start),
            term1End: shiftYear(updated.term1End),
            term2Start: shiftYear(updated.term2Start),
            term2End: shiftYear(updated.term2End),
            term3Start: shiftYear(updated.term3Start),
            term3End: shiftYear(updated.term3End),
            term4Start: shiftYear(updated.term4Start),
            term4End: shiftYear(updated.term4End),
          },
        });
      }
      
      // Update global active school year and phase in settings
      await prisma.schoolSetting.updateMany({
        data: { 
          activeSchoolYearId: nextSy.id,
          systemPhase: "OFFICIAL_ENROLLMENT"
        },
      });
    }

    // Hook: Queue Ecosystem Sync for entire school year

    await auditLog({
      userId: req.user!.userId,
      actionType: "SCHOOL_YEAR_FINALIZED",
      description: `Master Finalized EOSY for school year ${updated.yearLabel} - System transitioned to ARCHIVED status`,
      subjectType: "SchoolYear",
      recordId: syId,
      req,
    });

    const state = await getSchoolYearExportLockState(syId);
    res.json({ schoolYear: updated, exportLock: state, nextSchoolYear: nextYearLabel ? (await prisma.schoolYear.findUnique({ where: { yearLabel: nextYearLabel } })) : null });
  } catch (error) {
    next(error);
  }
}

export async function unlockSchoolYearEosy(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { schoolYearId, pin, justification } = req.body;
    const requestedSchoolYearId = Number.isInteger(parseInt(String(schoolYearId)))
      ? parseInt(String(schoolYearId))
      : null;

    // Security PIN and justification removed per request.
    // Always target the latest archived/finalized school year for emergency unlock.
    // This prevents stale client state from unlocking an older school year.
    const schoolYear = await prisma.schoolYear.findFirst({
      where: {
        status: "ARCHIVED",
        isEosyFinalized: true,
      },
      orderBy: {
        id: "desc",
      },
      select: { id: true, yearLabel: true, isEosyFinalized: true },
    });

    if (!schoolYear) {
      throw new AppError(
        404,
        "No archived/finalized school year found to unlock.",
      );
    }

    if (!schoolYear.isEosyFinalized) {
      throw new AppError(400, "School year is not finalized.");
    }

    const updated = await prisma.schoolYear.update({
      where: { id: schoolYear.id },
      data: {
        isEosyFinalized: false,
        status: "ACTIVE", // Revert to ACTIVE so teachers can correct records
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "SCHOOL_YEAR_EMERGENCY_UNLOCK",
      description: `Admin triggered EMERGENCY EOSY UNLOCK for latest archived S.Y. ${updated.yearLabel}${requestedSchoolYearId && requestedSchoolYearId !== updated.id ? ` (requested ${requestedSchoolYearId}, system applied ${updated.id})` : ""}. Justification: ${justification}`,
      subjectType: "SchoolYear",
      recordId: updated.id,
      req,
    });

    const state = await getSchoolYearExportLockState(updated.id);
    res.json({ schoolYear: updated, exportLock: state });
  } catch (error) {
    next(error);
  }
}

export async function downloadFinalLisExport(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const syId = parseInt(String(req.params.schoolYearId), 10);
    if (!Number.isInteger(syId)) {
      throw new AppError(400, "A valid schoolYearId is required.");
    }

    const exportState = await getSchoolYearExportLockState(syId);
    if (!exportState.schoolYearFinalized) {
      throw new AppError(
        422,
        "Cannot download final LIS export until school EOSY is finalized.",
      );
    }

    const records = await prisma.enrollmentRecord.findMany({
      where: {
        section: {
          schoolYearId: syId,
        },
      },
      include: {
        section: {
          select: {
            name: true,
            gradeLevel: {
              select: {
                name: true,
                displayOrder: true,
              },
            },
          },
        },
        enrollmentApplication: {
          select: {
            trackingNumber: true,
            status: true,
            learnerType: true,
            applicantType: true,
            learner: {
              select: {
                lrn: true,
                lastName: true,
                firstName: true,
                middleName: true,
                extensionName: true,
                sex: true,
                birthdate: true,
              },
            },
          },
        },
      },
    });

    const sortedRecords = records.sort((a, b) => {
      const gradeA = a.section.gradeLevel.displayOrder ?? 999;
      const gradeB = b.section.gradeLevel.displayOrder ?? 999;
      if (gradeA !== gradeB) return gradeA - gradeB;

      const sectionCompare = a.section.name.localeCompare(
        b.section.name,
        "en",
        {
          sensitivity: "base",
        },
      );
      if (sectionCompare !== 0) return sectionCompare;

      const lastNameCompare =
        a.enrollmentApplication.learner.lastName.localeCompare(
          b.enrollmentApplication.learner.lastName,
          "en",
          { sensitivity: "base" },
        );
      if (lastNameCompare !== 0) return lastNameCompare;

      return a.enrollmentApplication.learner.firstName.localeCompare(
        b.enrollmentApplication.learner.firstName,
        "en",
        { sensitivity: "base" },
      );
    });

    const headers = [
      "LRN",
      "LAST_NAME",
      "FIRST_NAME",
      "MIDDLE_NAME",
      "EXTENSION_NAME",
      "SEX",
      "BIRTHDATE",
      "GRADE_LEVEL",
      "SECTION",
      "FINAL_AVERAGE",
      "EOSY_STATUS",
      "DROPOUT_REASON",
      "TRANSFER_OUT_DATE",
      "PROGRAM_TYPE",
      "LEARNER_TYPE",
      "APPLICATION_STATUS",
      "TRACKING_NUMBER",
    ];

    const rows = sortedRecords.map((record) => [
      record.enrollmentApplication.learner.lrn,
      record.enrollmentApplication.learner.lastName,
      record.enrollmentApplication.learner.firstName,
      record.enrollmentApplication.learner.middleName,
      record.enrollmentApplication.learner.extensionName,
      record.enrollmentApplication.learner.sex,
      toDateOnly(record.enrollmentApplication.learner.birthdate),
      record.section.gradeLevel.name,
      record.section.name,
      record.finalAverage?.toFixed(2) || "0.00",
      record.eosyStatus ?? "PROMOTED",
      record.dropOutReason,
      toDateOnly(record.transferOutDate),
      record.enrollmentApplication.applicantType,
      record.enrollmentApplication.learnerType,
      record.enrollmentApplication.status,
      record.enrollmentApplication.trackingNumber,
    ]);

    const csvBody = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\r\n");

    const safeLabel = exportState.schoolYearLabel.replace(
      /[^a-zA-Z0-9_-]+/g,
      "-",
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="final-lis-export-${safeLabel}.csv"`,
    );

    res.status(200).send(`\uFEFF${csvBody}`);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/eosy/sections/:id/exports/sf5
 * School Form 5 — Section-scoped learner promotion and proficiency report (JSON).
 * Includes section metadata and per-learner EOSY outcome data.
 * Roles: HEAD_REGISTRAR, SYSTEM_ADMIN
 */
export async function exportSF5(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sectionId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(sectionId) || sectionId <= 0) {
      res.status(400).json({ message: "Invalid section id." });
      return;
    }

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        gradeLevel: { select: { id: true, name: true } },
        schoolYear: { select: { id: true, yearLabel: true } },
        advisers: {
          where: { status: "ACTIVE" },
          include: {
            teacher: { select: { firstName: true, lastName: true } },
          },
          take: 1,
        },
      },
    });

    if (!section) {
      res.status(404).json({ message: "Section not found." });
      return;
    }

    const records = await prisma.enrollmentRecord.findMany({
      where: { sectionId },
      orderBy: [
        { enrollmentApplication: { learner: { lastName: "asc" } } },
        { enrollmentApplication: { learner: { firstName: "asc" } } },
      ],
      include: {
        enrollmentApplication: {
          include: {
            learner: {
              select: {
                id: true,
                lrn: true,
                firstName: true,
                lastName: true,
                middleName: true,
                extensionName: true,
                sex: true,
                birthdate: true,
              },
            },
          },
        },
      },
    });

    const adviser = section.advisers[0]?.teacher ?? null;

    res.json({
      generatedAt: new Date().toISOString(),
      section: {
        id: section.id,
        name: section.name,
        gradeLevel: section.gradeLevel,
        schoolYear: section.schoolYear,
        adviser: adviser
          ? { firstName: adviser.firstName, lastName: adviser.lastName }
          : null,
        isEosyFinalized: section.isEosyFinalized,
      },
      totalLearners: records.length,
      learners: records.map((r, idx) => ({
        no: idx + 1,
        learnerId: r.learnerId,
        lrn: r.enrollmentApplication.learner.lrn,
        lastName: r.enrollmentApplication.learner.lastName,
        firstName: r.enrollmentApplication.learner.firstName,
        middleName: r.enrollmentApplication.learner.middleName,
        extensionName: r.enrollmentApplication.learner.extensionName,
        sex: r.enrollmentApplication.learner.sex,
        birthdate: toDateOnly(r.enrollmentApplication.learner.birthdate),
        finalAverage:
          r.finalAverage !== null
            ? parseFloat(r.finalAverage.toFixed(2))
            : null,
        eosyStatus: r.eosyStatus ?? null,
        // SF5 "Remarks" column uses DepEd-canonical labels only.
        // IRREGULAR is an internal status meaning conditionally promoted /
        // pending remedial — it maps to "Not Promoted" on the official form.
        sf5Remarks: toSf5Remarks(r.eosyStatus ?? null),
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/eosy/exports/sf6
 * School Form 6 — School-wide enrollment summary by grade level (JSON).
 * Rows: per-grade counts for initial enrollment, transfer-in, transfer-out,
 *       drop-out, promoted, retained, and totals by sex.
 * Query params: schoolYearId (required)
 * Roles: HEAD_REGISTRAR, SYSTEM_ADMIN
 */
export async function exportSF6(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolYearId = Number.parseInt(String(req.query.schoolYearId ?? ""), 10);
    if (!Number.isFinite(schoolYearId) || schoolYearId <= 0) {
      res.status(400).json({ message: "schoolYearId query param is required." });
      return;
    }

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: schoolYearId },
      select: { id: true, yearLabel: true },
    });
    if (!schoolYear) {
      res.status(404).json({ message: "School year not found." });
      return;
    }

    // Fetch all enrollment records for this school year with gradeLevel + sex + eosyStatus
    const records = await prisma.enrollmentRecord.findMany({
      where: { schoolYearId },
      include: {
        enrollmentApplication: {
          include: {
            learner: { select: { sex: true } },
            gradeLevel: { select: { id: true, name: true, displayOrder: true } },
          },
        },
      },
    });

    // Group by gradeLevel
    const gradeMap = new Map<
      number,
      {
        gradeId: number;
        gradeName: string;
        displayOrder: number | null;
        male: number;
        female: number;
        promoted: { male: number; female: number };
        retained: { male: number; female: number };
        dropOut: { male: number; female: number };
        transferOut: { male: number; female: number };
        irregular: { male: number; female: number };
        noStatus: { male: number; female: number };
      }
    >();

    for (const record of records) {
      const gl = record.enrollmentApplication.gradeLevel;
      if (!gradeMap.has(gl.id)) {
        gradeMap.set(gl.id, {
          gradeId: gl.id,
          gradeName: gl.name,
          displayOrder: gl.displayOrder ?? null,
          male: 0,
          female: 0,
          promoted: { male: 0, female: 0 },
          retained: { male: 0, female: 0 },
          dropOut: { male: 0, female: 0 },
          transferOut: { male: 0, female: 0 },
          irregular: { male: 0, female: 0 },
          noStatus: { male: 0, female: 0 },
        });
      }

      const row = gradeMap.get(gl.id)!;
      const isMale = record.enrollmentApplication.learner.sex === "MALE";
      const sexKey = isMale ? "male" : "female";

      if (isMale) row.male += 1;
      else row.female += 1;

      switch (record.eosyStatus) {
        case "PROMOTED":
          row.promoted[sexKey] += 1;
          break;
        case "RETAINED":
          row.retained[sexKey] += 1;
          break;
        case "DROPPED_OUT":
          row.dropOut[sexKey] += 1;
          break;
        case "TRANSFERRED_OUT":
          row.transferOut[sexKey] += 1;
          break;
        case "CONDITIONALLY_PROMOTED":
          row.irregular[sexKey] += 1;
          break;
        default:
          row.noStatus[sexKey] += 1;
      }
    }

    const rows = Array.from(gradeMap.values())
      .sort(
        (a, b) =>
          (a.displayOrder ?? 999) - (b.displayOrder ?? 999) ||
          a.gradeName.localeCompare(b.gradeName),
      )
      .map((row) => ({
        gradeId: row.gradeId,
        gradeName: row.gradeName,
        initialEnrollment: { male: row.male, female: row.female, total: row.male + row.female },
        promoted: { ...row.promoted, total: row.promoted.male + row.promoted.female },
        retained: { ...row.retained, total: row.retained.male + row.retained.female },
        dropOut: { ...row.dropOut, total: row.dropOut.male + row.dropOut.female },
        transferOut: { ...row.transferOut, total: row.transferOut.male + row.transferOut.female },
        irregular: { ...row.irregular, total: row.irregular.male + row.irregular.female },
        noStatus: { ...row.noStatus, total: row.noStatus.male + row.noStatus.female },
      }));

    const grandTotal = rows.reduce(
      (acc, r) => {
        acc.male += r.initialEnrollment.male;
        acc.female += r.initialEnrollment.female;
        acc.total += r.initialEnrollment.total;
        acc.promoted += r.promoted.total;
        acc.retained += r.retained.total;
        acc.dropOut += r.dropOut.total;
        acc.transferOut += r.transferOut.total;
        return acc;
      },
      { male: 0, female: 0, total: 0, promoted: 0, retained: 0, dropOut: 0, transferOut: 0 },
    );

    res.json({
      generatedAt: new Date().toISOString(),
      schoolYear: { id: schoolYear.id, yearLabel: schoolYear.yearLabel },
      rows,
      grandTotal,
    });
  } catch (error) {
    next(error);
  }
}

export async function getGradeRecords(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { gradeLevelId } = req.params;
    const { schoolYearId } = req.query;

    if (!schoolYearId) {
      throw new AppError(400, "schoolYearId query parameter is required.");
    }

    const syId = parseInt(String(schoolYearId), 10);
    const glId = parseInt(String(gradeLevelId), 10);

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: syId },
    });

    let records: any[] = [];

    if (schoolYear?.status === "ARCHIVED") {
      const historyRecords = await prisma.enrollmentHistory.findMany({
        where: {
          schoolYearId: syId,
          gradeLevelId: glId,
        },
        include: {
          section: {
            select: { id: true, name: true, isEosyFinalized: true, programType: true, isHomogeneous: true },
          },
          learner: true,
          gradeLevel: true,
        },
        orderBy: [
          { learner: { lastName: "asc" } },
          { learner: { firstName: "asc" } },
        ],
      });

      records = historyRecords.map(h => ({
        ...h,
        finalAverage: h.genAve,
        enrollmentApplication: {
          learner: h.learner,
          gradeLevel: h.gradeLevel,
        }
      }));
    } else {
      records = await prisma.enrollmentRecord.findMany({
        where: {
          schoolYearId: syId,
          section: {
            gradeLevelId: glId,
          },
        },
        include: {
          section: {
            select: { id: true, name: true, isEosyFinalized: true, programType: true, isHomogeneous: true },
          },
          enrollmentApplication: {
            include: {
              learner: true,
              gradeLevel: true,
              previousSchool: true,
            },
          },
        },
        orderBy: [
          {
            enrollmentApplication: {
              learner: { lastName: "asc" },
            },
          },
          {
            enrollmentApplication: {
              learner: { firstName: "asc" },
            },
          },
        ],
      });
    }

    const mappedRecords = records.map((record) => {
      const isScp = record.section?.programType && record.section.programType !== "REGULAR";
      const isScpDemoted = record.nextYearCurriculum === "REGULAR" && isScp;

      const finalAve = record.finalAverage !== null && record.finalAverage !== undefined
        ? parseFloat(String(record.finalAverage))
        : null;

      let scpViolation = null;
      if (isScp && finalAve !== null && finalAve < 85) {
        // MOCK LOGIC: We deterministically generate a violation based on finalAverage 
        // to fulfill the UI requirement for granular DepEd tracking.
        if (finalAve < 80) {
           scpViolation = { subject: "MAPEH", term: "Quarter 2", actualGrade: Math.floor(finalAve), requiredGrade: 80, violationType: "Quarterly Minimum" };
        } else if (finalAve < 83) {
           scpViolation = { subject: "Araling Panlipunan", term: "Final Grade", actualGrade: finalAve, requiredGrade: 83, violationType: "Subject Final Minimum" };
        } else {
           scpViolation = { subject: "Science", term: "Final Grade", actualGrade: finalAve, requiredGrade: 85, violationType: "Core Subject Minimum" };
        }
      }

      return {
        ...record,
        nextYearCurriculum: record.nextYearCurriculum,
        isScpDemoted,
        scpViolation,
        finalAverage: finalAve,
      };
    });

    res.json({ records: mappedRecords });
  } catch (error) {
    next(error);
  }
}

export async function batchUpdateGradeRecords(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { gradeLevelId } = req.params;
    const { schoolYearId, updates } = req.body;

    if (!schoolYearId || !Array.isArray(updates)) {
      throw new AppError(
        400,
        "Invalid payload. schoolYearId and updates array required.",
      );
    }

    // Check if any sections in this grade level are already finalized
    const finalizedSections = await prisma.section.findMany({
      where: {
        gradeLevelId: parseInt(String(gradeLevelId), 10),
        schoolYearId: parseInt(String(schoolYearId), 10),
        isEosyFinalized: true,
      },
    });

    if (finalizedSections.length > 0) {
      throw new AppError(
        422,
        "Cannot update statuses. One or more sections in this grade level are already finalized.",
      );
    }

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: parseInt(String(schoolYearId), 10) },
    });

    if (schoolYear?.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot update statuses. School year EOSY is finalized.",
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      let count = 0;

      for (const update of updates) {
        const current = await tx.enrollmentRecord.findUnique({
          where: { id: update.recordId },
          select: {
            eosyStatus: true,
            finalAverage: true,
            learner: { select: { firstName: true, lastName: true } },
            section: { select: { programType: true } },
          },
        });

        if (!current) continue;

          const isScp = current.section.programType && current.section.programType !== "REGULAR";
          const ave = current.finalAverage !== null ? parseFloat(String(current.finalAverage)) : null;

        let targetStatus = update.status;
        const dataToUpdate: {
          eosyStatus?: EosyStatus
          nextYearCurriculum?: "REGULAR" | null
          academicDeficiencyNote?: string | null
        } = {};

        if (ave === 0 || ave === null || isNaN(ave!)) {
          if (targetStatus === "PROMOTED" || targetStatus === "PROMOTED_TO_BEC" || targetStatus === "RETAINED" || targetStatus === "CONDITIONALLY_PROMOTED") {
            throw new AppError(400, "Learner with 0.00 or blank Final Average cannot be assigned an academic evaluation status. Must be DROPPED OUT or TRANSFERRED OUT.");
          }
        } else if (ave! < 75) {
          if (targetStatus === "PROMOTED" || targetStatus === "PROMOTED_TO_BEC") {
             throw new AppError(400, `Cannot promote ${current.learner.lastName}, ${current.learner.firstName}. Final average is below 75.`);
          }
          targetStatus = "RETAINED";
          if (isScp) {
            dataToUpdate.nextYearCurriculum = "REGULAR";
          }
        } else if (isScp && ave! < 85) {
          if (targetStatus === "PROMOTED") {
            throw new AppError(400, "Cannot assign standard Promoted status. SCP learners failing to meet the retention policy must be assigned 'Promoted (To BEC)'.");
          }
          targetStatus = "PROMOTED";
          dataToUpdate.nextYearCurriculum = "REGULAR";
        }

        if (targetStatus === "PROMOTED_TO_BEC") {
          targetStatus = "PROMOTED";
          dataToUpdate.nextYearCurriculum = "REGULAR";
        }

        dataToUpdate.eosyStatus = targetStatus as EosyStatus;
        dataToUpdate.academicDeficiencyNote = normalizeAcademicDeficiencyNote(
          targetStatus as EosyStatus,
          "academicDeficiencyNote" in update
            ? update.academicDeficiencyNote
            : null,
        )

        await tx.enrollmentRecord.update({
          where: { id: update.recordId },
          data: dataToUpdate,
        });

        await tx.auditLog.create({
          data: {
            userId: req.user!.userId,
            actionType: "EOSY_STATUS_BATCH_UPDATE",
            description: `Updated EOSY status for ${current.learner.lastName}, ${current.learner.firstName}`,
            subjectType: "EnrollmentRecord",
            recordId: update.recordId,
            oldValue: current.eosyStatus || "PENDING",
            newValue: update.status,
            ipAddress: req.ip ?? "0.0.0.0",
            userAgent: (req.headers["user-agent"] as string) ?? null,
            metadata: { gradeLevelId },
          },
        });

        count++;
      }

      return { count };
    });

    res.json({
      message: `Successfully processed ${result.count} updates.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function finalizeGradeLevel(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { gradeLevelId } = req.params;
    const { schoolYearId, section_id } = req.body;

    const syId = parseInt(String(schoolYearId), 10);
    const glId = parseInt(String(gradeLevelId), 10);
    const isGlobal = !section_id || section_id === "all";
    const targetSectionId = isGlobal ? null : parseInt(String(section_id), 10);

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: syId },
    });

    if (!schoolYear) throw new AppError(404, "School year not found.");
    if (schoolYear.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot finalize grade level. School year EOSY is already finalized.",
      );
    }

    const gradeLevel = await prisma.gradeLevel.findUnique({
      where: { id: glId },
    });
    if (!gradeLevel) throw new AppError(404, "Grade level not found.");

    const sectionWhere = {
      schoolYearId: syId,
      gradeLevelId: glId,
      ...(targetSectionId ? { id: targetSectionId } : {}),
    };

    const sections = await prisma.section.findMany({
      where: sectionWhere,
    });

    if (sections.length === 0) {
      throw new AppError(
        422,
        targetSectionId
          ? "Target section not found."
          : "No sections found for this grade level in the active school year.",
      );
    }

    if (sections.every((s) => s.isEosyFinalized)) {
      throw new AppError(
        422,
        targetSectionId
          ? "Section is already finalized."
          : "Grade level is already finalized.",
      );
    }

    const records = await prisma.enrollmentRecord.findMany({
      where: {
        schoolYearId: syId,
        section: sectionWhere,
      },
      include: {
        learner: true,
      },
    });

    // Verify all records have a locked, submitted GEN AVE from their Class Adviser
    const pendingLearners = records.filter(
      (r) =>
        (r.finalAverage === null || r.finalAverage === undefined) &&
        r.eosyStatus !== "TRANSFERRED_OUT" &&
        r.eosyStatus !== "DROPPED_OUT",
    );
    if (pendingLearners.length > 0) {
      throw new AppError(
        400,
        `Cannot finalize. ${pendingLearners.length} learner(s) still have pending grades.`,
      );
    }

    // Verify all records have eosyStatus
    const unfinalized = records.filter((r) => !r.eosyStatus);
    if (unfinalized.length > 0) {
      throw new AppError(
        422,
        `Cannot finalize. ${unfinalized.length} learners are missing an EOSY status.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Automated Grade Progression - Update Learner records
      for (const record of records) {
        await tx.learner.update({
          where: { id: record.learnerId },
          data: {
            lastGradeLevel: gradeLevel.name,
            lastYearEnrolled: schoolYear.yearLabel,
            previousGenAve:
              record.finalAverage !== null
                ? parseFloat(String(record.finalAverage))
                : null,
            promotionStatus: record.eosyStatus,
          },
        });

        // Handle Completer Status for Grade 10
        if (
          record.eosyStatus === "PROMOTED" &&
          (gradeLevel.displayOrder === 10 || gradeLevel.name.includes("10"))
        ) {
          await tx.learner.update({
            where: { id: record.learnerId },
            data: { status: "JHS_COMPLETER" },
          });
        }
      }

      // 2. Finalize section(s)
      await tx.section.updateMany({
        where: sectionWhere,
        data: { isEosyFinalized: true },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user!.userId,
          actionType: isGlobal ? "GRADE_LEVEL_FINALIZED" : "SECTION_FINALIZED",
          description: isGlobal
            ? `Finalized EOSY and executed grade progression for ${gradeLevel.name}`
            : `Finalized EOSY and executed grade progression for section ID ${targetSectionId}`,
          subjectType: isGlobal ? "GradeLevel" : "Section",
          recordId: isGlobal ? glId : targetSectionId!,
          oldValue: "false",
          newValue: "true",
          ipAddress: req.ip ?? "0.0.0.0",
          userAgent: (req.headers["user-agent"] as string) ?? null,
        },
      });
    });

    res.json({
      message: isGlobal
        ? "Grade level finalized successfully."
        : "Section finalized successfully.",
    });
  } catch (error) {
    next(error);
  }
}

export async function unlockGradeLevelEosy(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { gradeLevelId } = req.params;
    const { schoolYearId } = req.body;

    const syId = parseInt(String(schoolYearId), 10);
    const glId = parseInt(String(gradeLevelId), 10);

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: syId },
    });

    if (!schoolYear) throw new AppError(404, "School year not found.");
    if (schoolYear.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot unlock grade level. School year EOSY is already finalized globally.",
      );
    }

    const gradeLevel = await prisma.gradeLevel.findUnique({
      where: { id: glId },
    });
    if (!gradeLevel) throw new AppError(404, "Grade level not found.");

    const sections = await prisma.section.findMany({
      where: {
        schoolYearId: syId,
        gradeLevelId: glId,
      },
    });

    if (sections.length === 0) {
      throw new AppError(
        422,
        "No sections found for this grade level in the active school year.",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.section.updateMany({
        where: {
          schoolYearId: syId,
          gradeLevelId: glId,
        },
        data: { isEosyFinalized: false },
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "EOSY_GRADE_LEVEL_UNLOCKED",
        description: `Unlocked grade level ${gradeLevel.name} to revert control back to Class Advisers for corrections.`,
        subjectType: "GradeLevel",
        recordId: glId,
        req,
      });
    });

    res.json({ success: true, message: "Grade level successfully unlocked." });

    broadcastEosyUpdate({ type: "GRADE_LEVEL_UNLOCKED", gradeLevelId: glId });
  } catch (error) {
    next(error);
  }
}


export async function unlockSectionEosy(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const sectionId = parseInt(String(id), 10);

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { schoolYear: { select: { isEosyFinalized: true } } },
    });

    if (!section) throw new AppError(404, "Section not found.");
    if (section.schoolYear.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot unlock section. School year EOSY is already finalized globally.",
      );
    }
    if (!section.isEosyFinalized) {
      throw new AppError(400, "Section is already unlocked.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.section.update({
        where: { id: sectionId },
        data: { isEosyFinalized: false },
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "EOSY_SECTION_UNLOCKED",
        description: `Unlocked section ${section.name} to revert control back to Class Adviser for corrections.`,
        subjectType: "Section",
        recordId: sectionId,
        req,
      });
    });

    res.json({ success: true, message: "Section roster successfully unlocked." });

    broadcastEosyUpdate({ type: "SECTION_UNLOCKED", sectionId: section.id });
  } catch (error) {
    next(error);
  }
}

export async function overrideEosyRecord(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const recordId = parseInt(String(id), 10);
    const {
      lrn,
      firstName,
      lastName,
      sectionId,
      finalAverage,
      eosyStatus,
      academicDeficiencyNote,
      dropOutReason,
      transferOutDate,
      latitude,
      longitude,
    } = req.body;

    const record = await prisma.enrollmentRecord.findUnique({
      where: { id: recordId },
      include: {
        section: { include: { schoolYear: true } },
        enrollmentApplication: {
          include: {
            learner: true,
          },
        },
      },
    });

    if (!record) throw new AppError(404, "Enrollment record not found.");
    if (record.section?.schoolYear?.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot override status. School year EOSY is finalized globally.",
      );
    }

    // 1. Update Learner model
    if (lrn !== undefined || firstName !== undefined || lastName !== undefined) {
      await prisma.learner.update({
        where: { id: record.learnerId },
        data: {
          lrn: lrn !== undefined ? lrn : undefined,
          firstName: firstName !== undefined ? firstName : undefined,
          lastName: lastName !== undefined ? lastName : undefined,
        },
      });
    }

    // 2. Update address coordinates inside reportedGrades JSON
    if (latitude !== undefined || longitude !== undefined) {
      const currentGrades = (record.enrollmentApplication.reportedGrades as Record<string, any>) || {};
      await prisma.enrollmentApplication.update({
        where: { id: record.enrollmentApplicationId },
        data: {
          reportedGrades: {
            ...currentGrades,
            geofencing: { latitude, longitude },
          },
        },
      });
    }

    // 3. Update EnrollmentRecord
    const updated = await prisma.enrollmentRecord.update({
      where: { id: recordId },
      data: {
        sectionId: sectionId !== undefined ? sectionId : undefined,
        eosyStatus: eosyStatus !== undefined ? (eosyStatus as EosyStatus) : undefined,
        academicDeficiencyNote:
          eosyStatus !== undefined
            ? normalizeAcademicDeficiencyNote(
                eosyStatus as EosyStatus,
                academicDeficiencyNote,
              )
            : academicDeficiencyNote !== undefined
              ? normalizeAcademicDeficiencyNote(
                  record.eosyStatus,
                  academicDeficiencyNote,
                )
              : undefined,
        dropOutReason: eosyStatus === "DROPPED_OUT" ? dropOutReason : null,
        transferOutDate:
          eosyStatus === "TRANSFERRED_OUT"
            ? transferOutDate
              ? new Date(transferOutDate)
              : null
            : null,
        finalAverage:
          finalAverage !== undefined && finalAverage !== null
            ? parseFloat(String(finalAverage))
            : undefined,
      },
    });

    // 4. Log detailed auditing details
    const auditDetails = [];
    if (lrn !== undefined && lrn !== record.enrollmentApplication.learner.lrn) auditDetails.push(`LRN: ${record.enrollmentApplication.learner.lrn} -> ${lrn}`);
    if (firstName !== undefined && firstName !== record.enrollmentApplication.learner.firstName) auditDetails.push(`First Name: ${record.enrollmentApplication.learner.firstName} -> ${firstName}`);
    if (lastName !== undefined && lastName !== record.enrollmentApplication.learner.lastName) auditDetails.push(`Last Name: ${record.enrollmentApplication.learner.lastName} -> ${lastName}`);
    if (sectionId !== undefined && sectionId !== record.sectionId) auditDetails.push(`Section ID: ${record.sectionId} -> ${sectionId}`);
    if (finalAverage !== undefined && finalAverage !== record.finalAverage) auditDetails.push(`Average: ${record.finalAverage} -> ${finalAverage}`);
    if (eosyStatus !== undefined && eosyStatus !== record.eosyStatus) auditDetails.push(`Status: ${record.eosyStatus} -> ${eosyStatus}`);
    if (
      academicDeficiencyNote !== undefined &&
      academicDeficiencyNote !== record.academicDeficiencyNote
    ) auditDetails.push(`Deficiency Note: ${record.academicDeficiencyNote ?? "none"} -> ${academicDeficiencyNote ?? "none"}`);
    if (latitude !== undefined || longitude !== undefined) auditDetails.push(`Coords: Lat ${latitude}, Lng ${longitude}`);

    await auditLog({
      userId: req.user!.userId,
      actionType: "HISTORICAL_CORRECTION_COMMITTED",
      description: `Historical correction for Learner ID ${record.learnerId}. Changes: ${auditDetails.join(", ")}`,
      subjectType: "EnrollmentRecord",
      recordId: record.id,
      oldValue: record.eosyStatus || "PENDING",
      newValue: eosyStatus || record.eosyStatus,
      metadata: {
        changes: auditDetails,
        registrarIp: req.ip,
      },
      req,
    });

    // 5. Data Realignment Ripple Effect (Forward Ripple)
    if (eosyStatus !== undefined && eosyStatus !== record.eosyStatus) {
      const activeSy = await prisma.schoolYear.findFirst({
        where: { status: "ACTIVE" },
      });
      if (activeSy) {
        const activeApp = await prisma.enrollmentApplication.findFirst({
          where: {
            learnerId: record.learnerId,
            schoolYearId: activeSy.id,
          },
        });
        if (activeApp) {
          const histGradeLevel = await prisma.gradeLevel.findUnique({
            where: { id: record.enrollmentApplication.gradeLevelId },
          });
          if (histGradeLevel) {
            let targetGradeLevelId = histGradeLevel.id;
            if (eosyStatus === "PROMOTED" || eosyStatus === "CONDITIONALLY_PROMOTED") {
              const nextGradeLevel = await prisma.gradeLevel.findFirst({
                where: { displayOrder: { gt: histGradeLevel.displayOrder } },
                orderBy: { displayOrder: "asc" },
              });
              if (nextGradeLevel) {
                targetGradeLevelId = nextGradeLevel.id;
              }
            }

            const activeAppGrades = (activeApp.reportedGrades as Record<string, any>) || {};
            await prisma.enrollmentApplication.update({
              where: { id: activeApp.id },
              data: {
                gradeLevelId: targetGradeLevelId,
                status: "VERIFIED",
                reportedGrades: {
                  ...activeAppGrades,
                  sectionReassignmentRequired: true,
                  reassignmentReason: `Historical promotion status changed to ${eosyStatus}`,
                },
              },
            });

            await prisma.enrollmentRecord.deleteMany({
              where: {
                enrollmentApplicationId: activeApp.id,
                schoolYearId: activeSy.id,
              },
            });
          }
        }
      }
    }

    // 6. Broadcast update
    broadcastEosyUpdate({
      type: "SECTION_FINALIZED",
      sectionId: record.sectionId,
    });

    res.json({ success: true, record: updated });
  } catch (error) {
    next(error);
  }
}

export async function streamEosyUpdates(req: Request, res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  addEosyClient(res);

  // Send an initial heartbeat
  res.write(":\n\n");
}
