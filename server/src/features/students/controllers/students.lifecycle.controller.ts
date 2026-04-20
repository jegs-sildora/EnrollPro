import { Prisma } from "../../../generated/prisma/index.js";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../lib/AppError.js";
import { auditLog } from "../../audit-logs/audit-logs.service.js";
import {
  createStudentsControllerDeps,
  type StudentsControllerDeps,
} from "../services/students-controller.deps.js";

const ACTIVE_ENROLLMENT_STATUSES = new Set(["ENROLLED", "OFFICIALLY_ENROLLED"]);
const INACTIVE_OUTCOMES = ["TRANSFERRED_OUT", "DROPPED_OUT"] as const;

function parseStudentId(req: Request): number {
  const studentId = Number.parseInt(String(req.params.id ?? ""), 10);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new AppError(400, "Invalid student id");
  }

  return studentId;
}

function parseDateInput(value: Date | string): Date {
  const parsedDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError(422, "Invalid date provided");
  }

  return parsedDate;
}

function formatLearnerName(learner: {
  firstName: string;
  lastName: string;
  middleName?: string | null;
}) {
  const middleInitial = learner.middleName?.trim()
    ? ` ${learner.middleName.trim().charAt(0)}.`
    : "";

  return `${learner.lastName}, ${learner.firstName}${middleInitial}`;
}

function buildDropOutReason(reasonCode: string, reasonNote?: string | null) {
  const trimmedReasonNote = reasonNote?.trim() || null;
  if (!trimmedReasonNote) {
    return reasonCode;
  }

  return `${reasonCode}: ${trimmedReasonNote}`;
}

async function findStudentOrThrow(
  deps: StudentsControllerDeps,
  studentId: number,
) {
  const application = await deps.prisma.enrollmentApplication.findUnique({
    where: { id: studentId },
    include: {
      learner: true,
      gradeLevel: true,
      schoolYear: true,
      programDetail: true,
      enrollmentRecord: {
        include: {
          section: {
            include: {
              gradeLevel: {
                select: { schoolYearId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!application) {
    throw new AppError(404, "Learner enrollment record not found");
  }

  if (!application.enrollmentRecord) {
    throw new AppError(422, "Learner is not assigned to any section");
  }

  if (!ACTIVE_ENROLLMENT_STATUSES.has(application.status)) {
    throw new AppError(
      422,
      `Lifecycle actions are only allowed for enrolled learners. Current status: \"${application.status}\".`,
    );
  }

  if (application.schoolYear.isEosyFinalized) {
    throw new AppError(
      422,
      "School year EOSY is finalized. Learner lifecycle actions are locked.",
    );
  }

  if (application.enrollmentRecord.section.isEosyFinalized) {
    throw new AppError(
      422,
      "Section EOSY is finalized. Learner lifecycle actions are locked.",
    );
  }

  return application as typeof application & {
    enrollmentRecord: NonNullable<typeof application.enrollmentRecord>;
  };
}

function assertSectionShiftWindowOpen(
  deps: StudentsControllerDeps,
  schoolYear: {
    classOpeningDate: Date | null;
    sectionShiftWindowDays: number | null;
  },
) {
  const { classOpeningDate, sectionShiftWindowDays } = schoolYear;
  if (
    !classOpeningDate ||
    !sectionShiftWindowDays ||
    sectionShiftWindowDays <= 0
  ) {
    return;
  }

  const classOpening = deps.normalizeDateToUtcNoon(classOpeningDate);
  const shiftWindowCutoff = new Date(classOpening.getTime());
  shiftWindowCutoff.setUTCDate(
    shiftWindowCutoff.getUTCDate() + sectionShiftWindowDays,
  );

  const today = deps.normalizeDateToUtcNoon(new Date());
  if (today.getTime() > shiftWindowCutoff.getTime()) {
    throw new AppError(
      422,
      `Section shifts are closed for this school year. Allowed until ${shiftWindowCutoff.toISOString().slice(0, 10)}.`,
    );
  }
}

export const createStudentsLifecycleController = (
  deps: StudentsControllerDeps = createStudentsControllerDeps(),
) => {
  const transferOutStudent = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const studentId = parseStudentId(req);
      const { transferOutDate, destinationSchool, reason } = req.body;
      const application = await findStudentOrThrow(deps, studentId);

      const updatedRecord = await deps.prisma.enrollmentRecord.update({
        where: { id: application.enrollmentRecord.id },
        data: {
          eosyStatus: "TRANSFERRED_OUT",
          transferOutDate: deps.normalizeDateToUtcNoon(
            parseDateInput(transferOutDate),
          ),
          transferOutSchoolName: destinationSchool.trim(),
          transferOutReason: reason?.trim() || null,
          dropOutReason: null,
          dropOutDate: null,
        },
        include: {
          section: {
            select: { id: true, name: true, programType: true },
          },
        },
      });

      await auditLog({
        userId: req.user?.userId ?? null,
        actionType: "LEARNER_TRANSFERRED_OUT",
        description: `Marked ${formatLearnerName(application.learner)} as TRANSFERRED_OUT effective ${updatedRecord.transferOutDate?.toISOString().slice(0, 10)} to ${updatedRecord.transferOutSchoolName}.`,
        subjectType: "EnrollmentRecord",
        recordId: updatedRecord.id,
        req,
      });

      res.json({
        message: "Learner marked as transferred out.",
        lifecycle: {
          eosyStatus: updatedRecord.eosyStatus,
          transferOutDate: updatedRecord.transferOutDate,
          transferOutSchoolName: updatedRecord.transferOutSchoolName,
          transferOutReason: updatedRecord.transferOutReason,
          dropOutDate: updatedRecord.dropOutDate,
          dropOutReason: updatedRecord.dropOutReason,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  const dropOutStudent = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const studentId = parseStudentId(req);
      const { dropOutDate, reasonCode, reasonNote } = req.body;
      const application = await findStudentOrThrow(deps, studentId);

      const updatedRecord = await deps.prisma.enrollmentRecord.update({
        where: { id: application.enrollmentRecord.id },
        data: {
          eosyStatus: "DROPPED_OUT",
          dropOutDate: deps.normalizeDateToUtcNoon(parseDateInput(dropOutDate)),
          dropOutReason: buildDropOutReason(reasonCode, reasonNote),
          transferOutDate: null,
          transferOutSchoolName: null,
          transferOutReason: null,
        },
      });

      await auditLog({
        userId: req.user?.userId ?? null,
        actionType: "LEARNER_DROPPED_OUT",
        description: `Marked ${formatLearnerName(application.learner)} as DROPPED_OUT effective ${updatedRecord.dropOutDate?.toISOString().slice(0, 10)} (${updatedRecord.dropOutReason ?? "N/A"}).`,
        subjectType: "EnrollmentRecord",
        recordId: updatedRecord.id,
        req,
      });

      res.json({
        message: "Learner marked as dropped out.",
        lifecycle: {
          eosyStatus: updatedRecord.eosyStatus,
          transferOutDate: updatedRecord.transferOutDate,
          transferOutSchoolName: updatedRecord.transferOutSchoolName,
          transferOutReason: updatedRecord.transferOutReason,
          dropOutDate: updatedRecord.dropOutDate,
          dropOutReason: updatedRecord.dropOutReason,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  const shiftStudentSection = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const studentId = parseStudentId(req);
      const { sectionId } = req.body;
      const application = await findStudentOrThrow(deps, studentId);

      assertSectionShiftWindowOpen(deps, {
        classOpeningDate: application.schoolYear.classOpeningDate,
        sectionShiftWindowDays: application.schoolYear.sectionShiftWindowDays,
      });

      const targetSection = await deps.prisma.section.findUnique({
        where: { id: sectionId },
        include: {
          gradeLevel: {
            select: {
              id: true,
              name: true,
              schoolYearId: true,
            },
          },
        },
      });

      if (!targetSection) {
        throw new AppError(404, "Target section not found");
      }

      if (targetSection.gradeLevel.schoolYearId !== application.schoolYearId) {
        throw new AppError(
          422,
          "Target section must belong to the same school year as the learner.",
        );
      }

      if (targetSection.gradeLevel.id !== application.gradeLevelId) {
        throw new AppError(
          422,
          "Target section must belong to the same grade level as the learner.",
        );
      }

      if (targetSection.id !== application.enrollmentRecord.sectionId) {
        const activeLearnerCount = await deps.prisma.enrollmentRecord.count({
          where: {
            sectionId: targetSection.id,
            NOT: {
              eosyStatus: {
                in: [...INACTIVE_OUTCOMES],
              },
            },
          },
        });

        if (activeLearnerCount >= targetSection.maxCapacity) {
          throw new AppError(
            422,
            "Target section has reached maximum capacity.",
          );
        }
      }

      const previousSectionName = application.enrollmentRecord.section.name;
      const previousProgramType =
        application.enrollmentRecord.section.programType;
      const targetProgramType = targetSection.programType;

      const updatedEnrollmentRecord = await deps.prisma.$transaction(
        async (tx) => {
          const updatedRecord = await tx.enrollmentRecord.update({
            where: { id: application.enrollmentRecord.id },
            data: {
              sectionId: targetSection.id,
              eosyStatus: null,
              transferOutDate: null,
              transferOutSchoolName: null,
              transferOutReason: null,
              dropOutDate: null,
              dropOutReason: null,
            },
            include: {
              section: {
                select: {
                  id: true,
                  name: true,
                  programType: true,
                },
              },
            },
          });

          if (previousProgramType !== targetProgramType) {
            await tx.enrollmentApplication.update({
              where: { id: studentId },
              data: {
                applicantType: targetProgramType,
              },
            });

            if (targetProgramType === "REGULAR") {
              await tx.enrollmentProgramDetail.deleteMany({
                where: { applicationId: studentId },
              });
            } else {
              await tx.enrollmentProgramDetail.upsert({
                where: { applicationId: studentId },
                update: {
                  scpType: targetProgramType,
                },
                create: {
                  applicationId: studentId,
                  scpType: targetProgramType,
                  sportsList: [],
                },
              });
            }
          }

          return updatedRecord;
        },
      );

      await auditLog({
        userId: req.user?.userId ?? null,
        actionType: "LEARNER_SECTION_SHIFTED",
        description: `Moved ${formatLearnerName(application.learner)} from ${previousSectionName} to ${updatedEnrollmentRecord.section.name}${previousProgramType !== targetProgramType ? ` and changed program from ${previousProgramType} to ${targetProgramType}` : ""}.`,
        subjectType: "EnrollmentRecord",
        recordId: updatedEnrollmentRecord.id,
        req,
      });

      res.json({
        message: "Learner section assignment updated.",
        enrollment: {
          sectionId: updatedEnrollmentRecord.section.id,
          sectionName: updatedEnrollmentRecord.section.name,
          programType: updatedEnrollmentRecord.section.programType,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  const assignStudentLrn = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const studentId = parseStudentId(req);
      const lrn = String(req.body?.lrn ?? "").trim();

      if (!/^\d{12}$/.test(lrn)) {
        throw new AppError(422, "LRN must be exactly 12 digits.");
      }

      const application = await deps.prisma.enrollmentApplication.findUnique({
        where: { id: studentId },
        include: {
          learner: true,
        },
      });

      if (!application) {
        throw new AppError(404, "Learner enrollment record not found");
      }

      try {
        await deps.prisma.learner.update({
          where: { id: application.learnerId },
          data: {
            lrn,
            isPendingLrnCreation: false,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new AppError(409, "LRN already exists.");
        }

        throw error;
      }

      await auditLog({
        userId: req.user?.userId ?? null,
        actionType: "LEARNER_LRN_ASSIGNED",
        description: `Assigned LRN ${lrn} to ${formatLearnerName(application.learner)} from Learner Directory.`,
        subjectType: "Learner",
        recordId: application.learnerId,
        req,
      });

      res.json({
        message: "LRN assigned successfully.",
        learnerId: application.learnerId,
        lrn,
      });
    } catch (error) {
      next(error);
    }
  };

  return {
    transferOutStudent,
    dropOutStudent,
    shiftStudentSection,
    assignStudentLrn,
  };
};

const studentsLifecycleController = createStudentsLifecycleController();

export const {
  transferOutStudent,
  dropOutStudent,
  shiftStudentSection,
  assignStudentLrn,
} = studentsLifecycleController;
