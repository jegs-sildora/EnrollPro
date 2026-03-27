import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { generatePortalPin, hashPin } from "../services/portalPinService.js";
import { searchStudents } from "../services/studentService.js";

export const getStudents = async (req: Request, res: Response) => {
  try {
    const result = await searchStudents(req.query as any);
    res.json(result);
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
                name: true,
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
            enrolledBy: applicant.enrollment.enrolledBy.name,
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
        birthDate: birthDate ? new Date(birthDate) : undefined,
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
          select: { yearLabel: true }
        },
        recordedBy: {
          select: { name: true }
        }
      },
      orderBy: { assessmentDate: "desc" }
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
    const { schoolYearId, assessmentPeriod, assessmentDate, weightKg, heightCm, notes } = req.body;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const record = await prisma.healthRecord.create({
      data: {
        applicantId: parseInt(id as string, 10),
        schoolYearId: parseInt(schoolYearId as string, 10),
        assessmentPeriod,
        assessmentDate: new Date(assessmentDate),
        weightKg: parseFloat(weightKg as string),
        heightCm: parseFloat(heightCm as string),
        notes,
        recordedById: userId
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        actionType: "HEALTH_RECORD_ADDED",
        description: `Added health record for student ID ${id} (${assessmentPeriod})`,
        subjectType: "HealthRecord",
        recordId: record.id,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || null,
      },
    });

    res.json({ message: "Health record added successfully", record });
  } catch (error) {
    console.error("Error adding health record:", error);
    res.status(500).json({ message: "Failed to add health record" });
  }
};

export const updateHealthRecord = async (req: Request, res: Response) => {
  try {
    const { id, recId } = req.params;
    const { assessmentPeriod, assessmentDate, weightKg, heightCm, notes } = req.body;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const record = await prisma.healthRecord.update({
      where: { id: parseInt(recId as string, 10) },
      data: {
        assessmentPeriod,
        assessmentDate: assessmentDate ? new Date(assessmentDate) : undefined,
        weightKg: weightKg ? parseFloat(weightKg as string) : undefined,
        heightCm: heightCm ? parseFloat(heightCm as string) : undefined,
        notes,
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        actionType: "HEALTH_RECORD_UPDATED",
        description: `Updated health record ID ${recId} for student ID ${id}`,
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

    const newPin = generatePortalPin();
    const hashedPin = await hashPin(newPin);

    await prisma.applicant.update({
      where: { id: parseInt(id as string, 10) },
      data: {
        portalPin: hashedPin,
        portalPinChangedAt: new Date()
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        actionType: "PORTAL_PIN_RESET",
        description: `Reset portal PIN for student ID ${id}`,
        subjectType: "Applicant",
        recordId: parseInt(id as string, 10),
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
