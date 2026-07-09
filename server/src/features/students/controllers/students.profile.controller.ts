import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma.js";
import { generatePortalPin } from "../../learner/portal-pin.service.js";
import { normalizeDateToUtcNoon } from "../../school-year/school-year.service.js";
import { findStudents, getStudentsSummary } from "../students.service.js";
import { broadcastStudentInvalidation } from "../../../lib/realtime-events.js";

const getRequestUserId = (req: Request): number | null => {
  const userId = (req as any).user?.userId;
  return typeof userId === "number" ? userId : null;
};


  export const updateStudent = async (req: Request, res: Response) => {
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
        contactNumber,
        religion,
        isIpCommunity,
        is4PsBeneficiary,
        isLearnerWithDisability,
        disabilityTypes,
        isBalikAral,
        ipGroupName,
        motherTongue,
        primaryContact,
      } = req.body;

      const applicant = await prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        include: { learner: true, schoolYear: true },
      });

      const setting = await prisma.schoolSetting.findFirst();
      if (setting?.systemPhase === "EOSY_CLOSING") {
        return res.status(403).json({ message: "Cannot edit core demographics during EOSY Closing phase." });
      }
      
      if (applicant && applicant.schoolYear && applicant.schoolYear.status !== "ACTIVE") {
        return res.status(403).json({ message: "Cannot edit historical records." });
      }

      if (!applicant) {
        return res.status(404).json({ message: "Student not found" });
      }

      const updated = await prisma.$transaction(async (tx) => {
        // Compute dynamic contact number based on primaryContact if provided
        let finalContactNumber = contactNumber;
        if (primaryContact === "MOTHER" && motherName?.contactNumber) {
          finalContactNumber = motherName.contactNumber;
        } else if (primaryContact === "FATHER" && fatherName?.contactNumber) {
          finalContactNumber = fatherName.contactNumber;
        } else if (primaryContact === "GUARDIAN" && guardianInfo?.contactNumber) {
          finalContactNumber = guardianInfo.contactNumber;
        }

        // Update EnrollmentApplication fields
        await tx.enrollmentApplication.update({
          where: { id: parsedId },
          data: {
            contactNumber: finalContactNumber || undefined,
            guardianRelationship: primaryContact === "GUARDIAN" ? (guardianInfo?.relationship || undefined) : undefined,
          }
        });

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
              ? normalizeDateToUtcNoon(new Date(birthDate))
              : undefined,
            religion,
            motherTongue,
            isIpCommunity,
            ipGroupName: isIpCommunity ? ipGroupName : null,
            is4PsBeneficiary,
            isLearnerWithDisability,
            disabilityTypes,
            isBalikAral,
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

      await prisma.auditLog.create({
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

      broadcastStudentInvalidation(updated!.schoolYearId, [updated!.learnerId]);

      res.json({ message: "Student updated successfully", student: updated });
    } catch (error) {
      console.error("Error updating student:", error);
      res.status(500).json({ message: "Failed to update student" });
    }
  };

  export const resetPortalPin = async (req: Request, res: Response) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) {
        return res.status(400).json({ message: "Invalid student id" });
      }

      const { raw: newPin } = generatePortalPin();

      const applicant = await prisma.enrollmentApplication.update({
        where: { id: parsedId },
        data: {
          portalPin: newPin,
          portalPinChangedAt: null, // Phase A: Reset PIN is unhashed/null changedAt
        },
        include: { learner: true },
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      const userName = user
        ? `${user.firstName} ${user.lastName}`
        : "HEAD_REGISTRAR";
      const learnerName = `${applicant.learner.firstName} ${applicant.learner.lastName}`;

      await prisma.auditLog.create({
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

      broadcastStudentInvalidation(applicant.schoolYearId, [applicant.learnerId]);

      res.json({ message: "Portal PIN reset successfully", pin: newPin });
    } catch (error) {
      console.error("Error resetting portal PIN:", error);
      res.status(500).json({ message: "Failed to reset portal PIN" });
    }
  };

  export const clearDeficiency = async (req: Request, res: Response) => {
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

      const applicant = await prisma.enrollmentApplication.findUnique({
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

      const updated = await prisma.$transaction(async (tx) => {
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
            status: isNowClear ? "ENROLLED" : "VERIFIED",
          },
          include: { learner: true },
        });
      });

      await prisma.auditLog.create({
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

      broadcastStudentInvalidation(updated.schoolYearId, [updated.learnerId]);

      res.json({ message: "Deficiency cleared successfully", student: updated });
    } catch (error) {
      console.error("Error clearing deficiency:", error);
      res.status(500).json({ message: "Failed to clear deficiency" });
    }
  };

  export const verifyPsa = async (req: Request, res: Response) => {
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
      const verifier = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });

      const verifierName = verifier ? `${verifier.firstName} ${verifier.lastName}` : "Unknown Admin";

      // 2. Find application
      const applicant = await prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        include: { learner: true },
      });

      if (!applicant) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Check if already PSA verified - Lock the vault
      if (applicant.learner.hasPsaBirthCertificate) {
        return res.status(400).json({ 
          message: "PSA Birth Certificate is already verified and locked in vault per DepEd Order 017, s. 2025." 
        });
      }

      await prisma.$transaction(async (tx) => {
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


      });

      await prisma.auditLog.create({
        data: {
          userId,
          actionType: isPsa ? "PSA_VERIFIED" : "SECONDARY_BIRTH_DOC_VERIFIED",
          description: isPsa 
            ? `Verified PSA Birth Certificate for ${applicant.learner.firstName} ${applicant.learner.lastName} (Permanently Locked)` 
            : `Verified Secondary Birth Document for ${applicant.learner.firstName} ${applicant.learner.lastName} (Temporary Clearance)`,
          subjectType: "EnrollmentApplication",
          recordId: parsedId,
          ipAddress: req.ip || "unknown",
          userAgent: req.headers["user-agent"] || null,
        },
      });

      broadcastStudentInvalidation(applicant.schoolYearId, [applicant.learnerId]);

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

  
  export const updateLrn = async (req: Request, res: Response) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) return res.status(400).json({ message: "Invalid student id" });

      const setting = await prisma.schoolSetting.findFirst();
      if (setting?.systemPhase === "EOSY_CLOSING") {
        return res.status(403).json({ message: "Cannot modify LRN during EOSY Closing phase." });
      }

      const applicant = await prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        include: { learner: true, schoolYear: true },
      });

      if (!applicant) return res.status(404).json({ message: "Student not found" });

      if (applicant.schoolYear && applicant.schoolYear.status !== "ACTIVE") {
        return res.status(403).json({ message: "Cannot edit historical records." });
      }

      const { lrn } = req.body;

      const updated = await prisma.learner.update({
        where: { id: applicant.learnerId },
        data: { lrn },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          actionType: "LRN_UPDATED",
          description: `Updated LRN for ${updated.firstName} ${updated.lastName} to ${lrn}`,
          subjectType: "Learner",
          recordId: updated.id,
          ipAddress: req.ip || "unknown",
          userAgent: req.headers["user-agent"] || null,
        },
      });

      broadcastStudentInvalidation(applicant.schoolYearId, [applicant.learnerId]);

      res.json({ message: "LRN updated successfully", learner: updated });
    } catch (error) {
      console.error("Error updating LRN:", error);
      res.status(500).json({ message: "Failed to update LRN" });
    }
  };

  export const markDropout = async (req: Request, res: Response) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) return res.status(400).json({ message: "Invalid student id" });

      const setting = await prisma.schoolSetting.findFirst();
      if (setting?.systemPhase === "EOSY_CLOSING") {
        return res.status(403).json({ message: "Cannot modify dropout status during EOSY Closing phase." });
      }

      const applicant = await prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        include: { enrollmentRecord: true, learner: true, schoolYear: true },
      });

      if (!applicant) return res.status(404).json({ message: "Student not found" });

      if (applicant.schoolYear && applicant.schoolYear.status !== "ACTIVE") {
        return res.status(403).json({ message: "Cannot modify historical records." });
      }

      const { dropOutDate, reasonCode, reasonNote } = req.body;
      const record = applicant.enrollmentRecord;

      await prisma.$transaction(async (tx) => {
        if (record) {
          await tx.enrollmentRecord.update({
            where: { id: record.id },
            data: { 
              eosyStatus: "DROPPED_OUT", 
              dropOutReason: reasonCode, 
              dropOutDate: dropOutDate ? new Date(dropOutDate) : null 
            },
          });
        }
        await tx.learner.update({
          where: { id: applicant.learnerId },
          data: { status: "DROPPED" },
        });
        await tx.enrollmentApplication.update({
          where: { id: parsedId },
          data: { status: "DROPPED" },
        });
      });

      await prisma.auditLog.create({
        data: {
          userId,
          actionType: "STUDENT_DROPPED_OUT",
          description: `Marked ${applicant.learner.firstName} ${applicant.learner.lastName} as DROPPED_OUT`,
          subjectType: "EnrollmentApplication",
          recordId: parsedId,
          ipAddress: req.ip || "unknown",
          userAgent: req.headers["user-agent"] || null,
        },
      });

      broadcastStudentInvalidation(applicant.schoolYearId, [applicant.learnerId]);

      res.json({ message: "Student marked as dropped out successfully" });
    } catch (error) {
      console.error("Error marking dropout:", error);
      res.status(500).json({ message: "Failed to mark dropout" });
    }
  };

  export const markTransferredOut = async (req: Request, res: Response) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) return res.status(400).json({ message: "Invalid student id" });

      const setting = await prisma.schoolSetting.findFirst();
      if (setting?.systemPhase === "EOSY_CLOSING") {
        return res.status(403).json({ message: "Cannot modify transfer status during EOSY Closing phase." });
      }

      const applicant = await prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        include: { enrollmentRecord: true, learner: true, schoolYear: true },
      });

      if (!applicant) return res.status(404).json({ message: "Student not found" });

      if (applicant.schoolYear && applicant.schoolYear.status !== "ACTIVE") {
        return res.status(403).json({ message: "Cannot modify historical records." });
      }

      const { transferDate, destinationSchool, reasonNote } = req.body;
      const record = applicant.enrollmentRecord;

      await prisma.$transaction(async (tx) => {
        if (record) {
          await tx.enrollmentRecord.update({
            where: { id: record.id },
            data: { 
              eosyStatus: "TRANSFERRED_OUT", 
              transferOutDate: transferDate ? new Date(transferDate) : null 
            },
          });
        }
        await tx.learner.update({
          where: { id: applicant.learnerId },
          data: { status: "TRANSFERRED_OUT" },
        });
        await tx.enrollmentApplication.update({
          where: { id: parsedId },
          data: { status: "TRANSFERRED_OUT" },
        });
      });

      await prisma.auditLog.create({
        data: {
          userId,
          actionType: "STUDENT_TRANSFERRED_OUT",
          description: `Marked ${applicant.learner.firstName} ${applicant.learner.lastName} as TRANSFERRED_OUT`,
          subjectType: "EnrollmentApplication",
          recordId: parsedId,
          ipAddress: req.ip || "unknown",
          userAgent: req.headers["user-agent"] || null,
        },
      });

      broadcastStudentInvalidation(applicant.schoolYearId, [applicant.learnerId]);

      res.json({ message: "Student marked as transferred out successfully" });
    } catch (error) {
      console.error("Error marking transfer out:", error);
      res.status(500).json({ message: "Failed to mark transfer out" });
    }
  };

  export const resetPortalPassword = async (req: Request, res: Response) => {
    try {
      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) {
        return res.status(400).json({ message: "Invalid student id" });
      }

      const applicant = await prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        include: { learner: true },
      });

      if (!applicant || !applicant.learner) {
        return res.status(404).json({ message: "Student not found" });
      }

      const { password } = req.body;

      let newPassword = password;
      if (!newPassword) {
        const settings = await prisma.schoolSetting.findFirst();
        newPassword = settings?.globalDefaultPassword || "DepEd2026!";
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      let userId = applicant.learner.userId;

      if (!userId) {
        const accountName = `LRN-${applicant.learner.lrn}`;
        const createdUser = await prisma.user.create({
          data: {
            firstName: applicant.learner.firstName,
            lastName: applicant.learner.lastName,
            accountName,
            password: hashedPassword,
            roles: ["LEARNER"],
            mustChangePassword: true,
            sex: applicant.learner.sex,
            isActive: true,
          },
        });
        userId = createdUser.id;
        await prisma.learner.update({
          where: { id: applicant.learnerId },
          data: { userId },
        });
      } else {
        await prisma.user.update({
          where: { id: userId },
          data: { password: hashedPassword, mustChangePassword: true },
        });
      }

      const registrarId = getRequestUserId(req);
      await prisma.auditLog.create({
        data: {
          userId: registrarId || 1,
          actionType: "STUDENT_PASSWORD_RESET",
          description: `Admin reset portal password for student: ${applicant.learner.firstName} ${applicant.learner.lastName} (LRN: ${applicant.learner.lrn})`,
          subjectType: "EnrollmentApplication",
          recordId: parsedId,
          ipAddress: req.ip || "unknown",
          userAgent: req.headers["user-agent"] || null,
        },
      });

      broadcastStudentInvalidation(applicant.schoolYearId, [applicant.learnerId]);

      res.json({ message: "Student portal password reset successfully" });
    } catch (error: unknown) {
      const err = error as Error;
      res.status(500).json({ message: err.message });
    }
  };

  export const togglePortalAccess = async (req: Request, res: Response) => {
    try {
      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) {
        return res.status(400).json({ message: "Invalid student id" });
      }

      const { isActive } = req.body as { isActive: boolean };
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ message: "isActive is required and must be boolean" });
      }

      const applicant = await prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        include: { learner: true },
      });

      if (!applicant || !applicant.learner) {
        return res.status(404).json({ message: "Student not found" });
      }

      let userId = applicant.learner.userId;
      if (!userId) {
        const lrn = applicant.learner.lrn || "123456789012";
        const accountName = `LRN-${lrn}`;
        const defaultPasswordHash = await bcrypt.hash("DepEd2026!", 12);
        const createdUser = await prisma.user.create({
          data: {
            firstName: applicant.learner.firstName,
            lastName: applicant.learner.lastName,
            accountName,
            password: defaultPasswordHash,
            roles: ["LEARNER"],
            mustChangePassword: true,
            sex: applicant.learner.sex,
            isActive,
          },
        });
        userId = createdUser.id;
        await prisma.learner.update({
          where: { id: applicant.learnerId },
          data: { userId },
        });
      } else {
        await prisma.user.update({
          where: { id: userId },
          data: { isActive },
        });
      }

      const registrarId = getRequestUserId(req);
      await prisma.auditLog.create({
        data: {
          userId: registrarId || 1,
          actionType: isActive ? "STUDENT_PORTAL_ACTIVATED" : "STUDENT_PORTAL_DEACTIVATED",
          description: `Admin updated portal status to ${isActive ? "ACTIVE" : "LOCKED"} for student: ${applicant.learner.firstName} ${applicant.learner.lastName} (LRN: ${applicant.learner.lrn})`,
          subjectType: "EnrollmentApplication",
          recordId: parsedId,
          ipAddress: req.ip || "unknown",
          userAgent: req.headers["user-agent"] || null,
        },
      });

      broadcastStudentInvalidation(applicant.schoolYearId, [applicant.learnerId]);

      res.json({ message: `Portal access status updated to ${isActive ? "ACTIVE" : "LOCKED"}` });
    } catch (error: unknown) {
      const err = error as Error;
      res.status(500).json({ message: err.message });
    }
  };

  
