import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function buildFullName(
  lastName: string,
  firstName: string,
  middleName?: string | null,
) {
  return `${lastName}, ${firstName}${middleName ? ` ${middleName}` : ""}`;
}

export async function getStudents(req: Request, res: Response): Promise<void> {
  const page = parsePositiveInt(req.query.page, 1);
  const limit = parsePositiveInt(req.query.limit, 15);
  const skip = (page - 1) * limit;

  const schoolYearId = Number.parseInt(
    String(req.query.schoolYearId ?? ""),
    10,
  );
  if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
    res.status(400).json({ message: "schoolYearId is required" });
    return;
  }

  const search = String(req.query.search ?? "").trim();
  const gradeLevelId = Number.parseInt(
    String(req.query.gradeLevelId ?? ""),
    10,
  );
  const statusFilter = String(req.query.status ?? "")
    .trim()
    .toUpperCase();

  const where: Record<string, unknown> = { schoolYearId };

  if (Number.isInteger(gradeLevelId) && gradeLevelId > 0) {
    where.gradeLevelId = gradeLevelId;
  }

  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter;
  }

  if (search) {
    const searchFilter = {
      OR: [
        {
          learner: { lrn: { contains: search, mode: "insensitive" as const } },
        },
        {
          learner: {
            firstName: { contains: search, mode: "insensitive" as const },
          },
        },
        {
          learner: {
            lastName: { contains: search, mode: "insensitive" as const },
          },
        },
      ],
    };

    where.AND = Array.isArray(where.AND)
      ? [...(where.AND as unknown[]), searchFilter]
      : [searchFilter];
  }

  const [total, rows] = await Promise.all([
    prisma.earlyRegistrationApplication.count({ where }),
    prisma.earlyRegistrationApplication.findMany({
      where,
      include: {
        learner: true,
        gradeLevel: true,
      },
      orderBy: { submittedAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  const students = rows.map((row) => ({
    id: row.id,
    lrn: row.learner.lrn || "",
    fullName: buildFullName(
      row.learner.lastName,
      row.learner.firstName,
      row.learner.middleName,
    ),
    firstName: row.learner.firstName,
    lastName: row.learner.lastName,
    middleName: row.learner.middleName,
    suffix: row.learner.extensionName,
    sex: row.learner.sex,
    birthDate: row.learner.birthdate,
    address: "N/A",
    parentGuardianName: "N/A",
    parentGuardianContact: row.contactNumber,
    emailAddress: row.email || "",
    trackingNumber: row.trackingNumber,
    status: row.status,
    gradeLevel: row.gradeLevel?.name || "",
    gradeLevelId: row.gradeLevelId,
    section: null,
    sectionId: null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  res.json({
    students,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}

export async function getStudentById(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parsePositiveInt(req.params.id, 0);
  if (!id) {
    res.status(400).json({ message: "Invalid student id" });
    return;
  }

  const row = await prisma.earlyRegistrationApplication.findUnique({
    where: { id },
    include: {
      learner: true,
      familyMembers: true,
      gradeLevel: true,
      schoolYear: true,
    },
  });

  if (!row) {
    res.status(404).json({ message: "Student not found" });
    return;
  }

  const familyMembers = row.familyMembers;
  const mother = familyMembers.find((g) => g.relationship === "MOTHER");
  const father = familyMembers.find((g) => g.relationship === "FATHER");
  const guardian = familyMembers.find((g) => g.relationship === "GUARDIAN");

  res.json({
    student: {
      id: row.id,
      studentPhoto: null,
      lrn: row.learner.lrn,
      lastName: row.learner.lastName,
      firstName: row.learner.firstName,
      middleName: row.learner.middleName,
      suffix: row.learner.extensionName,
      birthDate: row.learner.birthdate,
      sex: row.learner.sex,
      placeOfBirth: row.learner.placeOfBirth,
      religion: row.learner.religion,
      motherTongue: row.learner.motherTongue,
      currentAddress: null,
      permanentAddress: null,
      motherName: mother || null,
      fatherName: father || null,
      guardianInfo: guardian || null,
      emailAddress: row.email,
      trackingNumber: row.trackingNumber,
      status: row.status,
      rejectionReason: null,
      gradeLevel: {
        id: row.gradeLevel?.id || 0,
        name: row.gradeLevel?.name || "",
      },
      schoolYear: {
        id: row.schoolYear.id,
        yearLabel: row.schoolYear.yearLabel,
      },
      enrollment: null,
      healthRecords: [],
      assessments: [],
      programDetail: null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
  });
}

function notAvailable(res: Response, action: string): void {
  res.status(410).json({
    message: `${action} is unavailable after legacy applicant stack removal.`,
  });
}

export async function updateStudent(
  _req: Request,
  res: Response,
): Promise<void> {
  notAvailable(res, "Student profile update");
}

export async function getHealthRecords(
  _req: Request,
  res: Response,
): Promise<void> {
  notAvailable(res, "Health records");
}

export async function addHealthRecord(
  _req: Request,
  res: Response,
): Promise<void> {
  notAvailable(res, "Health record creation");
}

export async function updateHealthRecord(
  _req: Request,
  res: Response,
): Promise<void> {
  notAvailable(res, "Health record update");
}

export async function resetPortalPin(
  _req: Request,
  res: Response,
): Promise<void> {
  notAvailable(res, "Portal PIN reset");
}
