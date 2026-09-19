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
  scpAdmissionSubmitSchema,
  isSpecialCurricularProgramType,
  type ScpAdmissionSubmit,
  type TrackingCurrentStep,
} from "@enrollpro/shared";
import { isPublicEnrollmentOpen, isScpAdmissionOpen } from "../settings/enrollment-gate.service.js";

interface ActiveEnrollmentSetting {
  activeSchoolYearId: number
  systemPhase: string
  activeSchoolYear: SchoolYear
}

async function getOpenPublicEnrollmentSetting(
  res: Response,
  isScp: boolean = false
): Promise<ActiveEnrollmentSetting | null> {
  const setting = await prisma.schoolSetting.findFirst({
    where: { activeSchoolYearId: { not: null } },
    include: { activeSchoolYear: true },
  });

  if (!setting?.activeSchoolYearId || !setting.activeSchoolYear) {
    res.status(400).json({ message: "No active school year is configured." });
    return null;
  }

  if (isScp) {
    if (!isScpAdmissionOpen(setting.activeSchoolYear)) {
      res.status(403).json({
        code: "SCP_ADMISSION_CLOSED",
        message: "SCP Admission is currently closed.",
      });
      return null;
    }
  } else {
    if (!isPublicEnrollmentOpen(setting.activeSchoolYear, setting.systemPhase)) {
      res.status(403).json({
        code: "PUBLIC_ENROLLMENT_CLOSED",
        message:
          "Regular online enrollment is closed. Please visit the School Registrar's Office for walk-in assistance.",
      });
      return null;
    }
  }

  return {
    activeSchoolYearId: setting.activeSchoolYearId,
    systemPhase: setting.systemPhase,
    activeSchoolYear: setting.activeSchoolYear,
  };
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
        complianceStatus: true,
        learnerType: true,
        scpProfile: {
          select: { assessmentResult: true },
        },
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

    const isScp = isSpecialCurricularProgramType(application.applicantType);
    const application_type = (isScp && !application.learnerType) ? "ADMISSION" : "ENROLLMENT";
    
    let current_step = 1;
    let status = "PENDING";
    
    if (application_type === "ADMISSION") {
      if (application.complianceStatus === "COMPLIED") {
        if (application.scpProfile?.assessmentResult === "QUALIFIED") {
          current_step = 3;
          status = "PASSED";
        } else if (application.scpProfile?.assessmentResult === "WAITLISTED") {
          current_step = 3;
          status = "WAITLISTED";
        } else if (application.scpProfile?.assessmentResult === "DISQUALIFIED") {
          current_step = 3;
          status = "FAILED";
        } else {
          // COMPLIED but no final result -> Step 2
          current_step = 2;
          status = "PENDING";
        }
      }
    } else {
      if (application.status === "OFFICIALLY_ENROLLED") {
        current_step = 3;
        status = "PASSED";
      } else if (
        application.status === "READY_FOR_SECTIONING" ||
        application.status === "PENDING_CONFIRMATION" ||
        application.status === "REMEDIAL_RESOLVED"
      ) {
        current_step = 2;
        status = "PENDING";
      }
    }

    res.json({
      trackingNumber: application.trackingNumber,
      // Pass these down first so old UI doesn't completely break, but we overwrite status
      ...buildTrackingState(application.status, application.applicantType),
      applicantType: application.applicantType,
      application_type,
      current_step,
      status,
      complianceStatus: application.complianceStatus,
      scpAssessmentResult: application.scpProfile?.assessmentResult ?? null,
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

export async function validateLrn(req: Request, res: Response) {
  try {
    const lrn = String(req.params.lrn ?? "").trim();
    if (!/^\d{12}$/.test(lrn)) {
      res.status(400).json({ message: "Invalid LRN format. Must be exactly 12 digits." });
      return;
    }

    const learner = await prisma.learner.findUnique({
      where: { lrn },
      select: { id: true }
    });

    res.json({ isDuplicate: !!learner });
  } catch (error) {
    console.error("Failed to validate LRN:", error);
    res.status(500).json({ message: "Could not validate LRN." });
  }
}

export async function submitApplication(req: Request, res: Response) {
  try {
    const isScp = req.body.isScpApplication === true;
    const schema = isScp ? scpAdmissionSubmitSchema : applicationSubmitSchema;
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      console.error("VALIDATION ERRORS:", JSON.stringify(parsed.error.format(), null, 2));
      res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.format(),
      });
      return;
    }

    const data = parsed.data;
    const scpData = isScp ? (data as ScpAdmissionSubmit) : null;

    // Get active school year
    const schoolSetting = await getOpenPublicEnrollmentSetting(res, isScp);
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
      motherTongue: data.motherTongue,
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

    // Generate Application Tracking Number
    const yearPrefix = schoolSetting.activeSchoolYear?.yearLabel?.split("-")[0] || new Date().getFullYear().toString();
    const programType = data.scpType || "REGULAR";
    const programAcronym = programType === "REGULAR" ? "BEC" : 
                           programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? "STE" : 
                           programType === "SPECIAL_PROGRAM_IN_THE_ARTS" ? "SPA" : 
                           programType === "SPECIAL_PROGRAM_IN_SPORTS" ? "SPS" : "BEC";
    const paddedId = String(learner.id).padStart(7, '0');
    const trackingNumber = `${programAcronym}${yearPrefix}${paddedId}`;

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
              region: data.currentAddress.region,
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
                    region: data.permanentAddress.region,
                  },
                ]
              : []),
          ],
        },
        familyMembers: {
          create: [
            ...(data.mother.firstName && data.mother.lastName
              ? [{
                  relationship: "MOTHER" as const,
                  firstName: data.mother.firstName,
                  lastName: data.mother.lastName,
                  middleName: data.mother.middleName || null,
                  contactNumber: data.mother.contactNumber || null,
                  email: data.mother.email || null,
                }]
              : []),
            ...(data.father.firstName && data.father.lastName
              ? [{
                  relationship: "FATHER" as const,
                  firstName: data.father.firstName,
                  lastName: data.father.lastName,
                  middleName: data.father.middleName || null,
                  contactNumber: data.father.contactNumber || null,
                  email: data.father.email || null,
                }]
              : []),
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
            schoolId: data.lastSchoolId || null,
            schoolAddress: data.lastSchoolAddress || null,
            schoolType: data.lastSchoolType,
            generalAverage: data.generalAverage || null,
            
            transferCertificateNo: data.transferCertificateNo || null,
          },
        },
        ...(scpData
          ? {
              scpProfile: {
                create: {
                  grade5GeneralAverage: scpData.grade5GeneralAverage,
                  underSpecialScienceCurriculum:
                    scpData.underSpecialScienceCurriculum,
                  artsSpecialization: scpData.artsSpecialization || null,
                  chosenSport: scpData.chosenSport || null,
                },
              },
            }
          : {}),
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
            // @ts-ignore Prisma client needs regeneration to recognize this new field
            transferCertificateNo: data.transferCertificateNo || null,
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
