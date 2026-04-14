import { Request, Response } from "express";
import {
  createStudentsControllerDeps,
  StudentsControllerDeps,
} from "../services/students-controller.deps.js";

const getRequestUserId = (req: Request): number | null => {
  const userId = (req as any).user?.userId;
  return typeof userId === "number" ? userId : null;
};

export const createStudentsProfileController = (
  deps: StudentsControllerDeps = createStudentsControllerDeps(),
) => {
  const updateStudent = async (req: Request, res: Response) => {
    try {
      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) {
        return res.status(400).json({ message: "Invalid student id" });
      }

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

      const applicant = await deps.prisma.applicant.findUnique({
        where: { id: parsedId },
      });

      if (!applicant) {
        return res.status(404).json({ message: "Student not found" });
      }

      const updated = await deps.prisma.$transaction(async (tx) => {
        if (currentAddress) {
          await tx.applicantAddress.upsert({
            where: {
              uq_applicant_addresses_type: {
                applicantId: parsedId,
                addressType: "CURRENT",
              },
            },
            update: currentAddress,
            create: {
              applicantId: parsedId,
              addressType: "CURRENT",
              ...currentAddress,
            },
          });
        }

        if (permanentAddress) {
          await tx.applicantAddress.upsert({
            where: {
              uq_applicant_addresses_type: {
                applicantId: parsedId,
                addressType: "PERMANENT",
              },
            },
            update: permanentAddress,
            create: {
              applicantId: parsedId,
              addressType: "PERMANENT",
              ...permanentAddress,
            },
          });
        }

        if (motherName) {
          await tx.applicantFamilyMember.upsert({
            where: {
              uq_applicant_family_members_rel: {
                applicantId: parsedId,
                relationship: "MOTHER",
              },
            },
            update: motherName,
            create: {
              applicantId: parsedId,
              relationship: "MOTHER",
              ...motherName,
            },
          });
        }

        if (fatherName) {
          await tx.applicantFamilyMember.upsert({
            where: {
              uq_applicant_family_members_rel: {
                applicantId: parsedId,
                relationship: "FATHER",
              },
            },
            update: fatherName,
            create: {
              applicantId: parsedId,
              relationship: "FATHER",
              ...fatherName,
            },
          });
        }

        if (guardianInfo) {
          await tx.applicantFamilyMember.upsert({
            where: {
              uq_applicant_family_members_rel: {
                applicantId: parsedId,
                relationship: "GUARDIAN",
              },
            },
            update: guardianInfo,
            create: {
              applicantId: parsedId,
              relationship: "GUARDIAN",
              ...guardianInfo,
            },
          });
        }

        return tx.applicant.update({
          where: { id: parsedId },
          data: {
            firstName,
            lastName,
            middleName,
            suffix,
            sex,
            birthDate: birthDate
              ? deps.normalizeDateToUtcNoon(new Date(birthDate))
              : undefined,
            emailAddress,
          },
          include: {
            gradeLevel: true,
            addresses: true,
            familyMembers: true,
            enrollment: {
              include: {
                section: true,
              },
            },
          },
        });
      });

      await deps.prisma.auditLog.create({
        data: {
          userId: getRequestUserId(req),
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

  const resetPortalPin = async (req: Request, res: Response) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) {
        return res.status(400).json({ message: "Invalid student id" });
      }

      const { raw: newPin, hash: hashedPin } = deps.generatePortalPin();

      const applicant = await deps.prisma.applicant.update({
        where: { id: parsedId },
        data: {
          portalPin: hashedPin,
          portalPinChangedAt: new Date(),
        },
      });

      const user = await deps.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      const userName = user
        ? `${user.firstName} ${user.lastName}`
        : "Registrar";
      const learnerName = `${applicant.firstName} ${applicant.lastName}`;

      await deps.prisma.auditLog.create({
        data: {
          userId,
          actionType: "PORTAL_PIN_RESET",
          description: `${userName} reset portal PIN for LRN ${applicant.lrn} - ${learnerName}`,
          subjectType: "Applicant",
          recordId: parsedId,
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

  return {
    updateStudent,
    resetPortalPin,
  };
};

const studentsProfileController = createStudentsProfileController();

export const { updateStudent, resetPortalPin } = studentsProfileController;
