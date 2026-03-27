import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { generatePortalPin, hashPin } from "../learner/portal-pin.service.js";
import { searchStudents } from "./students.service.js";
import { normalizeDateToUtcNoon } from "../school-year/school-year.service.js";

export const getStudents = async (req: Request, res: Response) => {
  try {
    const { applicants, total, pageNum, limitNum } = await searchStudents(
      req.query as any,
    );

    // Transform data
    const students = applicants.map((applicant) => {
      const addr = applicant.currentAddress as any;
      const mother = applicant.motherName as any;
      const father = applicant.fatherName as any;
      const guardian = applicant.guardianInfo as any;
      const parentName = guardian?.firstName
        ? `${guardian.firstName} ${guardian.lastName}`
        : mother?.firstName
          ? `${mother.firstName} ${mother.lastName}`
          : father?.firstName
            ? `${father.firstName} ${father.lastName}`
            : null;
      const parentContact =
        guardian?.contactNumber ||
        mother?.contactNumber ||
        father?.contactNumber ||
        null;
      const addressStr = addr
        ? [addr.barangay, addr.cityMunicipality, addr.province]
            .filter(Boolean)
            .join(", ")
        : null;

      return {
        id: applicant.id,
        lrn: applicant.lrn,
        fullName: `${applicant.lastName}, ${applicant.firstName}${applicant.middleName ? ` ${applicant.middleName.charAt(0)}.` : ""}${applicant.suffix ? ` ${applicant.suffix}` : ""}`,
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        middleName: applicant.middleName,
        suffix: applicant.suffix,
        sex: applicant.sex,
        birthDate: applicant.birthDate,
        address: addressStr,
        parentGuardianName: parentName,
        parentGuardianContact: parentContact,
        emailAddress: applicant.emailAddress,
        trackingNumber: applicant.trackingNumber,
        status: applicant.status,
        gradeLevel: applicant.gradeLevel.name,
        gradeLevelId: applicant.gradeLevelId,
        strand: applicant.strand?.name || null,
        strandId: applicant.strandId,
        section: applicant.enrollment?.section.name || null,
        sectionId: applicant.enrollment?.sectionId || null,
        createdAt: applicant.createdAt,
        updatedAt: applicant.updatedAt,
      };
    });

    res.json({
      students,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ message: "Failed to fetch students" });
  }
};

export const getStudentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const applicant = await prisma.applicant.findUnique({
      where: { id: parseInt(id as string, 10) },
      include: {
        gradeLevel: true,
        strand: true,
        schoolYear: true,
        enrollment: {
          include: {
            section: {
              include: {
                advisingTeacher: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    middleName: true,
                  },
                },
              },
            },
            enrolledBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!applicant) {
      return res.status(404).json({ message: "Student not found" });
    }

    const addr = applicant.currentAddress as any;
    const mother = applicant.motherName as any;
    const father = applicant.fatherName as any;
    const guardian = applicant.guardianInfo as any;
    const parentName = guardian?.firstName
      ? `${guardian.firstName} ${guardian.lastName}`
      : mother?.firstName
        ? `${mother.firstName} ${mother.lastName}`
        : father?.firstName
          ? `${father.firstName} ${father.lastName}`
          : null;
    const parentContact =
      guardian?.contactNumber ||
      mother?.contactNumber ||
      father?.contactNumber ||
      null;
    const addressStr = addr
      ? [addr.barangay, addr.cityMunicipality, addr.province]
          .filter(Boolean)
          .join(", ")
      : null;

    const student = {
      id: applicant.id,
      lrn: applicant.lrn,
      fullName: `${applicant.lastName}, ${applicant.firstName}${applicant.middleName ? ` ${applicant.middleName.charAt(0)}.` : ""}${applicant.suffix ? ` ${applicant.suffix}` : ""}`,
      firstName: applicant.firstName,
      lastName: applicant.lastName,
      middleName: applicant.middleName,
      suffix: applicant.suffix,
      sex: applicant.sex,
      birthDate: applicant.birthDate,
      address: addressStr,
      currentAddress: applicant.currentAddress,
      permanentAddress: applicant.permanentAddress,
      motherName: applicant.motherName,
      fatherName: applicant.fatherName,
      guardianInfo: applicant.guardianInfo,
      parentGuardianName: parentName,
      parentGuardianContact: parentContact,
      emailAddress: applicant.emailAddress,
      trackingNumber: applicant.trackingNumber,
      status: applicant.status,
      rejectionReason: applicant.rejectionReason,
      gradeLevel: applicant.gradeLevel.name,
      gradeLevelId: applicant.gradeLevelId,
      strand: applicant.strand?.name || null,
      strandId: applicant.strandId,
      schoolYear: applicant.schoolYear.yearLabel,
      schoolYearId: applicant.schoolYearId,
      enrollment: applicant.enrollment
        ? {
            id: applicant.enrollment.id,
            section: applicant.enrollment.section.name,
            sectionId: applicant.enrollment.sectionId,
            advisingTeacher: applicant.enrollment.section.advisingTeacher
              ? `${applicant.enrollment.section.advisingTeacher.lastName}, ${applicant.enrollment.section.advisingTeacher.firstName}${applicant.enrollment.section.advisingTeacher.middleName ? ` ${applicant.enrollment.section.advisingTeacher.middleName.charAt(0)}.` : ""}`
              : null,
            enrolledAt: applicant.enrollment.enrolledAt,
            enrolledBy: `${applicant.enrollment.enrolledBy.lastName}, ${applicant.enrollment.enrolledBy.firstName}`,
          }
        : null,
      createdAt: applicant.createdAt,
      updatedAt: applicant.updatedAt,
    };

    res.json({ student });
  } catch (error) {
    console.error("Error fetching student:", error);
    res.status(500).json({ message: "Failed to fetch student details" });
  }
};

export const updateStudent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      middleName,
      suffix,
      sex,
      birthDate,
      currentAddress,
      permanentAddress,
      motherName,
      fatherName,
      guardianInfo,
      emailAddress,
    } = req.body;

    const applicant = await prisma.applicant.findUnique({
      where: { id: parseInt(id as string, 10) },
    });

    if (!applicant) {
      return res.status(404).json({ message: "Student not found" });
    }

    const updated = await prisma.applicant.update({
      where: { id: parseInt(id as string, 10) },
      data: {
        firstName,
        lastName,
        middleName,
        suffix,
        sex,
        birthDate: birthDate
          ? normalizeDateToUtcNoon(new Date(birthDate))
          : undefined,
        currentAddress: currentAddress ?? undefined,
        permanentAddress: permanentAddress ?? undefined,
        motherName: motherName ?? undefined,
        fatherName: fatherName ?? undefined,
        guardianInfo: guardianInfo ?? undefined,
        emailAddress,
      },
      include: {
        gradeLevel: true,
        strand: true,
        enrollment: {
          include: {
            section: true,
          },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.userId || null,
        actionType: "STUDENT_UPDATED",
        description: `Updated student record for ${updated.firstName} ${updated.lastName} (LRN: ${updated.lrn})`,
        subjectType: "Applicant",
        recordId: updated.id,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || null,
      },
    });

    res.json({ message: "Student updated successfully", student: updated });
  } catch (error) {
    console.error("Error updating student:", error);
    res.status(500).json({ message: "Failed to update student" });
  }
};

export const getHealthRecords = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const records = await prisma.healthRecord.findMany({
      where: { applicantId: parseInt(id as string, 10) },
      include: {
        schoolYear: {
          select: { yearLabel: true },
        },
        recordedBy: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { assessmentDate: "desc" },
    });

    res.json({ records });
  } catch (error) {
    console.error("Error fetching health records:", error);
    res.status(500).json({ message: "Failed to fetch health records" });
  }
};

export const addHealthRecord = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      schoolYearId,
      assessmentPeriod,
      assessmentDate,
      weightKg,
      heightCm,
      notes,
    } = req.body;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const parsedApplicantId = parseInt(id as string, 10);
    const parsedSchoolYearId = parseInt(schoolYearId as string, 10);

    const existingRecord = await prisma.healthRecord.findFirst({
      where: {
        applicantId: parsedApplicantId,
        schoolYearId: parsedSchoolYearId,
        assessmentPeriod,
      },
      include: {
        schoolYear: true,
      },
    });

    if (existingRecord) {
      const periodLabel = assessmentPeriod === "BOSY" ? "BoSY" : "EoSY";
      const yearLabel = existingRecord.schoolYear.yearLabel;
      return res.status(422).json({
        message: `A ${periodLabel} record already exists for this learner for SY ${yearLabel}.`,
      });
    }

    const record = await prisma.healthRecord.create({
      data: {
        applicantId: parsedApplicantId,
        schoolYearId: parsedSchoolYearId,
        assessmentPeriod,
        assessmentDate: normalizeDateToUtcNoon(new Date(assessmentDate)),
        weightKg: parseFloat(weightKg as string),
        heightCm: parseFloat(heightCm as string),
        notes,
        recordedById: userId,
      },
      include: {
        schoolYear: true,
        applicant: true,
        recordedBy: true,
      },
    });

    const userName = record.recordedBy
      ? `${record.recordedBy.firstName} ${record.recordedBy.lastName}`
      : "Registrar";
    const learnerName = `${record.applicant.firstName} ${record.applicant.lastName}`;
    const yearLabel = record.schoolYear.yearLabel;
    const periodLabel = assessmentPeriod === "BOSY" ? "BoSY" : "EoSY";

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        actionType: "HEALTH_RECORD_ADDED",
        description: `${userName} added ${periodLabel} health record for ${learnerName}, SY ${yearLabel} — Weight: ${record.weightKg}kg, Height: ${record.heightCm}cm`,
        subjectType: "HealthRecord",
        recordId: record.id,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || null,
      },
    });

    res
      .status(201)
      .json({ message: "Health record added successfully", record });
  } catch (error) {
    console.error("Error adding health record:", error);
    res.status(500).json({ message: "Failed to add health record" });
  }
};

export const updateHealthRecord = async (req: Request, res: Response) => {
  try {
    const { id, recId } = req.params;
    const { assessmentPeriod, assessmentDate, weightKg, heightCm, notes } =
      req.body;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const record = await prisma.healthRecord.update({
      where: { id: parseInt(recId as string, 10) },
      data: {
        assessmentPeriod,
        assessmentDate: assessmentDate
          ? normalizeDateToUtcNoon(new Date(assessmentDate))
          : undefined,
        weightKg: weightKg ? parseFloat(weightKg as string) : undefined,
        heightCm: heightCm ? parseFloat(heightCm as string) : undefined,
        notes,
      },
      include: {
        applicant: true,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const userName = user ? `${user.firstName} ${user.lastName}` : "Registrar";
    const learnerName = `${record.applicant.firstName} ${record.applicant.lastName}`;

    const changedFields = [];
    if (assessmentPeriod) changedFields.push("period");
    if (assessmentDate) changedFields.push("date");
    if (weightKg) changedFields.push("weight");
    if (heightCm) changedFields.push("height");
    if (notes !== undefined) changedFields.push("notes");
    const changedStr =
      changedFields.length > 0 ? changedFields.join(", ") : "details";

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        actionType: "HEALTH_RECORD_UPDATED",
        description: `${userName} updated health record #${record.id} for ${learnerName} — Changed: ${changedStr}`,
        subjectType: "HealthRecord",
        recordId: record.id,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || null,
      },
    });

    res.json({ message: "Health record updated successfully", record });
  } catch (error) {
    console.error("Error updating health record:", error);
    res.status(500).json({ message: "Failed to update health record" });
  }
};

export const resetPortalPin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { raw: newPin, hash: hashedPin } = generatePortalPin();

    const applicantId = parseInt(id as string, 10);
    const applicant = await prisma.applicant.update({
      where: { id: applicantId },
      data: {
        portalPin: hashedPin,
        portalPinChangedAt: new Date(),
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const userName = user ? `${user.firstName} ${user.lastName}` : "Registrar";
    const learnerName = `${applicant.firstName} ${applicant.lastName}`;

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        actionType: "PORTAL_PIN_RESET",
        description: `${userName} reset portal PIN for LRN ${applicant.lrn} — ${learnerName}`,
        subjectType: "Applicant",
        recordId: applicantId,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || null,
      },
    });

    res.json({ message: "Portal PIN reset successfully", pin: newPin });
  } catch (error) {
    console.error("Error resetting portal PIN:", error);
    res.status(500).json({ message: "Failed to reset portal PIN" });
  }
};
