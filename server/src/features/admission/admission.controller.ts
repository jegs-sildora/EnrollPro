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
import { normalizeDateToUtcNoon } from "../school-year/school-year.service.js";

interface ActiveEnrollmentSetting {
  activeSchoolYearId: number
  systemPhase: string
  activeSchoolYear: SchoolYear
}

async function getActiveEnrollmentSetting(
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

  return {
    activeSchoolYearId: setting.activeSchoolYearId,
    systemPhase: setting.systemPhase,
    activeSchoolYear: setting.activeSchoolYear,
  };
}

async function getOpenPublicEnrollmentSetting(
  res: Response,
  isScp: boolean = false
): Promise<ActiveEnrollmentSetting | null> {
  const setting = await getActiveEnrollmentSetting(res);
  if (!setting) return null;

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

function isScpRosterLocked(
  schoolYear: SchoolYear,
  program: ApplicantType,
): boolean {
  return (
    program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING"
      ? schoolYear.steRosterLocked
      : program === "SPECIAL_PROGRAM_IN_THE_ARTS"
        ? schoolYear.spaRosterLocked
        : program === "SPECIAL_PROGRAM_IN_SPORTS"
          ? schoolYear.spsRosterLocked
          : false
  );
}

interface AddressForForm {
  cityMunicipality: string | null
  province: string | null
}

function normalizeAddressForForm<TAddress extends AddressForForm>(address: TAddress): TAddress {
  const cityMunicipality = address.cityMunicipality?.trim().toUpperCase()
  const province = address.province?.trim().toUpperCase()

  if (cityMunicipality === "CITY OF BACOLOD" && province === "CITY OF BACOLOD") {
    return { ...address, province: "NEGROS OCCIDENTAL" }
  }

  return address
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
    const trackingNumber = String(req.params.trackingNumber ?? "").trim().toUpperCase();

    if (!/^[A-Z0-9-]{8,24}$/.test(trackingNumber)) {
      res.status(400).json({ message: "Enter a valid tracking number." });
      return;
    }

    if (trackingNumber.startsWith("ADM-")) {
      const admission = await prisma.scpAdmission.findUnique({
        where: { trackingNumber },
        select: {
          trackingNumber: true,
          program: true,
          createdAt: true,
          assessmentResult: true,
          requirementsStatus: true,
          writtenExamStatus: true,
          interviewStatus: true,
          learner: {
            select: { firstName: true, middleName: true, lastName: true },
          },
        },
      });

      if (!admission) {
        res.status(404).json({ message: "No application found for the provided Tracking Number." });
        return;
      }

      const { learner, ...appData } = admission;

      res.status(200).json({
        trackingNumber: appData.trackingNumber,
        firstName: learner.firstName,
        middleName: learner.middleName,
        lastName: learner.lastName,
        gradeLevel: { name: "Grade 7" },
        createdAt: appData.createdAt,
        program: appData.program,
        verification_status: appData.requirementsStatus,
        exam_status: appData.writtenExamStatus,
        interview_status: appData.interviewStatus,
        final_result: appData.assessmentResult,
        application_type: "ADMISSION",
      });
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
        scpAdmission: {
          select: { 
            assessmentResult: true, 
            requirementsStatus: true,
            writtenExamStatus: true,
            interviewStatus: true
          },
        },
        learner: {
          select: { firstName: true, middleName: true, lastName: true },
        },
        gradeLevel: {
          select: { name: true },
        },
        enrollmentRecord: {
          select: {
            enrolledAt: true,
            section: { select: { name: true } },
          },
        },
      },
    });

    if (!application) {
      res.status(404).json({ message: "No application found for the provided Tracking Number." });
      return;
    }

    const { learner, enrollmentRecord, gradeLevel, scpAdmission, ...appData } = application;
    const applicantName = `${learner.firstName} ${learner.middleName ? learner.middleName + ' ' : ''}${learner.lastName}`;
    
    let application_type = "ENROLLMENT";
    if (appData.applicantType !== "REGULAR" && appData.learnerType !== "NEW_ENROLLEE" && appData.learnerType !== "TRANSFEREE") {
      // Actually it's just ENROLLMENT now because admission is separated!
      application_type = "ENROLLMENT";
    }

    let current_step = 1;
    if (appData.status === "READY_FOR_SECTIONING" || appData.status === "PENDING_CONFIRMATION") {
      current_step = 2;
    } else if (appData.status === "OFFICIALLY_ENROLLED") {
      current_step = 3;
    }

    res.status(200).json({
      trackingNumber: appData.trackingNumber,
      applicantName,
      firstName: learner.firstName,
      middleName: learner.middleName,
      lastName: learner.lastName,
      createdAt: appData.createdAt,
      status: appData.status,
      complianceStatus: appData.complianceStatus,
      applicantType: appData.applicantType,
      gradeLevel: { name: gradeLevel.name },
      scpAdmissionStatus: scpAdmission?.assessmentResult || null,
      scpProgram: scpAdmission ? appData.applicantType : null,
      enrollment: enrollmentRecord ? {
        section: { name: enrollmentRecord.section?.name || "" },
        enrolledAt: enrollmentRecord.enrolledAt,
      } : null,
      application_type,
      current_step,
    });
  } catch (error) {
    console.error("Failed to track application:", error);
    res.status(500).json({ message: "Internal server error" });
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


export async function getLearnerProfile(req: Request, res: Response) {
  try {
    const lrn = String(req.params.lrn ?? "").trim();
    if (!/^\d{12}$/.test(lrn)) {
      res.status(400).json({ message: "Invalid LRN format. Must be exactly 12 digits." });
      return;
    }

    const setting = await prisma.schoolSetting.findFirst({
      where: { activeSchoolYearId: { not: null } },
      select: { activeSchoolYearId: true },
    });

    if (!setting?.activeSchoolYearId) {
      res.status(400).json({ message: "No active school year configured." });
      return;
    }

    const learner = await prisma.learner.findUnique({
      where: { lrn },
      include: {
        enrollmentApplications: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            scpProfile: true,
            addresses: true,
            familyMembers: true,
            previousSchool: true,
          },
        },
        scpAdmissions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            addresses: true,
            familyMembers: true,
            previousSchool: true,
          }
        }
      },
    });

    if (!learner) {
      res.status(404).json({ message: "Learner not found." });
      return;
    }

    const application = learner.enrollmentApplications[0];
    const admission = learner.scpAdmissions[0];
    
    // Choose the most recent source for demographic data
    let demographicSource: typeof application | typeof admission | null = null;
    if (application && admission) {
      demographicSource = application.createdAt > admission.createdAt ? application : admission;
    } else {
      demographicSource = application || admission;
    }

    const isActiveYearApp = application?.schoolYearId === setting.activeSchoolYearId;
    const isScp = isActiveYearApp && application?.applicantType !== "REGULAR";

    // Only return QUALIFIED SCP program to enforce locking, otherwise default to what they had
    let scpAdmissionStatus = null;
    if (admission?.schoolYearId === setting.activeSchoolYearId) {
      scpAdmissionStatus = admission.assessmentResult;
    } else if (isScp && application?.scpProfile) {
      scpAdmissionStatus = application.scpProfile.assessmentResult;
    }

    let scpProgram = null;
    if (scpAdmissionStatus === "QUALIFIED" && admission) {
      scpProgram = admission.program;
    } else if (isScp) {
      scpProgram = application.applicantType;
    }

    res.json({
      // Core Learner Demographics
      id: learner.id,
      firstName: learner.firstName,
      lastName: learner.lastName,
      middleName: learner.middleName,
      extensionName: learner.extensionName,
      birthdate: learner.birthdate,
      sex: learner.sex,
      placeOfBirth: learner.placeOfBirth,
      religion: learner.religion,
      motherTongue: learner.motherTongue,
      isIpCommunity: learner.isIpCommunity,
      ipGroupName: learner.ipGroupName,
      isLearnerWithDisability: learner.isLearnerWithDisability,
      disabilityTypes: learner.disabilityTypes,
      is4PsBeneficiary: learner.is4PsBeneficiary,
      householdId4Ps: learner.householdId4Ps,
      hasPwdId: learner.hasPwdId,
      isBalikAral: learner.isBalikAral,
      lastGradeLevel: learner.lastGradeLevel,
      lastYearEnrolled: learner.lastYearEnrolled,
      psaBirthCertNumber: learner.psaBirthCertNumber,
      specialNeedsCategory: learner.specialNeedsCategory,
      studentPhoto: learner.studentPhoto,

      // Previous Application Data (for auto-filling addresses, family, previous school)
      addresses: (demographicSource?.addresses ?? []).map(normalizeAddressForForm),
      familyMembers: demographicSource?.familyMembers || [],
      previousSchool: demographicSource?.previousSchool || null,

      // SCP Status
      scpAdmissionStatus,
      scpProgram,
    });
  } catch (error) {
    console.error("Failed to fetch learner profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function processAdmissionSubmission(
  req: Request,
  res: Response,
  isStaffWalkIn: boolean,
): Promise<void> {
  try {
    const parsed = scpAdmissionSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Validation failed", errors: parsed.error.format() });
      return;
    }
    const data = parsed.data as ScpAdmissionSubmit;

    const schoolSetting = isStaffWalkIn
      ? await getActiveEnrollmentSetting(res)
      : await getOpenPublicEnrollmentSetting(res, true);
    if (!schoolSetting) return;
    const activeSchoolYearId = schoolSetting.activeSchoolYearId;

    if (
      isStaffWalkIn &&
      isScpRosterLocked(schoolSetting.activeSchoolYear, data.scpType as ApplicantType)
    ) {
      res.status(403).json({
        code: "SCP_ROSTER_LOCKED",
        message: "Cannot encode walk-ins while the roster is finalized.",
      });
      return;
    }

    let learner;
    const lrn = data.hasNoLrn ? null : data.lrn;
    if (lrn) {
      learner = await prisma.learner.findUnique({ where: { lrn } });
    }

    const birthdateDate = normalizeDateToUtcNoon(data.birthdate instanceof Date ? data.birthdate : new Date(data.birthdate));

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
      learner = await prisma.learner.update({ where: { id: learner.id }, data: learnerData });
    } else {
      learner = await prisma.learner.create({ data: learnerData });
    }

    const existingAdmission = await prisma.scpAdmission.findFirst({
      where: { learnerId: learner.id, schoolYearId: activeSchoolYearId }
    });

    if (existingAdmission) {
      res.status(409).json({ duplicate_detected: true, requires_auth: true, message: "Learner already has an admission record for this school year." });
      return;
    }

    const yearPrefix = schoolSetting.activeSchoolYear?.yearLabel?.split('-')[0] || new Date().getFullYear().toString();
    const programType = data.scpType || "REGULAR";
    const programAcronym = programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? "STE" : 
                           programType === "SPECIAL_PROGRAM_IN_THE_ARTS" ? "SPA" : 
                           programType === "SPECIAL_PROGRAM_IN_SPORTS" ? "SPS" : "BEC";
    const paddedId = String(learner.id).padStart(7, '0');
    const trackingNumber = `ADM-${programAcronym}${yearPrefix}${paddedId}`;

    const admission = await prisma.scpAdmission.create({
      data: {
        learnerId: learner.id,
        schoolYearId: activeSchoolYearId,
        program: data.scpType as ApplicantType,
        trackingNumber,
        grade5GeneralAverage: data.grade5GeneralAverage,
        underSpecialScienceCurriculum: data.underSpecialScienceCurriculum ?? false,
        artsSpecialization: data.artsSpecialization || null,
        chosenSport: data.chosenSport || null,
        
        addresses: {
          create: [
            {
              addressType: "CURRENT",
              houseNoStreet: data.currentAddress.houseNoStreet || null,
              sitio: data.currentAddress.sitio || null,
              barangay: data.currentAddress.barangay,
              cityMunicipality: data.currentAddress.cityMunicipality,
              province: data.currentAddress.province,
              region: data.currentAddress.region,
            },
            ...(data.permanentAddress && data.permanentAddress.barangay
              ? [{
                  addressType: "PERMANENT" as const,
                  houseNoStreet: data.permanentAddress.houseNoStreet || null,
                  sitio: data.permanentAddress.sitio || null,
                  barangay: data.permanentAddress.barangay,
                  cityMunicipality: data.permanentAddress.cityMunicipality,
                  province: data.permanentAddress.province,
                  region: data.permanentAddress.region,
                }]
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
              ? [{
                  relationship: "GUARDIAN" as const,
                  firstName: data.guardian.firstName,
                  lastName: data.guardian.lastName || "",
                  middleName: data.guardian.middleName || null,
                  contactNumber: data.guardian.contactNumber || null,
                  email: data.guardian.email || null,
                }]
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
        }
      }
    });

    res.status(201).json({
      message: "Admission submitted successfully",
      trackingNumber: admission.trackingNumber,
      id: admission.id,
      ...buildTrackingState("PENDING_VERIFICATION", data.scpType as ApplicantType),
    });
  } catch (error) {
    console.error("Failed to submit admission:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function submitAdmission(req: Request, res: Response): Promise<void> {
  await processAdmissionSubmission(req, res, false);
}

export async function submitWalkInAdmission(
  req: Request,
  res: Response,
): Promise<void> {
  await processAdmissionSubmission(req, res, true);
}

export async function submitEnrollment(req: Request, res: Response) {
  try {
    const parsed = applicationSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Validation failed", errors: parsed.error.format() });
      return;
    }
    const data = parsed.data;

    const schoolSetting = await getOpenPublicEnrollmentSetting(res, false);
    if (!schoolSetting) return;
    const activeSchoolYearId = schoolSetting.activeSchoolYearId;

    let learner;
    const lrn = data.hasNoLrn ? null : data.lrn;
    if (lrn) {
      learner = await prisma.learner.findUnique({ where: { lrn } });
    }

    const birthdateDate = normalizeDateToUtcNoon(data.birthdate instanceof Date ? data.birthdate : new Date(data.birthdate));

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
      learner = await prisma.learner.update({ where: { id: learner.id }, data: learnerData });
    } else {
      learner = await prisma.learner.create({ data: learnerData });
    }

    // DUPLICATE ENROLLMENT CHECK (The Block)
    const existingEnrollment = await prisma.enrollmentApplication.findFirst({
      where: { learnerId: learner.id, schoolYearId: activeSchoolYearId },
    });

    if (existingEnrollment) {
      if (existingEnrollment.status === "PENDING_VERIFICATION") {
        res.status(409).json({ duplicate_detected: true, requires_auth: true, message: "Learner already has a pending application for this school year." });
        return;
      } else {
        res.status(400).json({ message: "Learner already has an application for this school year." });
        return;
      }
    }

    // ADMISSION CROSS-REFERENCE (The Facilitator)
    let assignedProgram = "REGULAR";
    let scpAdmissionId = null;

    const admission = await prisma.scpAdmission.findFirst({
      where: { learnerId: learner.id, schoolYearId: activeSchoolYearId }
    });

    if (admission && admission.assessmentResult === "QUALIFIED") {
      assignedProgram = admission.program;
      scpAdmissionId = admission.id;
    }

    const gradeLevelRecord = await prisma.gradeLevel.findFirst({
      where: { name: `Grade ${data.gradeLevel}` },
    });
    if (!gradeLevelRecord) {
      res.status(400).json({ message: "Invalid grade level." });
      return;
    }

    const yearPrefix = schoolSetting.activeSchoolYear?.yearLabel?.split("-")[0] || new Date().getFullYear().toString();
    const programAcronym = assignedProgram === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? "STE" : 
                           assignedProgram === "SPECIAL_PROGRAM_IN_THE_ARTS" ? "SPA" : 
                           assignedProgram === "SPECIAL_PROGRAM_IN_SPORTS" ? "SPS" : "BEC";
    const paddedId = String(learner.id).padStart(7, '0');
    const trackingNumber = `ENR-${programAcronym}${yearPrefix}${paddedId}`;

    const application = await prisma.enrollmentApplication.create({
      data: {
        learnerId: learner.id,
        schoolYearId: activeSchoolYearId,
        gradeLevelId: gradeLevelRecord.id,
        applicantType: assignedProgram as ApplicantType,
        learnerType: data.learnerType,
        admissionChannel: "ONLINE",
        trackingNumber,
        scpAdmissionId,
        learningModalities: data.learningModalities,
        isPrivacyConsentGiven: data.isPrivacyConsentGiven,
        intakeHeightCm: data.intakeHeightCm || null,
        intakeWeightKg: data.intakeWeightKg || null,
        status: "PENDING_VERIFICATION",
        duplicateFlag: false,
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
              province: data.currentAddress.province,
              region: data.currentAddress.region,
            },
            ...(data.permanentAddress && data.permanentAddress.barangay
              ? [{
                  addressType: "PERMANENT" as const,
                  houseNoStreet: data.permanentAddress.houseNoStreet || null,
                  sitio: data.permanentAddress.sitio || null,
                  barangay: data.permanentAddress.barangay,
                  cityMunicipality: data.permanentAddress.cityMunicipality,
                  province: data.permanentAddress.province,
                  region: data.permanentAddress.region,
                }]
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
              ? [{
                  relationship: "GUARDIAN" as const,
                  firstName: data.guardian.firstName,
                  lastName: data.guardian.lastName || "",
                  middleName: data.guardian.middleName || null,
                  contactNumber: data.guardian.contactNumber || null,
                  email: data.guardian.email || null,
                }]
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
        }
      },
    });

    res.status(201).json({
      message: "Application submitted successfully",
      trackingNumber: application.trackingNumber,
      id: application.id,
      ...buildTrackingState(application.status, application.applicantType),
    });
  } catch (error) {
    console.error("Failed to submit enrollment:", error);
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
    const parsedDate = data.birthdate instanceof Date ? data.birthdate : new Date(data.birthdate);
    const birthdateDate = normalizeDateToUtcNoon(parsedDate);
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
    await prisma.enrollmentPreviousSchool.deleteMany({ where: { enrollmentId: existingApplication.id } });

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
              province: data.currentAddress.province,
            },
            ...(data.permanentAddress && data.permanentAddress.barangay
              ? [
                  {
                    addressType: "PERMANENT" as const,
                    houseNoStreet: data.permanentAddress.houseNoStreet || null,
                    sitio: data.permanentAddress.sitio || null,
                    barangay: data.permanentAddress.barangay,
                    cityMunicipality: data.permanentAddress.cityMunicipality,
                    province: data.permanentAddress.province,
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
