import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/index.js";
import { AppError } from "../../lib/AppError.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { getTrackingPrefix, generateTrackingNumber as generateTrackingNumberStd } from "../../lib/tracking.js";
import { applicationSubmitSchema } from "@enrollpro/shared";

function generateTrackingNumber(): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `EN-${year}-${randomStr}`;
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
    const schoolSetting = await prisma.schoolSetting.findFirst({
      where: { activeSchoolYearId: { not: null } },
      include: { activeSchoolYear: true },
    });

    const activeSchoolYearId = schoolSetting?.activeSchoolYearId;
    if (!activeSchoolYearId) {
      res.status(400).json({ message: "No active school year set." });
      return;
    }

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
          },
        },
      },
    });

    res.status(201).json({
      message: "Application submitted successfully",
      trackingNumber: application.trackingNumber,
      id: application.id,
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
    
    const schoolSetting = await prisma.schoolSetting.findFirst({ where: { activeSchoolYearId: { not: null } } });
    const activeSchoolYearId = schoolSetting?.activeSchoolYearId;
    if (!activeSchoolYearId) {
      res.status(400).json({ message: "No active school year set." });
      return;
    }

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
          },
        },
      },
    });

    res.status(200).json({
      message: "Application updated successfully",
      trackingNumber: application.trackingNumber,
      id: application.id,
    });
  } catch (error) {
    console.error("Failed to update application:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

const LRN_REGEX = /^\d{12}$/;

export async function lookupLrn(req: Request, res: Response) {
  try {
    const lrn = String(req.params.lrn);

    if (!lrn || lrn.length !== 12) {
      res.status(400).json({ message: "LRN must be exactly 12 digits." });
      return;
    }

    const learner = await prisma.learner.findUnique({
      where: { lrn },
      include: {
        enrollmentApplications: {
          orderBy: { schoolYearId: "desc" },
          take: 1,
          include: {
            gradeLevel: true,
            familyMembers: true,
            addresses: true,
            previousSchool: true,
          },
        },
      },
    });

    if (!learner) {
      res.status(404).json({ message: "Learner profile not found." });
      return;
    }

    const latestApp = learner.enrollmentApplications[0];

    const mother = latestApp?.familyMembers.find((f: { relationship: string }) => f.relationship === "MOTHER");
    const father = latestApp?.familyMembers.find((f: { relationship: string }) => f.relationship === "FATHER");
    const guardian = latestApp?.familyMembers.find((f: { relationship: string }) => f.relationship === "GUARDIAN");

    const currentAddress = latestApp?.addresses.find((a: { addressType: string }) => a.addressType === "CURRENT");

    let region = "";
    if (currentAddress?.province) {
      const prov = await prisma.province.findUnique({
        where: { code: currentAddress.province },
        select: { regionCode: true },
      });
      if (prov) {
        region = prov.regionCode;
      }
    }

    const email = guardian?.email || mother?.email || father?.email || "";

    const source =
      latestApp?.status === "EARLY_REG_SUBMITTED" || latestApp?.status === "PRE_REGISTERED"
        ? "EARLY_REGISTRATION"
        : "ENROLLMENT";

    const birthdate = learner.birthdate ? new Date(learner.birthdate).toISOString().slice(0, 10) : "";

    res.json({
      id: learner.id,
      lrn: learner.lrn,
      firstName: learner.firstName,
      lastName: learner.lastName,
      middleName: learner.middleName,
      extensionName: learner.extensionName,
      birthdate,
      sex: learner.sex,
      placeOfBirth: learner.placeOfBirth,
      contactNumber: latestApp?.contactNumber || "",
      email,
      originSchoolName: latestApp?.previousSchool?.schoolName || latestApp?.originatingSchoolName || "",
      lastSchoolId: "",
      schoolYearLastAttended: learner.lastYearEnrolled || "",
      lastGradeCompleted: learner.lastGradeLevel || "",
      lastSchoolAddress: latestApp?.previousSchool?.schoolAddress || "",
      guardianRelationship: latestApp?.guardianRelationship || "",
      learnerType: latestApp?.learnerType || "TRANSFEREE",
      gradeLevelId: latestApp?.gradeLevelId ? String(latestApp.gradeLevelId) : "",
      academicStatus: latestApp?.academicStatus || "PROMOTED",
      mother: mother
        ? {
            firstName: mother.firstName,
            lastName: mother.lastName,
            middleName: mother.middleName || "",
            contactNumber: mother.contactNumber || "",
          }
        : undefined,
      father: father
        ? {
            firstName: father.firstName,
            lastName: father.lastName,
            middleName: father.middleName || "",
            contactNumber: father.contactNumber || "",
          }
        : undefined,
      guardian: guardian
        ? {
            firstName: guardian.firstName,
            lastName: guardian.lastName,
            middleName: guardian.middleName || "",
            contactNumber: guardian.contactNumber || "",
          }
        : undefined,
      currentAddress: currentAddress
        ? {
            houseNoStreet: currentAddress.houseNoStreet || "",
            sitio: currentAddress.sitio || "",
            barangay: currentAddress.barangay || "",
            cityMunicipality: currentAddress.cityMunicipality || "",
            region: region,
            province: currentAddress.province || "",
          }
        : undefined,
      isSf9Submitted: latestApp?.isMissingSf9 === false,
      isPsaBirthCertPresented: learner.hasPsaBirthCertificate,
      finalGeneralAverage: latestApp?.previousSchool?.generalAverage || "",
      source,
      status: latestApp?.status || "",
      enrollmentApplicationId: latestApp?.id || null,
      earlyRegistrationId: source === "EARLY_REGISTRATION" ? latestApp?.id : null,
      applicantType: latestApp?.applicantType || null,
    });
  } catch (error) {
    console.error("Error in lookupLrn:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function specialEnrollment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = req.body;
    const {
      firstName,
      lastName,
      learnerType,
      applicantType = "REGULAR",
      gradeLevelId,
    } = data;
    const processOutcome =
      data.processOutcome === "ENCODE_ONLY"
        ? "ENCODE_ONLY"
        : "ENCODE_AND_VERIFY";
    const requestedEnrollmentId = Number.parseInt(
      String(data.enrollmentApplicationId ?? ""),
      10,
    );

    const normalizedLrn =
      typeof data.lrn === "string" && data.lrn.trim().length > 0
        ? data.lrn.trim()
        : null;
    const hasNoLrn = data.hasNoLrn === true;

    if (!hasNoLrn && (!normalizedLrn || !LRN_REGEX.test(normalizedLrn))) {
      throw new AppError(400, "LRN must be exactly 12 digits.");
    }

    if (hasNoLrn && normalizedLrn) {
      throw new AppError(
        422,
        "Clear the LRN field when enrolling a learner without LRN.",
      );
    }

    const parsedGradeLevelId = Number.parseInt(String(gradeLevelId), 10);
    if (!Number.isInteger(parsedGradeLevelId) || parsedGradeLevelId <= 0) {
      throw new AppError(400, "Grade level is required.");
    }

    const gradeLevel = await prisma.gradeLevel.findUnique({
      where: { id: parsedGradeLevelId },
      select: { id: true, name: true },
    });
    if (!gradeLevel) {
      throw new AppError(404, "Grade level not found.");
    }

    if (hasNoLrn) {
      const gradeMatch = gradeLevel.name.match(/\d+/);
      const gradeNumber = gradeMatch
        ? Number.parseInt(gradeMatch[0], 10)
        : null;
      const isIncomingGrade7 =
        learnerType === "NEW_ENROLLEE" && gradeNumber === 7;
      const isTransferee = learnerType === "TRANSFEREE";

      if (!isIncomingGrade7 && !isTransferee) {
        throw new AppError(
          422,
          "Only incoming Grade 7 and transferee learners can enroll without LRN.",
        );
      }
    }

    const parsedBirthdate = new Date(data.birthdate);
    if (Number.isNaN(parsedBirthdate.getTime())) {
      throw new AppError(400, "Invalid birthdate format.");
    }

    const normalizeOptional = (value: unknown): string | null => {
      if (typeof value !== "string") {
        return null;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const motherData = data.mother
      ? {
          relationship: "MOTHER" as const,
          firstName: data.mother.firstName.trim(),
          lastName: data.mother.lastName.trim(),
          middleName: normalizeOptional(data.mother.middleName),
          extensionName: normalizeOptional(data.mother.extensionName),
          contactNumber: normalizeOptional(data.mother.contactNumber),
        }
      : null;
    const fatherData = data.father
      ? {
          relationship: "FATHER" as const,
          firstName: data.father.firstName.trim(),
          lastName: data.father.lastName.trim(),
          middleName: normalizeOptional(data.father.middleName),
          extensionName: normalizeOptional(data.father.extensionName),
          contactNumber: normalizeOptional(data.father.contactNumber),
        }
      : null;
    const guardianData = data.guardian
      ? {
          relationship: "GUARDIAN" as const,
          firstName: data.guardian.firstName.trim(),
          lastName: data.guardian.lastName.trim(),
          middleName: normalizeOptional(data.guardian.middleName),
          extensionName: normalizeOptional(data.guardian.extensionName),
          contactNumber: normalizeOptional(data.guardian.contactNumber),
        }
      : null;

    if (!motherData && !fatherData && !guardianData) {
      throw new AppError(
        422,
        "Provide at least one complete mother, father, or guardian identity.",
      );
    }

    const addressData: Prisma.ApplicationAddressCreateManyInput[] = [];
    if (data.currentAddress) {
      addressData.push({
        addressType: "CURRENT",
        houseNoStreet: normalizeOptional(data.currentAddress.houseNoStreet),
        sitio: normalizeOptional(data.currentAddress.sitio),
        barangay: data.currentAddress.barangay,
        cityMunicipality: data.currentAddress.cityMunicipality,
        province: data.currentAddress.province,
      });
    }

    const familyData: Prisma.ApplicationFamilyMemberCreateManyInput[] = [];
    if (motherData) familyData.push(motherData);
    if (fatherData) familyData.push(fatherData);
    if (guardianData) familyData.push(guardianData);

    // 1. Create or Find Learner
    let learner = await prisma.learner.findFirst({
      where: normalizedLrn
        ? { lrn: normalizedLrn }
        : { firstName, lastName, birthdate: parsedBirthdate },
    });
    console.log(
      `[specialEnrollment] Learner found by ${normalizedLrn ? "LRN" : "Name"}:`,
      learner?.id || "NOT FOUND",
    );

    if (!learner) {
      learner = await prisma.learner.create({
        data: {
          lrn: normalizedLrn,
          firstName,
          lastName,
          middleName: data.middleName,
          extensionName: data.extensionName,
          birthdate: parsedBirthdate,
          sex: data.sex,
          placeOfBirth: normalizeOptional(data.placeOfBirth),
          isPendingLrnCreation: hasNoLrn || !normalizedLrn,
          lastGradeLevel: normalizeOptional(data.lastGradeCompleted),
          lastYearEnrolled: normalizeOptional(data.schoolYearLastAttended),
        },
      });
      console.log(`[specialEnrollment] Created new learner:`, learner.id);
    } else {
      learner = await prisma.learner.update({
        where: { id: learner.id },
        data: {
          lrn: normalizedLrn ?? learner.lrn,
          firstName,
          lastName,
          middleName: data.middleName,
          extensionName: data.extensionName,
          birthdate: parsedBirthdate,
          sex: data.sex,
          placeOfBirth: normalizeOptional(data.placeOfBirth),
          isPendingLrnCreation: hasNoLrn || !normalizedLrn,
          lastGradeLevel: normalizeOptional(data.lastGradeCompleted),
          lastYearEnrolled: normalizeOptional(data.schoolYearLastAttended),
        },
      });
      console.log(
        `[specialEnrollment] Updated existing learner:`,
        learner.id,
      );
    }

    // 2. Get active school year
    const settings = await prisma.schoolSetting.findFirst({
      include: { activeSchoolYear: true },
    });
    if (!settings?.activeSchoolYear) {
      throw new AppError(422, "No active school year found.");
    }
    const activeSchoolYear = settings.activeSchoolYear;
    console.log(
      `[specialEnrollment] Active School Year ID:`,
      activeSchoolYear.id,
    );

    const existingEnrollment = await prisma.enrollmentApplication.findFirst({
      where: {
        learnerId: learner.id,
        schoolYearId: activeSchoolYear.id,
        status: { notIn: ["REJECTED", "WITHDRAWN"] },
      },
      select: {
        id: true,
        status: true,
        trackingNumber: true,
      },
    });
    console.log(
      `[specialEnrollment] Existing Enrollment:`,
      existingEnrollment,
    );

    const updatableStatuses = new Set([
      "PENDING_BEEF",
      "AWAITING_VERIFICATION",
      "SUBMITTED_BEEF",
    ]);

    let targetEnrollment = existingEnrollment;

    if (
      Number.isInteger(requestedEnrollmentId) &&
      requestedEnrollmentId > 0
    ) {
      console.log(
        `[specialEnrollment] Requested Enrollment ID:`,
        requestedEnrollmentId,
      );
      const requestedEnrollment =
        await prisma.enrollmentApplication.findFirst({
          where: {
            id: requestedEnrollmentId,
            learnerId: learner.id,
            schoolYearId: settings.activeSchoolYearId || undefined,
            status: { notIn: ["REJECTED", "WITHDRAWN"] },
          },
          select: {
            id: true,
            status: true,
            trackingNumber: true,
          },
        });

      if (requestedEnrollment) {
        console.log(
          `[specialEnrollment] Found requested enrollment:`,
          requestedEnrollment,
        );
        targetEnrollment = requestedEnrollment;
      } else {
        console.warn(
          `[specialEnrollment] Requested enrollment ID ${requestedEnrollmentId} not found for learner ${learner.id} in active SY ${settings.activeSchoolYearId}. Falling back to default logic.`,
        );
      }
    }

    console.log(
      `[specialEnrollment] Resolved Target Enrollment:`,
      targetEnrollment,
    );
    if (targetEnrollment && !updatableStatuses.has(targetEnrollment.status)) {
      console.warn(
        `[specialEnrollment] Target enrollment status ${targetEnrollment.status} is NOT updatable.`,
      );
      throw new AppError(
        409,
        `An active enrollment already exists for this learner (Tracking: ${targetEnrollment.trackingNumber ?? `#${targetEnrollment.id}`}, Status: ${targetEnrollment.status}).`,
      );
    }

    const shouldTemporarilyEnroll =
      (data.isMissingSf9 && !data.hasSf9CertificationLetter) ||
      data.hasUnsettledPrivateAccount ||
      false;
    const resolvedStatus =
      processOutcome === "ENCODE_ONLY"
        ? "AWAITING_VERIFICATION"
        : shouldTemporarilyEnroll
          ? "TEMPORARILY_ENROLLED"
          : applicantType === "LATE_ENROLLEE"
            ? "VERIFIED" // Late enrollees skip Phil-IRI — inline-slot handles direct enrollment
            : "SUBMITTED_BEEF"; // Regular ENCODE_AND_VERIFY → Phil-IRI assessment queue

    console.log(`[specialEnrollment] Resolved Status:`, resolvedStatus);
    console.log(
      `[specialEnrollment] Target Enrollment Action:`,
      targetEnrollment ? "UPDATE" : "CREATE",
    );

    const encodedById = req.user?.userId;
    if (!encodedById) {
      throw new AppError(401, "Unauthorized: User session not found.");
    }

    let persistedApplication;
    try {
      persistedApplication = targetEnrollment
        ? await prisma.enrollmentApplication.update({
            where: { id: targetEnrollment.id },
            data: {
              gradeLevelId: gradeLevel.id,
              applicantType: applicantType as any,
              learnerType: learnerType as any,
              status: resolvedStatus,
              intakeMethod: "BEEF_FULL",
              admissionChannel: "F2F",
              guardianRelationship: normalizeOptional(
                data.guardianRelationship,
              ),
              hasNoMother: !motherData,
              hasNoFather: !fatherData,
              encodedById,
              isPrivacyConsentGiven: true,
              isTemporarilyEnrolled: shouldTemporarilyEnroll,
              isMissingSf9: data.isMissingSf9 || false,
              hasSf9CertificationLetter:
                data.hasSf9CertificationLetter || false,
              hasUnsettledPrivateAccount:
                data.hasUnsettledPrivateAccount || false,
              originatingSchoolName: normalizeOptional(
                data.originatingSchoolName,
              ),
            },
            include: { learner: true },
          })
        : await prisma.enrollmentApplication.create({
            data: {
              learnerId: learner.id,
              schoolYearId: settings.activeSchoolYearId!,
              gradeLevelId: gradeLevel.id,
              applicantType: applicantType as any,
              learnerType: learnerType as any,
              status: resolvedStatus,
              intakeMethod: "BEEF_FULL",
              admissionChannel: "F2F",
              guardianRelationship: normalizeOptional(
                data.guardianRelationship,
              ),
              hasNoMother: !motherData,
              hasNoFather: !fatherData,
              encodedById,
              isPrivacyConsentGiven: true,
              isTemporarilyEnrolled: shouldTemporarilyEnroll,
              isMissingSf9: data.isMissingSf9 || false,
              hasSf9CertificationLetter:
                data.hasSf9CertificationLetter || false,
              hasUnsettledPrivateAccount:
                data.hasUnsettledPrivateAccount || false,
              originatingSchoolName: normalizeOptional(
                data.originatingSchoolName,
              ),
            },
            include: { learner: true },
          });
      console.log(
        `[specialEnrollment] Persisted Application ID:`,
        persistedApplication.id,
      );
    } catch (dbError) {
      console.error(
        `[specialEnrollment] FAILED to persist application:`,
        dbError,
      );
      throw dbError;
    }

    try {
      console.log(`[specialEnrollment] Updating Address and Family...`);
      await prisma.applicationAddress.deleteMany({
        where: { enrollmentId: persistedApplication.id },
      });
      if (addressData.length > 0) {
        await prisma.applicationAddress.createMany({
          data: addressData.map((item) => ({
            ...item,
            enrollmentId: persistedApplication.id,
          })),
        });
      }

      await prisma.applicationFamilyMember.deleteMany({
        where: { enrollmentId: persistedApplication.id },
      });
      if (familyData.length > 0) {
        await prisma.applicationFamilyMember.createMany({
          data: familyData.map((item) => ({
            ...item,
            enrollmentId: persistedApplication.id,
          })),
        });
      }
    } catch (relError) {
      console.error(
        `[specialEnrollment] FAILED to update address/family:`,
        relError,
      );
      throw relError;
    }

    console.log(`[specialEnrollment] Checking Previous School...`);
    const hasPreviousSchoolPayload =
      data.lastSchoolName ||
      data.originSchoolName ||
      typeof data.checklist?.finalGeneralAverage === "number" ||
      typeof data.generalAverage === "number";

    console.log(
      `[specialEnrollment] hasPreviousSchoolPayload: ${hasPreviousSchoolPayload}`,
    );

    if (hasPreviousSchoolPayload) {
      try {
        console.log(
          `[specialEnrollment] Upserting previous school for App ID: ${persistedApplication.id}`,
        );
        await prisma.enrollmentPreviousSchool.upsert({
          where: { applicationId: persistedApplication.id },
          update: {
            schoolName:
              normalizeOptional(
                data.lastSchoolName || data.originSchoolName,
              ) || "UNKNOWN SCHOOL",
            schoolAddress: normalizeOptional(data.lastSchoolAddress),
            schoolType: normalizeOptional(data.lastSchoolType),
            generalAverage:
              typeof data.generalAverage === "number"
                ? data.generalAverage
                : typeof data.checklist?.finalGeneralAverage === "number"
                  ? data.checklist.finalGeneralAverage
                  : null,
          },
          create: {
            applicationId: persistedApplication.id,
            schoolName:
              normalizeOptional(
                data.lastSchoolName || data.originSchoolName,
              ) || "UNKNOWN SCHOOL",
            schoolAddress: normalizeOptional(data.lastSchoolAddress),
            schoolType: normalizeOptional(data.lastSchoolType),
            generalAverage:
              typeof data.generalAverage === "number"
                ? data.generalAverage
                : typeof data.checklist?.finalGeneralAverage === "number"
                  ? data.checklist.finalGeneralAverage
                  : null,
          },
        });
        console.log(`[specialEnrollment] Previous school upsert SUCCESS`);
      } catch (prevSchoolError) {
        console.error(
          `[specialEnrollment] FAILED to update previous school:`,
          prevSchoolError,
        );
        throw prevSchoolError;
      }
    }

    console.log(
      `[specialEnrollment] Finalizing Tracking Number...`,
    );
    const trackingNumber =
      targetEnrollment?.trackingNumber ??
      generateTrackingNumberStd({
        prefix: getTrackingPrefix(persistedApplication.applicantType),
        schoolYear: activeSchoolYear.yearLabel,
        id: persistedApplication.id,
      });

    const updated = await prisma.enrollmentApplication.update({
      where: { id: persistedApplication.id },
      data: { 
        trackingNumber,
        isLateEnrollee: settings?.systemPhase === "CLASSES_ONGOING",
      },
      include: { learner: true, gradeLevel: true },
    });

    // Ensure Learner has a corresponding User record (Single Source of Truth)
    const { ensureLearnerUserAccount } = await import("../learner/learner.service.js");
    await prisma.$transaction(async (tx) => {
      await ensureLearnerUserAccount(tx, updated.learner);
    });

    await auditLog({
      userId: encodedById,
      actionType: "APPLICATION_SUBMITTED",
      description:
        processOutcome === "ENCODE_ONLY"
          ? `Registrar encoded BEEF for ${updated.learner.firstName} ${updated.learner.lastName} (#${updated.id}) and routed to AWAITING_VERIFICATION.`
          : `Registrar encoded and verified BEEF for ${updated.learner.firstName} ${updated.learner.lastName} (#${updated.id}).`,
      subjectType: "EnrollmentApplication",
      recordId: updated.id,
      req,
    });

    res.status(201).json(updated);
  } catch (error) {
    console.error("[DEBUG_ERROR] specialEnrollment error:", error);
    next(error);
  }
}
