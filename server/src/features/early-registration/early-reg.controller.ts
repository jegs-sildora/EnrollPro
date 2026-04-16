import { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { AppError } from "../../lib/AppError.js";
import { normalizeDateToUtcNoon } from "../school-year/school-year.service.js";
import { getRequiredDocuments } from "../enrollment/enrollment-requirement.service.js";
import fs from "fs";
import { saveBase64Image } from "../../lib/fileUploader.js";
import {
  LearnerType,
  FamilyRelationship,
  ApplicationStatus,
  AdmissionChannel,
  PrimaryContactType,
  Prisma,
} from "../../generated/prisma/index.js";
import { createEarlyRegistrationSharedService } from "../admission/services/early-registration-shared.service.js";
import { createAdmissionControllerDeps } from "../admission/services/admission-controller.deps.js";

const sharedService = createEarlyRegistrationSharedService(
  createAdmissionControllerDeps(),
);

// ── Helpers ──

/** Recursively converts all string values to uppercase and trims them. */
function toUpperCaseRecursive(obj: unknown): unknown {
  const skipKeys = ["contactNumber", "email", "emailAddress", "studentPhoto"];

  if (Array.isArray(obj)) {
    return obj.map((v) => toUpperCaseRecursive(v));
  } else if (
    obj !== null &&
    typeof obj === "object" &&
    !(obj instanceof Date)
  ) {
    const newObj: Record<string, unknown> = {};
    for (const key in obj as Record<string, unknown>) {
      if (skipKeys.includes(key)) {
        newObj[key] = (obj as Record<string, unknown>)[key];
      } else {
        newObj[key] = toUpperCaseRecursive(
          (obj as Record<string, unknown>)[key],
        );
      }
    }
    return newObj;
  } else if (typeof obj === "string") {
    return obj.trim().toUpperCase();
  }
  return obj;
}

/** Calculate age from birthdate in Asia/Manila timezone. */
function calculateAge(birthdate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthdate.getFullYear();
  const monthDiff = now.getMonth() - birthdate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && now.getDate() < birthdate.getDate())
  ) {
    age--;
  }
  return age;
}

const LEARNER_TYPE_VALUES = new Set([
  "NEW_ENROLLEE",
  "TRANSFEREE",
  "RETURNING",
  "CONTINUING",
  "OSCYA",
  "ALS",
]);

const PRIMARY_CONTACT_VALUES = new Set(["FATHER", "MOTHER", "GUARDIAN"]);

const APPLICANT_TYPE_VALUES = new Set([
  "REGULAR",
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
  "SPECIAL_PROGRAM_IN_JOURNALISM",
  "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
  "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
]);

const DOCUMENT_CHECKLIST_MAPPING: Record<string, string> = {
  PSA_BIRTH_CERTIFICATE: "isPsaBirthCertPresented",
  SECONDARY_BIRTH_PROOF: "isPsaBirthCertPresented",
  SF9_REPORT_CARD: "isSf9Submitted",
  SF10_PERMANENT_RECORD: "isSf10Requested",
  GOOD_MORAL_CERTIFICATE: "isGoodMoralPresented",
  MEDICAL_CERTIFICATE: "isMedicalEvalSubmitted",
  MEDICAL_EVALUATION: "isMedicalEvalSubmitted",
  CERTIFICATE_OF_RECOGNITION: "isCertOfRecognitionPresented",
  UNDERTAKING: "isUndertakingSigned",
  AFFIDAVIT_OF_UNDERTAKING: "isUndertakingSigned",
  CONFIRMATION_SLIP: "isConfirmationSlipReceived",
};

const LRN_REGEX = /^\d{12}$/;

type ApplicantTypeValue =
  | "REGULAR"
  | "SCIENCE_TECHNOLOGY_AND_ENGINEERING"
  | "SPECIAL_PROGRAM_IN_THE_ARTS"
  | "SPECIAL_PROGRAM_IN_SPORTS"
  | "SPECIAL_PROGRAM_IN_JOURNALISM"
  | "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE"
  | "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION";

function normalizeGradeLevelToken(value: unknown): string {
  const raw = String(value ?? "").trim();
  const digitMatch = raw.match(/\d+/);
  return digitMatch?.[0] ?? raw;
}

function toLearnerTypeV2(value: unknown): LearnerType | null {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!LEARNER_TYPE_VALUES.has(raw)) return null;
  return raw as LearnerType;
}

function canDeclareNoLrn(
  learnerType: LearnerType | null,
  normalizedGradeLevel: string,
): boolean {
  if (!learnerType) return false;
  return (
    learnerType === "TRANSFEREE" ||
    (learnerType === "NEW_ENROLLEE" && normalizedGradeLevel === "7")
  );
}

function isTruthyQuery(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

function toPrimaryContactV2(value: unknown): PrimaryContactType | null {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!PRIMARY_CONTACT_VALUES.has(raw)) return null;
  return raw as PrimaryContactType;
}

function resolveApplicantType(
  isScpApplication: unknown,
  scpType: unknown,
): ApplicantTypeValue {
  if (!isScpApplication) {
    return "REGULAR";
  }

  const rawScpType = String(scpType ?? "")
    .trim()
    .toUpperCase();

  if (rawScpType === "REGULAR" || !APPLICANT_TYPE_VALUES.has(rawScpType)) {
    throw new AppError(400, "Selected SCP track is invalid.");
  }

  return rawScpType as ApplicantTypeValue;
}

// ── Shared store logic for both public and F2F ──

interface StoreOptions {
  channel: AdmissionChannel;
  encodedById?: number | null;
}

function mapCreateRegistrationDuplicateError(error: unknown): AppError | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    (error as { code?: string }).code !== "P2002"
  ) {
    return null;
  }

  const targetMeta = (error as { meta?: { target?: string[] | string } }).meta
    ?.target;
  const targets = Array.isArray(targetMeta)
    ? targetMeta.map((value) => String(value).toLowerCase())
    : typeof targetMeta === "string"
      ? [targetMeta.toLowerCase()]
      : [];

  const hasTarget = (needle: string) =>
    targets.some((target) => target.includes(needle));

  const isLrnDuplicate = hasTarget("lrn") || hasTarget("uq_learners_lrn");
  if (isLrnDuplicate) {
    return new AppError(409, "A learner with this LRN already exists.");
  }

  const isRegistrantSchoolYearDuplicate =
    hasTarget("uq_early_reg_per_sy") ||
    ((hasTarget("learnerid") || hasTarget("learner_id")) &&
      (hasTarget("schoolyearid") || hasTarget("school_year_id")));

  if (isRegistrantSchoolYearDuplicate) {
    return new AppError(
      409,
      "An early registration for this learner already exists for this School Year.",
    );
  }

  return new AppError(
    409,
    "A duplicate early registration record was detected.",
  );
}

async function createRegistration(
  req: Request,
  res: Response,
  next: NextFunction,
  options: StoreOptions,
) {
  try {
    // 1. Get active school year
    const settings = await prisma.schoolSetting.findFirst({
      include: { activeSchoolYear: true },
    });

    if (!settings?.activeSchoolYear) {
      throw new AppError(
        400,
        "No active School Year is set. Please contact the school registrar.",
      );
    }

    const activeYear = settings.activeSchoolYear;
    const body = toUpperCaseRecursive(req.body) as Record<string, any>;

    const normalizedGradeLevel = normalizeGradeLevelToken(body.gradeLevel);
    const gradeLevelV2 = await prisma.gradeLevel.findFirst({
      where: {
        schoolYearId: activeYear.id,
        OR: [
          { name: { equals: normalizedGradeLevel, mode: "insensitive" } },
          {
            name: {
              equals: `GRADE ${normalizedGradeLevel}`,
              mode: "insensitive",
            },
          },
          { name: { equals: `G${normalizedGradeLevel}`, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });

    if (!gradeLevelV2) {
      throw new AppError(
        400,
        `Grade Level "${body.gradeLevel}" not found for the active School Year.`,
      );
    }

    const learnerTypeV2 = toLearnerTypeV2(body.learnerType);
    if (!learnerTypeV2) {
      throw new AppError(400, "Invalid learner type.");
    }

    const primaryContactV2 = toPrimaryContactV2(body.primaryContact);
    const applicantType = resolveApplicantType(
      body.isScpApplication,
      body.scpType,
    );

    const rawLrn = String(body.lrn ?? "").trim();
    const hasNoLrnDeclared = body.hasNoLrn === true;
    const canSubmitWithoutLrn = canDeclareNoLrn(
      learnerTypeV2,
      normalizedGradeLevel,
    );

    if (hasNoLrnDeclared && !canSubmitWithoutLrn) {
      throw new AppError(
        422,
        "Only incoming Grade 7 and transferee learners can submit without an LRN.",
      );
    }

    if (hasNoLrnDeclared && rawLrn) {
      throw new AppError(
        422,
        "Clear the LRN field when declaring that the learner has no LRN.",
      );
    }

    const lrn: string | null = hasNoLrnDeclared ? null : rawLrn || null;
    if (!hasNoLrnDeclared && !lrn) {
      throw new AppError(
        422,
        "LRN is required unless you declare that the learner has no LRN.",
      );
    }

    const isPendingLrnCreation = hasNoLrnDeclared && !lrn;

    if (applicantType !== "REGULAR") {
      const offeredScpConfig = await prisma.scpProgramConfig.findFirst({
        where: {
          schoolYearId: activeYear.id,
          scpType: applicantType,
          isOffered: true,
        },
        select: { id: true },
      });

      if (!offeredScpConfig) {
        throw new AppError(
          422,
          "The selected SCP track is not available for the active School Year.",
        );
      }
    }

    // 2. Parse and validate birthdate
    const rawBirthDate = new Date(body.birthdate);
    if (isNaN(rawBirthDate.getTime())) {
      throw new AppError(400, "Enter a valid birthdate in MM/DD/YYYY format.");
    }
    const birthDate = normalizeDateToUtcNoon(rawBirthDate);
    const age = calculateAge(rawBirthDate);

    // 3. Check duplicate LRN in same School Year (both early reg + enrollment app tables)
    if (lrn) {
      const existingEarlyReg = await prisma.learner.findFirst({
        where: {
          lrn,
          earlyRegistrationApplications: {
            some: { schoolYearId: activeYear.id },
          },
        },
        select: { id: true },
      });
      if (existingEarlyReg) {
        throw new AppError(
          409,
          `A registration with LRN ${lrn} already exists for this School Year.`,
        );
      }

      const existingEnrollmentApp =
        await prisma.enrollmentApplication.findFirst({
          where: { learner: { lrn }, schoolYearId: activeYear.id },
          select: { id: true },
        });
      if (existingEnrollmentApp) {
        throw new AppError(
          409,
          `An enrollment application with LRN ${lrn} already exists for this School Year.`,
        );
      }
    }

    // 4. Build guardian data
    const guardianData: {
      relationship: FamilyRelationship;
      lastName: string;
      firstName: string;
      middleName?: string | null;
      contactNumber?: string | null;
      email?: string | null;
      occupation?: string | null;
    }[] = [];

    if (body.father?.lastName && body.father?.firstName) {
      guardianData.push({
        relationship: "FATHER",
        lastName: body.father.lastName,
        firstName: body.father.firstName,
        middleName: body.father.middleName || null,
        contactNumber:
          body.father.contactNumber ||
          (primaryContactV2 === "FATHER" ? body.contactNumber : null),
        email:
          body.father.email ||
          (primaryContactV2 === "FATHER" ? body.email : null),
        occupation: body.father.occupation || null,
      });
    }
    if (body.mother?.maidenName && body.mother?.firstName) {
      guardianData.push({
        relationship: "MOTHER",
        lastName: body.mother.maidenName,
        firstName: body.mother.firstName,
        middleName: body.mother.middleName || null,
        contactNumber:
          body.mother.contactNumber ||
          (primaryContactV2 === "MOTHER" ? body.contactNumber : null),
        email:
          body.mother.email ||
          (primaryContactV2 === "MOTHER" ? body.email : null),
        occupation: body.mother.occupation || null,
      });
    }
    if (body.guardian?.lastName && body.guardian?.firstName) {
      guardianData.push({
        relationship: "GUARDIAN",
        lastName: body.guardian.lastName,
        firstName: body.guardian.firstName,
        middleName: body.guardian.middleName || null,
        contactNumber:
          body.guardian.contactNumber ||
          (primaryContactV2 === "GUARDIAN" ? body.contactNumber : null),
        email:
          body.guardian.email ||
          (primaryContactV2 === "GUARDIAN" ? body.email : null),
        occupation: body.guardian.occupation || null,
      });
    }

    // 4.5 Build address data
    const addressData: Prisma.ApplicationAddressCreateManyInput[] = [];
    if (body.barangay || body.cityMunicipality) {
      addressData.push({
        addressType: "CURRENT",
        houseNoStreet: body.houseNoStreet || null,
        sitio: body.sitio || null,
        barangay: body.barangay || null,
        cityMunicipality: body.cityMunicipality || null,
        province: body.province || null,
      });
    }

    // 5. Create/reuse learner + guardians + registration in a transaction
    const learnerPayload = {
      lrn,
      isPendingLrnCreation,
      psaBirthCertNumber: body.psaBirthCertNumber || null,
      firstName: body.firstName,
      lastName: body.lastName,
      middleName: body.middleName || null,
      extensionName: body.extensionName || null,
      birthdate: birthDate,
      sex: body.sex === "MALE" ? ("MALE" as const) : ("FEMALE" as const),
      placeOfBirth: body.placeOfBirth || null,
      religion: body.religion || null,
      isIpCommunity: body.isIpCommunity ?? false,
      ipGroupName: body.isIpCommunity ? body.ipGroupName : null,
      isLearnerWithDisability: body.isLearnerWithDisability ?? false,
      disabilityTypes: body.isLearnerWithDisability
        ? body.disabilityTypes || []
        : [],
      specialNeedsCategory: body.specialNeedsCategory || null,
      hasPwdId: body.hasPwdId ?? false,
      isBalikAral: body.isBalikAral ?? false,
      lastYearEnrolled: body.lastYearEnrolled || null,
      lastGradeLevel: body.lastGradeLevel || null,
    };

    const studentPhotoUrl = await saveBase64Image(body.studentPhoto, "photo");

    const result = await prisma.$transaction(async (tx) => {
      let learner: { id: number };

      if (lrn) {
        const existingLearner = await tx.learner.findUnique({
          where: { lrn },
          select: { id: true },
        });

        if (existingLearner) {
          learner = await tx.learner.update({
            where: { id: existingLearner.id },
            data: learnerPayload,
            select: { id: true },
          });
        } else {
          learner = await tx.learner.create({
            data: learnerPayload,
            select: { id: true },
          });
        }
      } else {
        learner = await tx.learner.create({
          data: learnerPayload,
          select: { id: true },
        });
      }

      // Temporary tracking number
      const tempTracking = `EREG-${new Date().getFullYear()}-TEMP-${Date.now()}`;

      const application = await tx.earlyRegistrationApplication.create({
        data: {
          learnerId: learner.id,
          schoolYearId: activeYear.id,
          gradeLevelId: gradeLevelV2.id,
          applicantType,
          learnerType: learnerTypeV2,
          status: "SUBMITTED",
          channel: options.channel,
          contactNumber: body.contactNumber,
          email: body.email || null,
          primaryContact: primaryContactV2,
          guardianRelationship: body.guardianRelationship || null,
          hasNoMother: body.hasNoMother ?? false,
          hasNoFather: body.hasNoFather ?? false,
          isPrivacyConsentGiven: body.isPrivacyConsentGiven ?? false,
          studentPhoto: studentPhotoUrl,
          encodedById: options.encodedById ?? null,
          trackingNumber: tempTracking,
          familyMembers: {
            createMany: { data: guardianData },
          },
          addresses:
            addressData.length > 0
              ? {
                  createMany: { data: addressData },
                }
              : undefined,
          checklist: { create: {} },
        },
        select: { id: true, applicantType: true },
      });

      // Update with final tracking number
      let prefix = "REG";
      if (application.applicantType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") {
        prefix = "STE";
      } else if (application.applicantType === "SPECIAL_PROGRAM_IN_THE_ARTS") {
        prefix = "SPA";
      } else if (application.applicantType === "SPECIAL_PROGRAM_IN_SPORTS") {
        prefix = "SPS";
      } else if (
        application.applicantType === "SPECIAL_PROGRAM_IN_JOURNALISM"
      ) {
        prefix = "SPJ";
      } else if (
        application.applicantType === "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE"
      ) {
        prefix = "SPFL";
      } else if (
        application.applicantType ===
        "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION"
      ) {
        prefix = "SPTVE";
      }

      const trackingNumber = `${prefix}-${new Date().getFullYear()}-${String(application.id).padStart(5, "0")}`;
      await tx.earlyRegistrationApplication.update({
        where: { id: application.id },
        data: { trackingNumber },
      });

      return { learner, application, trackingNumber };
    });

    // 6. Audit log (non-blocking)
    auditLog({
      userId: options.encodedById ?? null,
      actionType: "EARLY_REGISTRATION_SUBMITTED",
      description: `Early registration submitted for ${body.lastName}, ${body.firstName} — Grade ${body.gradeLevel} (${options.channel}). Tracking: ${result.trackingNumber}.${lrn ? ` LRN: ${lrn}.` : isPendingLrnCreation ? " Tagged as PENDING LRN CREATION." : ""}`,
      subjectType: "EarlyRegistrationApplication",
      recordId: result.application.id,
      req,
    }).catch(() => {});

    res.status(201).json({
      id: result.application.id,
      trackingNumber: result.trackingNumber,
      learnerId: result.learner.id,
      gradeLevel: body.gradeLevel,
      applicantType,
      learnerName: `${body.lastName}, ${body.firstName}`,
      age,
      message: "Your early registration has been submitted successfully.",
    });
  } catch (err) {
    console.error("[createRegistration Error]", err);
    const mappedDuplicateError = mapCreateRegistrationDuplicateError(err);
    next(mappedDuplicateError ?? err);
  }
}

/** GET /check-lrn/:lrn — Check if LRN already exists for active school year */
export async function checkLrn(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const lrn = String(req.params.lrn || "").trim();
    if (!lrn || lrn.length !== 12) {
      throw new AppError(400, "Enter a valid 12-digit LRN.");
    }

    const settings = await prisma.schoolSetting.findFirst({
      include: { activeSchoolYear: true },
    });

    if (!settings?.activeSchoolYear) {
      throw new AppError(
        400,
        "No active School Year is set. Please contact the school registrar.",
      );
    }

    const activeYear = settings.activeSchoolYear;

    // Check early registrations
    const existingEarlyReg = await prisma.learner.findFirst({
      where: {
        lrn,
        earlyRegistrationApplications: {
          some: { schoolYearId: activeYear.id },
        },
      },
      select: { id: true },
    });

    if (existingEarlyReg) {
      return res.json({
        exists: true,
        type: "EARLY_REGISTRATION",
        message: `A registration with LRN ${lrn} already exists for this School Year.`,
      });
    }

    // Check enrollment applications
    const existingEnrollmentApp = await prisma.enrollmentApplication.findFirst({
      where: { learner: { lrn }, schoolYearId: activeYear.id },
      select: { id: true },
    });

    if (existingEnrollmentApp) {
      return res.json({
        exists: true,
        type: "ENROLLMENT",
        message: `An enrollment application with LRN ${lrn} already exists for this School Year.`,
      });
    }

    res.json({ exists: false });
  } catch (err) {
    next(err);
  }
}

// ── Public Handlers ──

/** POST / — Public early registration submission */
export async function store(req: Request, res: Response, next: NextFunction) {
  return createRegistration(req, res, next, { channel: "ONLINE" });
}

/** POST /f2f — Registrar-encoded early registration */
export async function storeF2F(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  return createRegistration(req, res, next, {
    channel: "F2F",
    encodedById: req.user?.userId,
  });
}

/** GET / — List early registrations for active/specified school year */
export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit)) || 20),
    );
    const search = (req.query.search as string)?.trim() || "";
    const status = (req.query.status as string) || "";
    const gradeLevel = (req.query.gradeLevel as string) || "";
    const applicantType = (req.query.applicantType as string) || "";
    const withoutLrn = isTruthyQuery(req.query.withoutLrn);

    // Resolve school year
    let schoolYearId: number | undefined;
    if (req.query.schoolYearId) {
      schoolYearId = parseInt(String(req.query.schoolYearId));
    } else {
      const settings = await prisma.schoolSetting.findFirst();
      schoolYearId = settings?.activeSchoolYearId ?? undefined;
    }

    if (!schoolYearId) {
      throw new AppError(400, "No school year specified or active.");
    }
    const resolvedSchoolYearId = schoolYearId;

    const where: any = {
      schoolYearId: resolvedSchoolYearId,
    };
    const andFilters: any[] = [];

    if (status) {
      const normalizedStatus = status.trim().toUpperCase();
      if (normalizedStatus !== "ALL") {
        if (!(normalizedStatus in EARLY_REG_TRANSITIONS)) {
          throw new AppError(400, "Invalid status filter.");
        }
        andFilters.push({ status: normalizedStatus });
      }
    }

    if (applicantType) {
      const normalizedApplicantType = applicantType.trim().toUpperCase();
      if (normalizedApplicantType !== "ALL") {
        if (!APPLICANT_TYPE_VALUES.has(normalizedApplicantType)) {
          throw new AppError(400, "Invalid applicant type filter.");
        }
        andFilters.push({ applicantType: normalizedApplicantType });
      }
    }

    if (gradeLevel) {
      const normalizedGradeLevel = normalizeGradeLevelToken(gradeLevel);
      const matchingGradeLevels = await prisma.gradeLevel.findMany({
        where: {
          schoolYearId: resolvedSchoolYearId,
          OR: [
            { name: { equals: normalizedGradeLevel, mode: "insensitive" } },
            {
              name: {
                equals: `GRADE ${normalizedGradeLevel}`,
                mode: "insensitive",
              },
            },
            {
              name: { equals: `G${normalizedGradeLevel}`, mode: "insensitive" },
            },
          ],
        },
        select: { id: true },
      });

      if (matchingGradeLevels.length > 0) {
        andFilters.push({
          gradeLevelId: { in: matchingGradeLevels.map((g) => g.id) },
        });
      }
    }

    if (withoutLrn) {
      andFilters.push({ learner: { isPendingLrnCreation: true } });
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    if (search) {
      where.learner = {
        OR: [
          { lastName: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lrn: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const [registrations, total] = await Promise.all([
      prisma.earlyRegistrationApplication.findMany({
        where: where,
        include: {
          learner: true,
          familyMembers: true,
          addresses: true,
          gradeLevel: { select: { id: true, name: true } },
          schoolYear: { select: { yearLabel: true } },
          encodedBy: { select: { firstName: true, lastName: true } },
          verifiedBy: { select: { firstName: true, lastName: true } },
          assessments: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { submittedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.earlyRegistrationApplication.count({ where: where }),
    ]);

    res.json({
      data: registrations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/checklist — Update requirement checklist for an early registration */
export async function updateChecklist(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    await findEarlyRegOrThrow(id);

    const allowedFields = [
      "isPsaBirthCertPresented",
      "isOriginalPsaBcCollected",
      "isSf9Submitted",
      "isSf10Requested",
      "isGoodMoralPresented",
      "isMedicalEvalSubmitted",
      "isCertOfRecognitionPresented",
      "isUndertakingSigned",
      "isConfirmationSlipReceived",
    ] as const;

    const payload = req.body as Record<string, unknown>;
    const filteredData: Partial<
      Record<(typeof allowedFields)[number], boolean>
    > = {};
    for (const key of allowedFields) {
      if (payload[key] !== undefined) {
        filteredData[key] = Boolean(payload[key]);
      }
    }

    const currentChecklist = await prisma.applicationChecklist.findUnique({
      where: { earlyRegistrationId: id },
    });

    const updated = await prisma.applicationChecklist.upsert({
      where: { earlyRegistrationId: id },
      update: { ...filteredData, updatedById: req.user!.userId },
      create: {
        ...filteredData,
        earlyRegistrationId: id,
        updatedById: req.user!.userId,
      },
    });

    const fieldsToLabel: Partial<
      Record<(typeof allowedFields)[number], string>
    > = {
      isPsaBirthCertPresented: "PSA Birth Certificate",
      isSf9Submitted: "SF9 / Report Card",
      isConfirmationSlipReceived: "Confirmation Slip",
      isSf10Requested: "SF10 (Permanent Record)",
      isGoodMoralPresented: "Good Moral Certificate",
      isMedicalEvalSubmitted: "Medical Evaluation",
      isCertOfRecognitionPresented: "Certificate of Recognition",
      isUndertakingSigned: "Affidavit of Undertaking",
    };

    for (const [key, label] of Object.entries(fieldsToLabel)) {
      const typedKey = key as (typeof allowedFields)[number];
      const newValue = filteredData[typedKey];
      const oldValue = currentChecklist ? currentChecklist[typedKey] : false;
      if (newValue !== undefined && newValue !== oldValue) {
        await auditLog({
          userId: req.user!.userId,
          actionType: newValue ? "DOCUMENT_ADDED" : "DOCUMENT_REMOVED",
          description: `${newValue ? "Added" : "Removed"} requirement: ${label} for early registration #${id}`,
          subjectType: "EarlyRegistrationApplication",
          recordId: id,
          req,
        }).catch(() => {});
      }
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "CHECKLIST_UPDATED",
      description: `Updated requirement checklist for early registration #${id}`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** POST /:id/documents — Mark a document as presented for an early registration */
export async function uploadDocument(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    const documentType = String(req.body?.documentType ?? "")
      .trim()
      .toUpperCase();

    if (!documentType) {
      throw new AppError(400, "documentType is required");
    }

    if (!req.file) {
      throw new AppError(400, "No file uploaded");
    }

    const checklistField = DOCUMENT_CHECKLIST_MAPPING[documentType];
    if (!checklistField) {
      throw new AppError(400, "Invalid document type for checklist");
    }

    const registration = await findEarlyRegOrThrow(id);

    await prisma.applicationChecklist.upsert({
      where: { earlyRegistrationId: id },
      update: {
        [checklistField]: true,
        updatedById: req.user!.userId,
      },
      create: {
        earlyRegistrationId: id,
        [checklistField]: true,
        updatedById: req.user!.userId,
      },
    });

    try {
      fs.unlinkSync(req.file.path);
    } catch {
      // Non-fatal cleanup best-effort
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "CHECKLIST_UPDATED",
      description: `Marked ${documentType} as presented for ${registration.learner.firstName} ${registration.learner.lastName} (#${id})`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.status(200).json({ message: "Checklist updated successfully" });
  } catch (err) {
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // ignore cleanup failures
      }
    }
    next(err);
  }
}

/** DELETE /:id/documents — Unmark a document for an early registration */
export async function removeDocument(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    const documentType = String(req.body?.documentType ?? "")
      .trim()
      .toUpperCase();

    if (!documentType) {
      throw new AppError(400, "documentType is required");
    }

    const checklistField = DOCUMENT_CHECKLIST_MAPPING[documentType];
    if (!checklistField) {
      throw new AppError(400, "Invalid document type for checklist");
    }

    const registration = await findEarlyRegOrThrow(id);

    await prisma.applicationChecklist.updateMany({
      where: { earlyRegistrationId: id },
      data: {
        [checklistField]: false,
        updatedById: req.user!.userId,
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "CHECKLIST_REMOVED",
      description: `Unmarked ${documentType} for ${registration.learner.firstName} ${registration.learner.lastName} (#${id})`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json({ message: "Checklist updated successfully" });
  } catch (err) {
    next(err);
  }
}

/** GET /:id — Get a single early registration detail */
export async function show(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id));
    const detailed = await sharedService.getDetailedApplicationOrThrow(id, {
      allowEnrollmentFallback: false,
    });
    res.json(detailed);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/verify — Registrar marks a registration as verified */
export async function verify(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id));
    const registration = await prisma.earlyRegistrationApplication.findUnique({
      where: { id },
    });

    if (!registration) {
      throw new AppError(404, "Early registration not found.");
    }

    if (registration.status !== "SUBMITTED") {
      throw new AppError(
        422,
        `Cannot verify a registration with status "${registration.status}".`,
      );
    }

    const updated = await prisma.earlyRegistrationApplication.update({
      where: { id },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
        verifiedById: req.user!.userId,
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REGISTRATION_VERIFIED",
      description: `Early registration #${id} verified.`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════
// EARLY REGISTRATION LIFECYCLE (Admin status transitions)
// ═══════════════════════════════════════════════════════════

const EARLY_REG_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  SUBMITTED: [
    "VERIFIED",
    "UNDER_REVIEW",
    "ASSESSMENT_SCHEDULED",
    "REJECTED",
    "WITHDRAWN",
  ],
  VERIFIED: [
    "UNDER_REVIEW",
    "ELIGIBLE",
    "ASSESSMENT_SCHEDULED",
    "REJECTED",
    "WITHDRAWN",
  ],
  UNDER_REVIEW: [
    "FOR_REVISION",
    "ELIGIBLE",
    "ASSESSMENT_SCHEDULED",
    "REJECTED",
    "WITHDRAWN",
  ],
  FOR_REVISION: ["UNDER_REVIEW", "WITHDRAWN"],
  ELIGIBLE: ["ASSESSMENT_SCHEDULED", "PASSED", "WITHDRAWN"],
  ASSESSMENT_SCHEDULED: [
    "ASSESSMENT_TAKEN",
    "ASSESSMENT_SCHEDULED",
    "INTERVIEW_SCHEDULED",
    "WITHDRAWN",
  ],
  ASSESSMENT_TAKEN: [
    "PASSED",
    "NOT_QUALIFIED",
    "ASSESSMENT_TAKEN",
    "ASSESSMENT_SCHEDULED",
    "WITHDRAWN",
  ],
  PASSED: [
    "PRE_REGISTERED",
    "INTERVIEW_SCHEDULED",
    "ASSESSMENT_SCHEDULED",
    "WITHDRAWN",
  ],
  INTERVIEW_SCHEDULED: [
    "PASSED",
    "PRE_REGISTERED",
    "NOT_QUALIFIED",
    "WITHDRAWN",
  ],
  PRE_REGISTERED: ["ENROLLED", "TEMPORARILY_ENROLLED", "WITHDRAWN"],
  TEMPORARILY_ENROLLED: ["ENROLLED", "WITHDRAWN"],
  ENROLLED: ["WITHDRAWN"],
  NOT_QUALIFIED: ["UNDER_REVIEW", "WITHDRAWN", "REJECTED"],
  REJECTED: ["UNDER_REVIEW", "WITHDRAWN"],
  WITHDRAWN: [],
};

function assertEarlyRegTransition(
  current: ApplicationStatus,
  target: ApplicationStatus,
  contextMessage?: string,
): void {
  if (!(EARLY_REG_TRANSITIONS[current]?.includes(target) ?? false)) {
    throw new AppError(
      422,
      contextMessage ?? `Cannot transition from "${current}" to "${target}".`,
    );
  }
}

async function findEarlyRegOrThrow(id: number) {
  const reg = await prisma.earlyRegistrationApplication.findUnique({
    where: { id },
    include: {
      learner: true,
      gradeLevel: true,
      assessments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!reg) throw new AppError(404, "Early registration application not found");
  return reg;
}

/** PATCH /:id/reject — Reject an early registration */
export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);
    const { reason } = req.body;

    assertEarlyRegTransition(
      reg.status,
      "REJECTED",
      `Cannot reject. Current status: "${reg.status}".`,
    );

    const updated = await prisma.earlyRegistrationApplication.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REGISTRATION_REJECTED",
      description: `Early registration #${id} rejected. Reason: ${reason || "N/A"}`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/withdraw — Withdraw an early registration */
export async function withdraw(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);

    assertEarlyRegTransition(
      reg.status,
      "WITHDRAWN",
      `Cannot withdraw. Current status: "${reg.status}".`,
    );

    const updated = await prisma.earlyRegistrationApplication.update({
      where: { id },
      data: { status: "WITHDRAWN" },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REGISTRATION_WITHDRAWN",
      description: `Early registration #${id} withdrawn.`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/mark-eligible — Mark early registration as eligible for assessment */
export async function markEligible(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);

    assertEarlyRegTransition(
      reg.status,
      "ELIGIBLE",
      `Cannot mark as eligible. Current status: "${reg.status}".`,
    );

    const updated = await prisma.earlyRegistrationApplication.update({
      where: { id },
      data: { status: "ELIGIBLE" },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REGISTRATION_ELIGIBLE",
      description: `Early registration #${id} marked as ELIGIBLE.`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/schedule-assessment — Schedule an assessment step */
export async function scheduleAssessment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { stepOrder, kind, scheduledDate, scheduledTime, venue, notes } =
      req.body;
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);

    const targetStatus: ApplicationStatus =
      kind === "INTERVIEW" ? "INTERVIEW_SCHEDULED" : "ASSESSMENT_SCHEDULED";

    assertEarlyRegTransition(
      reg.status,
      targetStatus,
      `Cannot schedule assessment. Current status: "${reg.status}".`,
    );

    // Fetch pipeline step config for defaults
    const scpConfig = await prisma.scpProgramConfig.findUnique({
      where: {
        uq_scp_program_configs_type: {
          schoolYearId: reg.schoolYearId,
          scpType: reg.applicantType as any,
        },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    const stepConfig = scpConfig?.steps.find((s) => s.stepOrder === stepOrder);

    const existingAssessments = scpConfig
      ? await prisma.earlyRegistrationAssessment.findMany({
          where: { applicationId: id },
        })
      : [];

    const requiredNonInterviewSteps = (scpConfig?.steps ?? []).filter(
      (step) => step.isRequired && step.kind !== "INTERVIEW",
    );
    const hasFailedRequiredStep = requiredNonInterviewSteps.some((step) =>
      existingAssessments.some(
        (assessment) =>
          assessment.type === step.kind && assessment.result === "FAILED",
      ),
    );

    if (hasFailedRequiredStep) {
      throw new AppError(
        422,
        "Cannot schedule additional assessments or interviews after a failed cut-off result. Mark the learner as FAILED.",
      );
    }

    // Prerequisite gating
    if (scpConfig && stepOrder > 1) {
      const previousRequired = scpConfig.steps.filter(
        (s) => s.stepOrder < stepOrder && s.isRequired,
      );
      if (previousRequired.length > 0) {
        const unmet = previousRequired.filter(
          (prev) =>
            !existingAssessments.some(
              (a) => a.type === prev.kind && a.result === "PASSED",
            ),
        );
        if (unmet.length > 0) {
          throw new AppError(
            400,
            `Cannot schedule step ${stepOrder}: prerequisite step(s) not passed — ${unmet.map((s) => s.label).join(", ")}.`,
          );
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.earlyRegistrationAssessment.create({
        data: {
          applicationId: id,
          type: kind as any,
          scheduledDate: normalizeDateToUtcNoon(new Date(scheduledDate)),
          scheduledTime: scheduledTime || stepConfig?.scheduledTime || null,
          venue: venue || stepConfig?.venue || null,
          notes: notes || stepConfig?.notes || null,
        },
      });

      return tx.earlyRegistrationApplication.update({
        where: { id },
        data: { status: targetStatus },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType:
        kind === "INTERVIEW"
          ? "INTERVIEW_SCHEDULED"
          : "ASSESSMENT_STEP_SCHEDULED",
      description: `Scheduled ${stepConfig?.label || kind} for early reg #${id} on ${scheduledDate}`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/record-step-result — Record assessment result */
export async function recordStepResult(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { stepOrder, kind, score, result, notes } = req.body;
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);

    const normalizedStepOrder = Number(stepOrder);
    if (!Number.isInteger(normalizedStepOrder) || normalizedStepOrder <= 0) {
      throw new AppError(400, "stepOrder must be a positive integer.");
    }

    assertEarlyRegTransition(
      reg.status,
      "ASSESSMENT_TAKEN",
      `Cannot record result. Current status: "${reg.status}".`,
    );

    // Load pipeline config
    const scpConfig = await prisma.scpProgramConfig.findUnique({
      where: {
        uq_scp_program_configs_type: {
          schoolYearId: reg.schoolYearId,
          scpType: reg.applicantType as any,
        },
      },
      include: {
        steps: { where: { isRequired: true }, orderBy: { stepOrder: "asc" } },
      },
    });

    const normalizedKind =
      typeof kind === "string" && kind.trim().length > 0
        ? kind.trim().toUpperCase()
        : null;
    const stepConfig = scpConfig?.steps.find(
      (s) => s.stepOrder === normalizedStepOrder,
    );

    const fallbackAssessment = !normalizedKind
      ? await prisma.earlyRegistrationAssessment.findFirst({
          where: { applicationId: id },
          orderBy: { createdAt: "desc" },
        })
      : null;

    const resolvedKind =
      normalizedKind ?? stepConfig?.kind ?? fallbackAssessment?.type ?? null;

    if (!resolvedKind) {
      throw new AppError(
        400,
        `Unable to determine assessment kind for step ${normalizedStepOrder}.`,
      );
    }

    const assessment = await prisma.earlyRegistrationAssessment.findFirst({
      where: { applicationId: id, type: resolvedKind as any },
      orderBy: { createdAt: "desc" },
    });

    if (!assessment) {
      throw new AppError(
        404,
        `No scheduled assessment found for step ${normalizedStepOrder} (${resolvedKind}). Schedule it first.`,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      let finalResult = result ?? null;
      if (stepConfig?.cutoffScore != null && score != null) {
        finalResult = score >= stepConfig.cutoffScore ? "PASSED" : "FAILED";
      }

      await tx.earlyRegistrationAssessment.update({
        where: { id: assessment.id },
        data: {
          score: score ?? null,
          result: finalResult,
          notes: notes ?? null,
          conductedAt: new Date(),
        },
      });

      // Check if all required non-interview steps have results
      const allAssessments = await tx.earlyRegistrationAssessment.findMany({
        where: { applicationId: id },
      });

      const requiredSteps = scpConfig?.steps ?? [];
      const requiredNonInterview = requiredSteps.filter(
        (step) => step.kind !== "INTERVIEW",
      );
      const hasFailedRequired = requiredNonInterview.some((step) =>
        allAssessments.some(
          (a) => a.type === step.kind && a.result === "FAILED",
        ),
      );
      const allDone = requiredNonInterview.every((step) =>
        allAssessments.some(
          (a) =>
            a.type === step.kind &&
            (a.conductedAt != null || a.result != null || a.score != null),
        ),
      );

      const newStatus: ApplicationStatus =
        hasFailedRequired || allDone
          ? "ASSESSMENT_TAKEN"
          : "ASSESSMENT_SCHEDULED";

      return tx.earlyRegistrationApplication.update({
        where: { id },
        data: { status: newStatus },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "ASSESSMENT_RESULT_RECORDED",
      description: `Recorded result for early reg #${id} step ${normalizedStepOrder}: score=${score ?? "N/A"}, result=${result ?? "auto"}`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/pass — Mark early registration as passed */
export async function pass(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);

    assertEarlyRegTransition(
      reg.status,
      "PASSED",
      `Cannot mark as passed. Current status: "${reg.status}".`,
    );

    const updated = await prisma.earlyRegistrationApplication.update({
      where: { id },
      data: { status: "PASSED" },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REGISTRATION_PASSED",
      description: `Early registration #${id} marked PASSED.`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/fail — Mark early registration as not qualified */
export async function fail(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id));
    const { examNotes } = (req.body ?? {}) as { examNotes?: string };
    const reg = await findEarlyRegOrThrow(id);

    assertEarlyRegTransition(
      reg.status,
      "NOT_QUALIFIED",
      `Cannot mark as not qualified. Current status: "${reg.status}".`,
    );

    const updated = await prisma.$transaction(async (tx) => {
      if (examNotes) {
        const latestAssessment = await tx.earlyRegistrationAssessment.findFirst(
          {
            where: { applicationId: id },
            orderBy: { createdAt: "desc" },
          },
        );
        if (latestAssessment) {
          await tx.earlyRegistrationAssessment.update({
            where: { id: latestAssessment.id },
            data: { notes: examNotes },
          });
        }
      }
      return tx.earlyRegistrationApplication.update({
        where: { id },
        data: {
          status: "NOT_QUALIFIED",
          applicantType: "REGULAR",
        },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REGISTRATION_FAILED",
      description: `Early registration #${id} marked NOT_QUALIFIED. Notes: ${examNotes || "N/A"}`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** PATCH /batch-process — Batch status transitions for early registrations */
export async function batchProcess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { ids, targetStatus } = req.body as {
      ids: number[];
      targetStatus: ApplicationStatus;
    };

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError(400, "No application IDs provided.");
    }

    const applications = await prisma.earlyRegistrationApplication.findMany({
      where: { id: { in: ids } },
      include: { learner: true },
    });

    const succeeded: { id: number; name: string; trackingNumber: string }[] =
      [];
    const failed: {
      id: number;
      name: string;
      trackingNumber: string;
      reason: string;
    }[] = [];

    for (const app of applications) {
      const name = `${app.learner.lastName}, ${app.learner.firstName}`;
      const allowed = EARLY_REG_TRANSITIONS[app.status] ?? [];
      if (!allowed.includes(targetStatus)) {
        failed.push({
          id: app.id,
          name,
          trackingNumber: app.trackingNumber,
          reason: `Cannot move from "${app.status}" to "${targetStatus}".`,
        });
        continue;
      }

      try {
        await prisma.earlyRegistrationApplication.update({
          where: { id: app.id },
          data: { status: targetStatus },
        });
        succeeded.push({
          id: app.id,
          name,
          trackingNumber: app.trackingNumber,
        });
      } catch {
        failed.push({
          id: app.id,
          name,
          trackingNumber: app.trackingNumber,
          reason: "Database update error.",
        });
      }
    }

    // Mark IDs not found as failed
    const foundIds = new Set(applications.map((a) => a.id));
    for (const id of ids) {
      if (!foundIds.has(id)) {
        failed.push({
          id,
          name: "Unknown",
          trackingNumber: "N/A",
          reason: "Application not found.",
        });
      }
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REG_BATCH_PROCESS",
      description: `Batch processed ${succeeded.length} early registrations to ${targetStatus}. ${failed.length} failed.`,
      subjectType: "EarlyRegistrationApplication",
      recordId: null,
      req,
    }).catch(() => {});

    res.json({ succeeded, failed });
  } catch (err) {
    next(err);
  }
}

/** GET /:id/detailed — Get early registration with full assessment/pipeline data */
export async function showDetailed(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    const detailed = await sharedService.getDetailedApplicationOrThrow(id, {
      includeAuditLogs: true,
      allowEnrollmentFallback: false,
    });
    res.json(detailed);
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════
// APPROVE (Pre-register) – promotes early-reg to enrollment
// ═══════════════════════════════════════════════════════════

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id));
    const { sectionId } = req.body;
    const reg = await findEarlyRegOrThrow(id);

    assertEarlyRegTransition(
      reg.status,
      ApplicationStatus.PRE_REGISTERED,
      `Cannot approve an early registration with status "${reg.status}". Only PASSED or INTERVIEW_SCHEDULED applications can be approved.`,
    );

    const result = await prisma.$transaction(async (tx) => {
      // Check section capacity
      const [section] = await tx.$queryRaw<
        { id: number; maxCapacity: number }[]
      >`SELECT id, "max_capacity" as "maxCapacity" FROM "sections" WHERE id = ${sectionId} FOR UPDATE`;

      if (!section) throw new AppError(404, "Section not found");

      const enrolledCount = await tx.enrollmentRecord.count({
        where: { sectionId },
      });
      if (enrolledCount >= section.maxCapacity) {
        throw new AppError(422, "This section has reached maximum capacity");
      }

      // Create EnrollmentApplication linked to early-reg
      const enrollmentApp = await tx.enrollmentApplication.create({
        data: {
          learnerId: reg.learnerId,
          earlyRegistrationId: reg.id,
          schoolYearId: reg.schoolYearId,
          gradeLevelId: reg.gradeLevelId,
          applicantType: reg.applicantType,
          learnerType: reg.learnerType,
          status: "PRE_REGISTERED",
          admissionChannel: reg.channel,
          isPrivacyConsentGiven: reg.isPrivacyConsentGiven,
          encodedById: req.user!.userId,
        },
      });

      // Link existing checklist to the new enrollment application
      const existingChecklist = await tx.applicationChecklist.findUnique({
        where: { earlyRegistrationId: reg.id },
      });

      if (existingChecklist) {
        await tx.applicationChecklist.update({
          where: { id: existingChecklist.id },
          data: { enrollmentId: enrollmentApp.id },
        });
      } else {
        // Create new checklist linked to both
        await tx.applicationChecklist.create({
          data: {
            enrollmentId: enrollmentApp.id,
            earlyRegistrationId: reg.id,
          },
        });
      }

      // Create enrollment record
      const enrollment = await tx.enrollmentRecord.create({
        data: {
          enrollmentApplicationId: enrollmentApp.id,
          sectionId,
          schoolYearId: reg.schoolYearId,
          enrolledById: req.user!.userId,
        },
      });

      // Update early-reg status
      await tx.earlyRegistrationApplication.update({
        where: { id },
        data: { status: "PRE_REGISTERED" },
      });

      return enrollment;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_APPROVED",
      description: `Approved early registration #${id} for ${reg.learner.firstName} ${reg.learner.lastName} and pre-registered to section ${sectionId}`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/temporarily-enroll */
export async function temporarilyEnroll(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);
    const learnerPendingLrn =
      (reg.learner as { isPendingLrnCreation?: boolean })
        .isPendingLrnCreation === true;

    const checklist = await prisma.applicationChecklist.findUnique({
      where: { earlyRegistrationId: id },
      select: { isPsaBirthCertPresented: true },
    });

    if (learnerPendingLrn && !checklist?.isPsaBirthCertPresented) {
      throw new AppError(
        422,
        "PSA Birth Certificate is required before temporary enrollment for learners without LRN.",
      );
    }

    assertEarlyRegTransition(
      reg.status,
      ApplicationStatus.TEMPORARILY_ENROLLED,
    );

    const updated = await prisma.$transaction(async (tx) => {
      const earlyRegUpdated = await tx.earlyRegistrationApplication.update({
        where: { id },
        data: { status: "TEMPORARILY_ENROLLED" },
      });

      const enrollmentApp = await tx.enrollmentApplication.findFirst({
        where: { earlyRegistrationId: id },
        orderBy: { createdAt: "desc" },
      });

      if (enrollmentApp) {
        await tx.enrollmentApplication.update({
          where: { id: enrollmentApp.id },
          data: {
            status: "TEMPORARILY_ENROLLED",
            isTemporarilyEnrolled: true,
          },
        });
      }

      return earlyRegUpdated;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "STATUS_CHANGE",
      description: `Early registration #${id} marked as temporarily enrolled`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/enroll */
export async function enroll(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);
    const learnerPendingLrn =
      (reg.learner as { isPendingLrnCreation?: boolean })
        .isPendingLrnCreation === true;

    assertEarlyRegTransition(reg.status, ApplicationStatus.ENROLLED);

    if (learnerPendingLrn) {
      throw new AppError(
        422,
        "Cannot finalize enrollment while learner is tagged as pending LRN creation.",
      );
    }

    const checklist = await prisma.applicationChecklist.findUnique({
      where: { earlyRegistrationId: id },
    });

    if (!checklist) {
      throw new AppError(
        422,
        "Requirement checklist not found for this applicant.",
      );
    }

    const requirements = getRequiredDocuments({
      learnerType: reg.learnerType,
      gradeLevel: reg.gradeLevel.name,
      applicantType: reg.applicantType,
      isLwd: reg.learner.isLearnerWithDisability,
      isPeptAePasser: false,
    });

    const missingMandatory: string[] = [];
    for (const requirement of requirements) {
      if (!requirement.isRequired) continue;

      let isMet = false;
      switch (requirement.type) {
        case "BEEF":
          isMet = true;
          break;
        case "CONFIRMATION_SLIP":
          isMet = checklist.isConfirmationSlipReceived;
          break;
        case "PSA_BIRTH_CERTIFICATE":
          isMet = checklist.isPsaBirthCertPresented;
          break;
        case "SF9_REPORT_CARD":
        case "ACADEMIC_RECORD":
          isMet = checklist.isSf9Submitted;
          break;
        case "GOOD_MORAL_CERTIFICATE":
          isMet = checklist.isGoodMoralPresented;
          break;
        case "MEDICAL_CERTIFICATE":
        case "MEDICAL_EVALUATION":
          isMet = checklist.isMedicalEvalSubmitted;
          break;
        case "CERTIFICATE_OF_RECOGNITION":
          isMet = checklist.isCertOfRecognitionPresented;
          break;
        case "AFFIDAVIT_OF_UNDERTAKING":
          isMet = checklist.isUndertakingSigned;
          break;
        default:
          isMet = true;
      }

      if (!isMet) {
        missingMandatory.push(requirement.label);
      }
    }

    if (missingMandatory.length > 0) {
      throw new AppError(
        422,
        `Cannot finalize enrollment; missing requirements: ${missingMandatory.join(", ")}`,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const earlyRegUpdated = await tx.earlyRegistrationApplication.update({
        where: { id },
        data: { status: "ENROLLED" },
      });

      const enrollmentApp = await tx.enrollmentApplication.findFirst({
        where: { earlyRegistrationId: id },
        orderBy: { createdAt: "desc" },
      });

      if (enrollmentApp) {
        await tx.enrollmentApplication.update({
          where: { id: enrollmentApp.id },
          data: {
            status: "ENROLLED",
            isTemporarilyEnrolled: false,
          },
        });
      }

      await tx.learner.update({
        where: { id: reg.learnerId },
        data: { isPendingLrnCreation: false },
      });

      return earlyRegUpdated;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "STATUS_CHANGE",
      description: `Early registration #${id} finalized as ENROLLED`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/assign-lrn */
export async function assignLrn(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);
    const lrn = String(req.body?.lrn ?? "").trim();

    if (!LRN_REGEX.test(lrn)) {
      throw new AppError(422, "LRN must be exactly 12 digits.");
    }

    try {
      await prisma.learner.update({
        where: { id: reg.learnerId },
        data: {
          lrn,
          isPendingLrnCreation: false,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError(409, "LRN already exists.");
      }
      throw error;
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "LEARNER_LRN_ASSIGNED",
      description: `Assigned LRN ${lrn} to learner #${reg.learnerId} from early registration #${id}`,
      subjectType: "Learner",
      recordId: reg.learnerId,
      req,
    }).catch(() => {});

    res.json({
      message: "LRN assigned successfully.",
      learnerId: reg.learnerId,
      lrn,
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/mark-interview-passed */
export async function markInterviewPassed(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);

    assertEarlyRegTransition(
      reg.status,
      ApplicationStatus.PRE_REGISTERED,
      `Cannot mark interview passed. Current status: "${reg.status}".`,
    );

    const updated = await prisma.$transaction(async (tx) => {
      const latestInterviewAssessment =
        await tx.earlyRegistrationAssessment.findFirst({
          where: { applicationId: id, type: "INTERVIEW" },
          orderBy: { createdAt: "desc" },
        });

      if (latestInterviewAssessment) {
        await tx.earlyRegistrationAssessment.update({
          where: { id: latestInterviewAssessment.id },
          data: {
            result: "PASSED",
            conductedAt: new Date(),
          },
        });
      } else {
        await tx.earlyRegistrationAssessment.create({
          data: {
            applicationId: id,
            type: "INTERVIEW",
            result: "PASSED",
            conductedAt: new Date(),
          },
        });
      }

      return tx.earlyRegistrationApplication.update({
        where: { id },
        data: { status: "PRE_REGISTERED" },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "STATUS_CHANGE",
      description: `Early registration #${id} marked ready for enrollment (PRE_REGISTERED) after interview pass`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}
