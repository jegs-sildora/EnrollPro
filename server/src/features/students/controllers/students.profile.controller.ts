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

      const applicant = await deps.prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        include: { learner: true },
      });

      if (!applicant) {
        return res.status(404).json({ message: "Student not found" });
      }

      const updated = await deps.prisma.$transaction(async (tx) => {
        if (currentAddress) {
          await tx.applicationAddress.upsert({
            where: {
              uq_enrollment_addresses_type: {
                enrollmentId: parsedId,
                addressType: "CURRENT",
              },
            },
            update: currentAddress,
            create: {
              enrollmentId: parsedId,
              addressType: "CURRENT",
              ...currentAddress,
            },
          });
        }

        if (permanentAddress) {
          await tx.applicationAddress.upsert({
            where: {
              uq_enrollment_addresses_type: {
                enrollmentId: parsedId,
                addressType: "PERMANENT",
              },
            },
            update: permanentAddress,
            create: {
              enrollmentId: parsedId,
              addressType: "PERMANENT",
              ...permanentAddress,
            },
          });
        }

        if (motherName) {
          await tx.applicationFamilyMember.upsert({
            where: {
              uq_enrollment_family_members_rel: {
                enrollmentId: parsedId,
                relationship: "MOTHER",
              },
            },
            update: motherName,
            create: {
              enrollmentId: parsedId,
              relationship: "MOTHER",
              ...motherName,
            },
          });
        }

        if (fatherName) {
          await tx.applicationFamilyMember.upsert({
            where: {
              uq_enrollment_family_members_rel: {
                enrollmentId: parsedId,
                relationship: "FATHER",
              },
            },
            update: fatherName,
            create: {
              enrollmentId: parsedId,
              relationship: "FATHER",
              ...fatherName,
            },
          });
        }

        if (guardianInfo) {
          await tx.applicationFamilyMember.upsert({
            where: {
              uq_enrollment_family_members_rel: {
                enrollmentId: parsedId,
                relationship: "GUARDIAN",
              },
            },
            update: guardianInfo,
            create: {
              enrollmentId: parsedId,
              relationship: "GUARDIAN",
              ...guardianInfo,
            },
          });
        }

        // Update personal fields on Learner
        await tx.learner.update({
          where: { id: applicant!.learnerId },
          data: {
            firstName,
            lastName,
            middleName,
            extensionName: suffix,
            sex,
            birthdate: birthDate
              ? deps.normalizeDateToUtcNoon(new Date(birthDate))
              : undefined,
          },
        });

        return tx.enrollmentApplication.findUnique({
          where: { id: parsedId },
          include: {
            learner: true,
            gradeLevel: true,
            addresses: true,
            familyMembers: true,
            enrollmentRecord: {
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
          description: `Updated student record for ${updated!.learner.firstName} ${updated!.learner.lastName} (LRN: ${updated!.learner.lrn})`,
          subjectType: "EnrollmentApplication",
          recordId: updated!.id,
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

      const applicant = await deps.prisma.enrollmentApplication.update({
        where: { id: parsedId },
        data: {
          portalPin: hashedPin,
          portalPinChangedAt: new Date(),
        },
        include: { learner: true },
      });

      const user = await deps.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      const userName = user
        ? `${user.firstName} ${user.lastName}`
        : "Registrar";
      const learnerName = `${applicant.learner.firstName} ${applicant.learner.lastName}`;

      await deps.prisma.auditLog.create({
        data: {
          userId,
          actionType: "PORTAL_PIN_RESET",
          description: `${userName} reset portal PIN for LRN ${applicant.learner.lrn} - ${learnerName}`,
          subjectType: "EnrollmentApplication",
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

  const clearDeficiency = async (req: Request, res: Response) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) {
        return res.status(400).json({ message: "Invalid student id" });
      }

      const { deficiencyType } = req.body as { deficiencyType: "SF9" | "FINANCIAL" | "ALL" };

      const applicant = await deps.prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        include: { learner: true },
      });

      if (!applicant) {
        return res.status(404).json({ message: "Student not found" });
      }

      const updateData: any = {};
      if (deficiencyType === "SF9") {
        updateData.isMissingSf9 = false;
      } else if (deficiencyType === "FINANCIAL") {
        updateData.hasUnsettledPrivateAccount = false;
      } else if (deficiencyType === "ALL") {
        updateData.isMissingSf9 = false;
        updateData.hasUnsettledPrivateAccount = false;
      }

      const updated = await deps.prisma.$transaction(async (tx) => {
        const currentApp = await tx.enrollmentApplication.findUnique({
          where: { id: parsedId },
        });

        const newIsMissingSf9 = updateData.isMissingSf9 ?? currentApp!.isMissingSf9;
        const newHasUnsettled = updateData.hasUnsettledPrivateAccount ?? currentApp!.hasUnsettledPrivateAccount;
        
        const isNowClear = !newIsMissingSf9 && !newHasUnsettled;

        return tx.enrollmentApplication.update({
          where: { id: parsedId },
          data: {
            ...updateData,
            isTemporarilyEnrolled: !isNowClear,
            status: isNowClear ? "ENROLLED" : "TEMPORARILY_ENROLLED",
          },
          include: { learner: true },
        });
      });

      await deps.prisma.auditLog.create({
        data: {
          userId,
          actionType: "DEFICIENCY_CLEARED",
          description: `Cleared ${deficiencyType} deficiency for ${updated.learner.firstName} ${updated.learner.lastName}`,
          subjectType: "EnrollmentApplication",
          recordId: parsedId,
          ipAddress: req.ip || "unknown",
          userAgent: req.headers["user-agent"] || null,
        },
      });

      res.json({ message: "Deficiency cleared successfully", student: updated });
    } catch (error) {
      console.error("Error clearing deficiency:", error);
      res.status(500).json({ message: "Failed to clear deficiency" });
    }
  };

  const verifyPsa = async (req: Request, res: Response) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) {
        return res.status(400).json({ message: "Invalid student id" });
      }

      const { type } = req.body;
      const isPsa = type === "PSA";

      // 1. Get the verifier's name
      const verifier = await deps.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });

      const verifierName = verifier ? `${verifier.firstName} ${verifier.lastName}` : "Unknown Admin";

      // 2. Update Learner record
      const applicant = await deps.prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        include: { learner: true },
      });

      if (!applicant) {
        return res.status(404).json({ message: "Student not found" });
      }

      await deps.prisma.$transaction(async (tx) => {
        // Only update Learner's permanent vault if it's a PSA document
        if (isPsa) {
          await tx.learner.update({
            where: { id: applicant.learnerId },
            data: {
              hasPsaBirthCertificate: true,
              birthCertificateType: "PSA",
              birthCertificateVerifiedBy: verifierName,
              birthCertificateVerifiedDate: new Date(),
            },
          });
        } else {
          // Track that a secondary document was used to verify identity
          await tx.learner.update({
            where: { id: applicant.learnerId },
            data: {
              birthCertificateType: "SECONDARY",
              birthCertificateVerifiedBy: verifierName,
              birthCertificateVerifiedDate: new Date(),
            },
          });
        }

        // 3. Automatically update the checklist for the current enrollment application
        await tx.applicationChecklist.updateMany({
          where: { enrollmentId: parsedId },
          data: {
            isPsaBirthCertPresented: true, // This allows the enrollment to proceed
            isSecondaryBirthDocPresented: !isPsa,
            isOriginalPsaBcCollected: isPsa,
            updatedById: userId,
          },
        });
      });

      await deps.prisma.auditLog.create({
        data: {
          userId,
          actionType: isPsa ? "PSA_VERIFIED" : "SECONDARY_BIRTH_DOC_VERIFIED",
          description: isPsa 
            ? `Verified PSA Birth Certificate for ${applicant.learner.firstName} ${applicant.learner.lastName} (Permanently Locked)` 
            : `Verified Secondary Birth Document for ${applicant.learner.firstName} ${applicant.learner.lastName} (Temporary Clearance)`,
          subjectType: "Learner",
          recordId: applicant.learnerId,
          ipAddress: req.ip || "unknown",
          userAgent: req.headers["user-agent"] || null,
        },
      });

      res.json({ 
        message: isPsa 
          ? "PSA Birth Certificate verified successfully" 
          : "Secondary document verified successfully. PSA still required by deadline." 
      });
    } catch (error) {
      console.error("Error verifying document:", error);
      res.status(500).json({ message: "Failed to verify document" });
    }
  };

  return {
    updateStudent,
    resetPortalPin,
    clearDeficiency,
    verifyPsa,
  };
};

const studentsProfileController = createStudentsProfileController();

export const { updateStudent, resetPortalPin, clearDeficiency, verifyPsa } =
  studentsProfileController;
