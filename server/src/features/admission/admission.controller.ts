import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import type {
  ApplicantType,
  ApplicationStatus,
  SchoolYear,
} from "../../generated/prisma/index.js";
import {
  APPLICATION_STATUS_TO_TRACKING_STATUS,
  applicationSubmitSchema,
  isSpecialCurricularProgramType,
  type TrackingCurrentStep,
} from "@enrollpro/shared";
import { isPublicEnrollmentOpen } from "../settings/enrollment-gate.service.js";

interface ActiveEnrollmentSetting {
  activeSchoolYearId: number
  systemPhase: string
  activeSchoolYear: SchoolYear
}

async function getOpenPublicEnrollmentSetting(
  res: Response,
): Promise<ActiveEnrollmentSetting | null> {
  const setting = await prisma.schoolSetting.findFirst({
    where: { activeSchoolYearId: { not: null } },
    include: { activeSchoolYear: true },
  });

  if (!setting?.activeSchoolYearId || !setting.activeSchoolYear) {
    res.status(400).json({ message: "No active school year is configured." });
    return null;
  }

  if (!isPublicEnrollmentOpen(setting.activeSchoolYear, setting.systemPhase)) {
    res.status(403).json({
      code: "PUBLIC_ENROLLMENT_CLOSED",
      message:
        "Regular online enrollment is closed. Please visit the School Registrar's Office for walk-in assistance.",
    });
    return null;
  }

  return {
    activeSchoolYearId: setting.activeSchoolYearId,
    systemPhase: setting.systemPhase,
    activeSchoolYear: setting.activeSchoolYear,
  };
}

function generateTrackingNumber(): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `EN-${year}-${randomStr}`;
}

function buildTrackingState(
  status: ApplicationStatus,
  applicantType: ApplicantType,
) {
  let currentStep: TrackingCurrentStep = "REGISTRAR_REVIEW";
  if (status === "OFFICIALLY_ENROLLED") {
    currentStep = "ENROLLED";
  } else if (
    status === "READY_FOR_SECTIONING" ||
    status === "PENDING_CONFIRMATION" ||
    status === "REMEDIAL_RESOLVED"
  ) {
    currentStep = "ENROLLMENT_QUALIFICATION";
  }

  return {
    applicantType,
    programType: isSpecialCurricularProgramType(applicantType)
      ? ("SCP" as const)
      : ("REGULAR" as const),
    status: APPLICATION_STATUS_TO_TRACKING_STATUS[status],
    rawStatus: status,
    currentStep,
  };
}

export async function trackApplication(req: Request, res: Response) {
  try {
    const trackingNumber = String(req.params.trackingNumber ?? "")
      .trim()
      .toUpperCase();

    if (!/^[A-Z0-9-]{8,24}$/.test(trackingNumber)) {
      res.status(400).json({ message: "Enter a valid tracking number." });
      return;
    }

    const application = await prisma.enrollmentApplication.findUnique({
      where: { trackingNumber },
      select: {
        trackingNumber: true,
        applicantType: true,
        status: true,
        createdAt: true,
        learner: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
          },
        },
        gradeLevel: {
          select: { name: true },
        },
        enrollmentRecord: {
          select: {
            enrolledAt: true,
            section: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!application) {
      res.status(404).json({
        message: "No enrollment application matches that tracking number.",
      });
      return;
    }

    res.json({
      trackingNumber: application.trackingNumber,
      ...buildTrackingState(application.status, application.applicantType),
      firstName: application.learner.firstName,
      middleName: application.learner.middleName,
      lastName: application.learner.lastName,
      gradeLevel: application.gradeLevel,
      createdAt: application.createdAt,
      enrollment: application.enrollmentRecord
        ? {
            section: application.enrollmentRecord.section,
            enrolledAt: application.enrollmentRecord.enrolledAt,
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to track application:", error);
    res.status(500).json({ message: "Could not retrieve the application." });
  }
}

export async function submitApplication(req: Request, res: Response) {
  try {
    const parsed = applicationSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error("VALIDATION ERRORS:", JSON.stringify(parsed.error.format(), null, 2));
      res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.format(),
      });
      return;
    }

    const data = parsed.data;

    // Get active school year
    const schoolSetting = await getOpenPublicEnrollmentSetting(res);
    if (!schoolSetting) return;
    const activeSchoolYearId = schoolSetting.activeSchoolYearId;

    // Get grade level id
    const gradeLevelRecord = await prisma.gradeLevel.findFirst({
      where: { name: `Grade ${data.gradeLevel}` },
    });
    if (!gradeLevelRecord) {
      res.status(400).json({ message: "Invalid grade level." });
      return;
    }

    // Find or create Learner
    let learner;
    const lrn = data.hasNoLrn ? null : data.lrn;

    if (lrn) {
      learner = await prisma.learner.findUnique({
        where: { lrn },
      });
    }

    const birthdateDate = data.birthdate instanceof Date ? data.birthdate : new Date(data.birthdate);

    const learnerData = {
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName || null,
      extensionName: data.extensionName || null,
      birthdate: birthdateDate,
      sex: data.sex,
      placeOfBirth: data.placeOfBirth,
      religion: data.religion || null,
      isIpCommunity: data.isIpCommunity,
      ipGroupName: data.ipGroupName || null,
      is4PsBeneficiary: data.is4PsBeneficiary,
      householdId4Ps: data.householdId4Ps || null,
      isBalikAral: data.isBalikAral,
      lastYearEnrolled: data.lastYearEnrolled || null,
      isLearnerWithDisability: data.isLearnerWithDisability,
      specialNeedsCategory: data.specialNeedsCategory || null,
      hasPwdId: data.hasPwdId,
      disabilityTypes: data.disabilityTypes,
      lrn: lrn || null,
      studentPhoto: data.studentPhoto || null,
      psaBirthCertNumber: data.psaBirthCertNumber || null,
    };

    if (learner) {
      learner = await prisma.learner.update({
        where: { id: learner.id },
        data: learnerData,
      });
    } else {
      learner = await prisma.learner.create({
        data: learnerData,
      });
    }

    // Check if already applied
    const existingApplication = await prisma.enrollmentApplication.findFirst({
      where: {
        learnerId: learner.id,
        schoolYearId: activeSchoolYearId,
      },
    });

    let duplicateFlag = false;

    if (existingApplication) {
      if (existingApplication.status === "PENDING_VERIFICATION") {
        if (!data.bypassDuplicate) {
          res.status(409).json({ duplicate_detected: true, requires_auth: true, message: "Learner already has a pending application for this school year." });
          return;
        } else {
          // bypassDuplicate is true, mark both as duplicate
          duplicateFlag = true;
          await prisma.enrollmentApplication.updateMany({
            where: { learnerId: learner.id, schoolYearId: activeSchoolYearId },
            data: { duplicateFlag: true },
          });
        }
      } else {
        res.status(400).json({ message: "Learner already has an application for this school year." });
        return;
      }
    }

    // Create EnrollmentApplication
    const trackingNumber = generateTrackingNumber();

    const application = await prisma.enrollmentApplication.create({
      data: {
        learnerId: learner.id,
        schoolYearId: activeSchoolYearId,
        gradeLevelId: gradeLevelRecord.id,
        applicantType: data.scpType || "REGULAR",
        learnerType: data.learnerType,
        admissionChannel: "ONLINE",
        trackingNumber,
        learningModalities: data.learningModalities,
        isPrivacyConsentGiven: data.isPrivacyConsentGiven,
        intakeHeightCm: data.intakeHeightCm || null,
        intakeWeightKg: data.intakeWeightKg || null,
        status: "PENDING_VERIFICATION",
        duplicateFlag,
        hasNoMother: !data.mother?.firstName,
        hasNoFather: !data.father?.firstName,
        isLateEnrollee: schoolSetting?.systemPhase === "CLASSES_ONGOING",
        
        addresses: {
          create: [
            {
              addressType: "CURRENT",
              houseNoStreet: data.currentAddress.houseNoStreet || null,
              sitio: data.currentAddress.sitio || null,
              barangay: data.currentAddress.barangay,
              cityMunicipality: data.currentAddress.cityMunicipality,
              province: data.currentAddress.cityMunicipality === "CITY OF BACOLOD" ? "CITY OF BACOLOD" : data.currentAddress.province,
            },
            ...(data.permanentAddress && data.permanentAddress.barangay
              ? [
                  {
                    addressType: "PERMANENT" as const,
                    houseNoStreet: data.permanentAddress.houseNoStreet || null,
                    sitio: data.permanentAddress.sitio || null,
                    barangay: data.permanentAddress.barangay,
                    cityMunicipality: data.permanentAddress.cityMunicipality,
                    province: data.permanentAddress.cityMunicipality === "CITY OF BACOLOD" ? "CITY OF BACOLOD" : data.permanentAddress.province,
                  },
                ]
              : []),
          ],
        },
        familyMembers: {
          create: [
            {
              relationship: "MOTHER",
              firstName: data.mother.firstName,
              lastName: data.mother.lastName,
              middleName: data.mother.middleName || null,
              contactNumber: data.mother.contactNumber || null,
              email: data.mother.email || null,
            },
            {
              relationship: "FATHER",
              firstName: data.father.firstName,
              lastName: data.father.lastName,
              middleName: data.father.middleName || null,
              contactNumber: data.father.contactNumber || null,
              email: data.father.email || null,
            },
            ...(data.guardian?.firstName
              ? [
                  {
                    relationship: "GUARDIAN" as const,
                    firstName: data.guardian.firstName,
                    lastName: data.guardian.lastName || "",
                    middleName: data.guardian.middleName || null,
                    contactNumber: data.guardian.contactNumber || null,
                    email: data.guardian.email || null,
                  },
                ]
              : []),
          ],
        },
        previousSchool: {
          create: {
            schoolName: data.lastSchoolName,
            schoolAddress: data.lastSchoolAddress || null,
            schoolType: data.lastSchoolType,
            generalAverage: data.generalAverage || null,
          },
        },
      },
    });

    res.status(201).json({
      message: "Application submitted successfully",
      trackingNumber: application.trackingNumber,
      id: application.id,
      ...buildTrackingState(application.status, application.applicantType),
    });
  } catch (error) {
    console.error("Failed to submit application:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateExistingApplication(req: Request, res: Response) {
  try {
    const parsed = applicationSubmitSchema.safeParse(req.body);
    const { originalTrackingNumber } = req.body;

    if (!parsed.success || !originalTrackingNumber) {
      res.status(400).json({
        message: "Validation failed or missing original tracking number",
      });
      return;
    }

    const data = parsed.data;
    
    const schoolSetting = await getOpenPublicEnrollmentSetting(res);
    if (!schoolSetting) return;
    const activeSchoolYearId = schoolSetting.activeSchoolYearId;

    const lrn = data.hasNoLrn ? null : data.lrn;
    if (!lrn) {
      res.status(400).json({ message: "LRN is required to update an application." });
      return;
    }

    // Verify existing record
    const existingApplication = await prisma.enrollmentApplication.findFirst({
      where: {
        trackingNumber: originalTrackingNumber,
        schoolYearId: activeSchoolYearId,
        learner: { lrn },
        status: "PENDING_VERIFICATION"
      },
      include: { learner: true }
    });

    if (!existingApplication) {
      res.status(404).json({ message: "No pending application found for the provided Tracking Number and LRN." });
      return;
    }

    // Update Learner details
    const birthdateDate = data.birthdate instanceof Date ? data.birthdate : new Date(data.birthdate);
    await prisma.learner.update({
      where: { id: existingApplication.learnerId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName || null,
        extensionName: data.extensionName || null,
        birthdate: birthdateDate,
        sex: data.sex,
        placeOfBirth: data.placeOfBirth,
        religion: data.religion || null,
        isIpCommunity: data.isIpCommunity,
        ipGroupName: data.ipGroupName || null,
        is4PsBeneficiary: data.is4PsBeneficiary,
        householdId4Ps: data.householdId4Ps || null,
        isBalikAral: data.isBalikAral,
        lastYearEnrolled: data.lastYearEnrolled || null,
        isLearnerWithDisability: data.isLearnerWithDisability,
        specialNeedsCategory: data.specialNeedsCategory || null,
        hasPwdId: data.hasPwdId,
        disabilityTypes: data.disabilityTypes,
        studentPhoto: data.studentPhoto || null,
        psaBirthCertNumber: data.psaBirthCertNumber || null,
      }
    });

    const gradeLevelRecord = await prisma.gradeLevel.findFirst({
      where: { name: `Grade ${data.gradeLevel}` },
    });

    if (!gradeLevelRecord) {
      res.status(400).json({ message: "Invalid grade level." });
      return;
    }

    // Clean up related records (addresses, family members, previous school) to recreate them
    await prisma.applicationAddress.deleteMany({ where: { enrollmentId: existingApplication.id } });
    await prisma.applicationFamilyMember.deleteMany({ where: { enrollmentId: existingApplication.id } });
    await prisma.enrollmentPreviousSchool.deleteMany({ where: { applicationId: existingApplication.id } });

    const application = await prisma.enrollmentApplication.update({
      where: { id: existingApplication.id },
      data: {
        gradeLevelId: gradeLevelRecord.id,
        applicantType: data.scpType || "REGULAR",
        learnerType: data.learnerType,
        learningModalities: data.learningModalities,
        isPrivacyConsentGiven: data.isPrivacyConsentGiven,
        intakeHeightCm: data.intakeHeightCm || null,
        intakeWeightKg: data.intakeWeightKg || null,
        hasNoMother: !data.mother?.firstName,
        hasNoFather: !data.father?.firstName,
        isLateEnrollee: schoolSetting?.systemPhase === "CLASSES_ONGOING",
        addresses: {
          create: [
            {
              addressType: "CURRENT",
              houseNoStreet: data.currentAddress.houseNoStreet || null,
              sitio: data.currentAddress.sitio || null,
              barangay: data.currentAddress.barangay,
              cityMunicipality: data.currentAddress.cityMunicipality,
              province: data.currentAddress.cityMunicipality === "CITY OF BACOLOD" ? "CITY OF BACOLOD" : data.currentAddress.province,
            },
            ...(data.permanentAddress && data.permanentAddress.barangay
              ? [
                  {
                    addressType: "PERMANENT" as const,
                    houseNoStreet: data.permanentAddress.houseNoStreet || null,
                    sitio: data.permanentAddress.sitio || null,
                    barangay: data.permanentAddress.barangay,
                    cityMunicipality: data.permanentAddress.cityMunicipality,
                    province: data.permanentAddress.cityMunicipality === "CITY OF BACOLOD" ? "CITY OF BACOLOD" : data.permanentAddress.province,
                  },
                ]
              : []),
          ],
        },
        familyMembers: {
          create: [
            {
              relationship: "MOTHER",
              firstName: data.mother.firstName,
              lastName: data.mother.lastName,
              middleName: data.mother.middleName || null,
              contactNumber: data.mother.contactNumber || null,
              email: data.mother.email || null,
            },
            {
              relationship: "FATHER",
              firstName: data.father.firstName,
              lastName: data.father.lastName,
              middleName: data.father.middleName || null,
              contactNumber: data.father.contactNumber || null,
              email: data.father.email || null,
            },
            ...(data.guardian?.firstName
              ? [
                  {
                    relationship: "GUARDIAN" as const,
                    firstName: data.guardian.firstName,
                    lastName: data.guardian.lastName || "",
                    middleName: data.guardian.middleName || null,
                    contactNumber: data.guardian.contactNumber || null,
                    email: data.guardian.email || null,
                  },
                ]
              : []),
          ],
        },
        previousSchool: {
          create: {
            schoolName: data.lastSchoolName,
            schoolAddress: data.lastSchoolAddress || null,
            schoolType: data.lastSchoolType,
            generalAverage: data.generalAverage || null,
          },
        },
      },
    });

    res.status(200).json({
      message: "Application updated successfully",
      trackingNumber: application.trackingNumber,
      id: application.id,
      ...buildTrackingState(application.status, application.applicantType),
    });
  } catch (error) {
    console.error("Failed to update application:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
