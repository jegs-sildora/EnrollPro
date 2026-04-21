import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import type { ApplicantType } from "../../generated/prisma/index.js";
import { SectioningEngine } from "../enrollment/services/sectioning-engine.service.js";

const sectioningEngine = new SectioningEngine(prisma);

export async function getBatchPrerequisites(req: Request, res: Response) {
	const { gradeLevelId } = req.params;
	const schoolYearId = req.query.schoolYearId
		? parseInt(String(req.query.schoolYearId))
		: null;

	if (!schoolYearId) {
		return res.status(400).json({ message: "School year ID is required" });
	}

	const prerequisites = await sectioningEngine.getPrerequisites(
		parseInt(String(gradeLevelId)),
		schoolYearId,
	);

	res.json(prerequisites);
}

export async function runBatchSectioning(req: Request, res: Response) {
	const { gradeLevelId, schoolYearId } = req.body;

	const preview = await sectioningEngine.runBatchSectioning(
		gradeLevelId,
		schoolYearId,
	);

	res.json(preview);
}

export async function commitBatchSectioning(req: Request, res: Response) {
	const { gradeLevelId, schoolYearId, assignments } = req.body;

	if (!assignments || assignments.length === 0) {
		return res.status(400).json({ message: "No assignments provided to commit" });
	}

	const results = await prisma.$transaction(async (tx) => {
		const createdRecords = [];

		for (const assignment of assignments) {
			// Update application status
			await tx.enrollmentApplication.update({
				where: { id: assignment.applicationId },
				data: { status: "OFFICIALLY_ENROLLED" },
			});

			// Create enrollment record
			const record = await tx.enrollmentRecord.create({
				data: {
					enrollmentApplicationId: assignment.applicationId,
					sectionId: assignment.sectionId,
					schoolYearId,
					enrolledById: req.user!.userId,
				},
			});

			createdRecords.push(record);
		}

		return createdRecords;
	});

	await auditLog({
		userId: req.user!.userId,
		actionType: "BATCH_SECTIONING_COMMITTED",
		description: `Committed batch sectioning for ${assignments.length} learners in Grade Level ID ${gradeLevelId}`,
		subjectType: "Section",
		recordId: gradeLevelId,
		req,
	});

	res.json({
		message: "Batch sectioning committed successfully",
		count: results.length,
	});
}

const VALID_PROGRAM_TYPES = new Set([
  "REGULAR",
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
  "SPECIAL_PROGRAM_IN_JOURNALISM",
  "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
  "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
]);
const INACTIVE_EOSY_STATUSES = ["TRANSFERRED_OUT", "DROPPED_OUT"] as const;

export async function listSections(req: Request, res: Response): Promise<void> {
  const ayId = req.params.ayId ? parseInt(req.params.ayId as string) : null;
  const { gradeLevelId, programType } = req.query;

  const normalizedProgramType =
    typeof programType === "string" ? programType : undefined;
  if (
    normalizedProgramType &&
    !VALID_PROGRAM_TYPES.has(normalizedProgramType)
  ) {
    res.status(400).json({ message: "Invalid programType filter" });
    return;
  }

  if (gradeLevelId) {
    const where: Record<string, any> = {
      gradeLevelId: parseInt(gradeLevelId as string),
    };
    if (normalizedProgramType) {
      where.programType = normalizedProgramType;
    }

    const sections = await prisma.section.findMany({
      where,
      include: {
        advisingTeacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
        _count: {
          select: {
            enrollmentRecords: {
              where: {
                NOT: {
                  eosyStatus: {
                    in: [...INACTIVE_EOSY_STATUSES],
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    });
    // Format teacher names
    const formatted = sections.map((s) => ({
      ...s,
      displayName: s.displayName ?? s.name,
      advisingTeacher: s.advisingTeacher
        ? {
            id: s.advisingTeacher.id,
            name: `${s.advisingTeacher.lastName}, ${s.advisingTeacher.firstName}${s.advisingTeacher.middleName ? ` ${s.advisingTeacher.middleName.charAt(0)}.` : ""}`,
          }
        : null,
    }));
    res.json({ sections: formatted });
    return;
  }

  if (!ayId) {
    res
      .status(400)
      .json({ message: "School Year ID or Grade Level ID is required" });
    return;
  }

  const whereClause: any = { schoolYearId: ayId };

  const gradeLevels = await prisma.gradeLevel.findMany({
    where: whereClause,
    orderBy: { displayOrder: "asc" },
    include: {
      sections: {
        ...(normalizedProgramType
          ? { where: { programType: normalizedProgramType as any } }
          : {}),
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
        include: {
          advisingTeacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
            },
          },
          _count: {
            select: {
              enrollmentRecords: {
                where: {
                  NOT: {
                    eosyStatus: {
                      in: [...INACTIVE_EOSY_STATUSES],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const result = gradeLevels.map((gl) => ({
    gradeLevelId: gl.id,
    gradeLevelName: gl.name,
    displayOrder: gl.displayOrder,
    sections: gl.sections.map((s) => ({
      id: s.id,
      name: s.name,
      displayName: s.displayName ?? s.name,
      sortOrder: s.sortOrder,
      programType: s.programType,
      maxCapacity: s.maxCapacity,
      enrolledCount: s._count.enrollmentRecords,
      fillPercent:
        s.maxCapacity > 0
          ? Math.round((s._count.enrollmentRecords / s.maxCapacity) * 100)
          : 0,
      advisingTeacher: s.advisingTeacher
        ? {
            id: s.advisingTeacher.id,
            name: `${s.advisingTeacher.lastName}, ${s.advisingTeacher.firstName}${s.advisingTeacher.middleName ? ` ${s.advisingTeacher.middleName.charAt(0)}.` : ""}`,
          }
        : null,
    })),
  }));

  res.json({ gradeLevels: result });
}

export async function listTeachers(req: Request, res: Response): Promise<void> {
  const teachers = await prisma.teacher.findMany({
    where: { isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      employeeId: true,
    },
    orderBy: { lastName: "asc" },
  });
  // Format the name for display in dropdowns
  const formatted = teachers.map((t) => ({
    id: t.id,
    name: `${t.lastName}, ${t.firstName}${t.middleName ? ` ${t.middleName.charAt(0)}.` : ""}`,
    employeeId: t.employeeId,
  }));
  res.json({ teachers: formatted });
}

export async function createSection(
  req: Request,
  res: Response,
): Promise<void> {
  const {
    name,
    displayName,
    sortOrder,
    maxCapacity,
    gradeLevelId,
    programType,
    advisingTeacherId,
  } = req.body;

  const normalizedName = typeof name === "string" ? name.trim() : "";
  if (!normalizedName || !gradeLevelId) {
    res.status(400).json({ message: "name and gradeLevelId are required" });
    return;
  }

  const normalizedProgramType =
    typeof programType === "string" && programType.trim().length > 0
      ? programType
      : "REGULAR";

  const normalizedDisplayName =
    typeof displayName === "string" && displayName.trim().length > 0
      ? displayName.trim()
      : normalizedName;

  const resolvedSortOrder =
    Number.isInteger(sortOrder) && Number(sortOrder) > 0
      ? Number(sortOrder)
      : ((
          await prisma.section.aggregate({
            where: {
              gradeLevelId,
              programType: normalizedProgramType as ApplicantType,
            },
            _max: { sortOrder: true },
          })
        )._max.sortOrder ?? 0) + 1;

  const section = await prisma.section.create({
    data: {
      name: normalizedName,
      displayName: normalizedDisplayName,
      sortOrder: resolvedSortOrder,
      maxCapacity: maxCapacity ?? 40,
      gradeLevelId,
      programType: normalizedProgramType as ApplicantType,
      advisingTeacherId: advisingTeacherId ?? null,
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SECTION_CREATED",
    description: `Created section "${normalizedDisplayName}"`,
    subjectType: "Section",
    recordId: section.id,
    req,
  });

  res.status(201).json({ section });
}

export async function updateSection(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(req.params.id as string);
  const {
    name,
    displayName,
    sortOrder,
    maxCapacity,
    programType,
    advisingTeacherId,
  } = req.body;

  const section = await prisma.section.findUnique({ where: { id } });
  if (!section) {
    res.status(404).json({ message: "Section not found" });
    return;
  }

  const normalizedName =
    typeof name === "string" && name.trim().length > 0 ? name.trim() : null;
  const normalizedDisplayName =
    typeof displayName === "string"
      ? displayName.trim()
      : displayName === null
        ? null
        : undefined;

  const shouldSyncDisplayNameFromName =
    normalizedName !== null &&
    normalizedDisplayName === undefined &&
    (section.displayName == null || section.displayName === section.name);

  const data: Record<string, unknown> = {
    ...(normalizedName ? { name: normalizedName } : {}),
    ...(maxCapacity !== undefined ? { maxCapacity } : {}),
    ...(programType !== undefined ? { programType } : {}),
    ...(sortOrder !== undefined ? { sortOrder } : {}),
    ...(advisingTeacherId !== undefined
      ? { advisingTeacherId: advisingTeacherId || null }
      : {}),
  };

  if (normalizedDisplayName !== undefined) {
    data.displayName = normalizedDisplayName || null;
  } else if (shouldSyncDisplayNameFromName && normalizedName) {
    data.displayName = normalizedName;
  }

  const updated = await prisma.section.update({
    where: { id },
    data,
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SECTION_UPDATED",
    description: `Updated section "${updated.name}"`,
    subjectType: "Section",
    recordId: id,
    req,
  });

  res.json({ section: updated });
}

export async function deleteSection(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(req.params.id as string);

  const section = await prisma.section.findUnique({
    where: { id },
    include: { _count: { select: { enrollmentRecords: true } } },
  });

  if (!section) {
    res.status(404).json({ message: "Section not found" });
    return;
  }

  if (section._count.enrollmentRecords > 0) {
    const learnerCount = section._count.enrollmentRecords;
    res.status(400).json({
      message: `Cannot delete section. Please un-enrol or transfer the ${learnerCount} learner${learnerCount === 1 ? "" : "s"} first.`,
    });
    return;
  }

  await prisma.section.delete({ where: { id } });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SECTION_DELETED",
    description: `Deleted section "${section.name}"`,
    subjectType: "Section",
    recordId: id,
    req,
  });

  res.json({ message: "Section deleted" });
}
