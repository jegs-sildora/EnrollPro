import { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { AppError } from "../../lib/AppError.js";

// ── Helpers ──

/** Recursively converts all string values to uppercase and trims them. */
function toUpperCaseRecursive(obj: unknown): unknown {
  const skipKeys = ["contactNumber", "email", "emailAddress"];

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

/** Normalize a date to noon UTC for consistent date-only storage. */
function normalizeDateToUtcNoon(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(12, 0, 0, 0);
  return d;
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

function toLearnerTypeV2(
  value: unknown,
):
  | "NEW_ENROLLEE"
  | "TRANSFEREE"
  | "RETURNING"
  | "CONTINUING"
  | "OSCYA"
  | "ALS"
  | null {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!LEARNER_TYPE_VALUES.has(raw)) return null;
  return raw as
    | "NEW_ENROLLEE"
    | "TRANSFEREE"
    | "RETURNING"
    | "CONTINUING"
    | "OSCYA"
    | "ALS";
}

function toPrimaryContactV2(
  value: unknown,
): "FATHER" | "MOTHER" | "GUARDIAN" | null {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!PRIMARY_CONTACT_VALUES.has(raw)) return null;
  return raw as "FATHER" | "MOTHER" | "GUARDIAN";
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
    throw new AppError(400, "Invalid SCP type for application type.");
  }

  return rawScpType as ApplicantTypeValue;
}

// ── Shared store logic for both public and F2F ──

interface StoreOptions {
  channel: "ONLINE" | "F2F";
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

  const isLrnDuplicate =
    hasTarget("lrn") || hasTarget("uq_early_registrants_lrn");
  if (isLrnDuplicate) {
    return new AppError(
      409,
      "Mayroon nang learner na may kaparehong LRN. / A learner with this LRN already exists.",
    );
  }

  const hasRegistrantField =
    hasTarget("registrantid") || hasTarget("registrant_id");
  const hasSchoolYearField =
    hasTarget("schoolyearid") || hasTarget("school_year_id");
  const isRegistrantSchoolYearDuplicate =
    hasTarget("uq_early_registrations_per_sy") ||
    (hasRegistrantField && hasSchoolYearField);

  if (isRegistrantSchoolYearDuplicate) {
    return new AppError(
      409,
      "May naunang early registration na para sa learner na ito sa taong panuruan na ito. / An early registration for this learner already exists for this school year.",
    );
  }

  return new AppError(
    409,
    "May duplicate na early registration record. / A duplicate early registration record was detected.",
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
      throw new AppError(400, "No active school year configured.");
    }

    const activeYear = settings.activeSchoolYear;
    const body = toUpperCaseRecursive(req.body) as Record<string, any>;

    const normalizedGradeLevel = normalizeGradeLevelToken(body.gradeLevel);
    const gradeLevelV2 = await prisma.gradeLevel.findFirst({
      where: {
        schoolYearId: activeYear.id,
        OR: [
          { name: normalizedGradeLevel },
          { name: `GRADE ${normalizedGradeLevel}` },
        ],
      },
      select: { id: true },
    });
    const learnerTypeV2 = toLearnerTypeV2(body.learnerType);
    const primaryContactV2 = toPrimaryContactV2(body.primaryContact);
    const applicantType = resolveApplicantType(
      body.isScpApplication,
      body.scpType,
    );

    // 2. Parse and validate birthdate
    const rawBirthDate = new Date(body.birthdate);
    if (isNaN(rawBirthDate.getTime())) {
      throw new AppError(400, "Invalid birthdate format.");
    }
    const birthDate = normalizeDateToUtcNoon(rawBirthDate);
    const age = calculateAge(rawBirthDate);

    // 3. Check duplicate LRN in same School Year (both early reg + applicant tables)
    const lrn: string | null = body.lrn?.trim() || null;
    if (lrn) {
      const existingEarlyReg = await prisma.earlyRegistrant.findFirst({
        where: {
          lrn,
          registrations: {
            some: { schoolYearId: activeYear.id },
          },
        },
        select: { id: true },
      });
      if (existingEarlyReg) {
        throw new AppError(
          409,
          `Mayroon nang naka-register na may LRN ${lrn} para sa taong panuruan na ito. / A registration with LRN ${lrn} already exists for this school year.`,
        );
      }

      const existingApplicant = await prisma.applicant.findFirst({
        where: { lrn, schoolYearId: activeYear.id },
        select: { id: true },
      });
      if (existingApplicant) {
        throw new AppError(
          409,
          `May application na ang LRN ${lrn} para sa taong panuruan na ito. / An application with LRN ${lrn} already exists for this school year.`,
        );
      }
    }

    // 4. Build guardian data
    const guardianData: {
      relationship: string;
      lastName: string;
      firstName: string;
      middleName?: string | null;
      contactNumber?: string | null;
      email?: string | null;
    }[] = [];

    if (body.father?.lastName && body.father?.firstName) {
      guardianData.push({
        relationship: "FATHER",
        lastName: body.father.lastName,
        firstName: body.father.firstName,
        middleName: body.father.middleName || null,
        contactNumber: body.father.contactNumber || null,
        email: body.father.email || null,
      });
    }
    if (body.mother?.maidenName && body.mother?.firstName) {
      guardianData.push({
        relationship: "MOTHER",
        lastName: body.mother.maidenName,
        firstName: body.mother.firstName,
        middleName: body.mother.middleName || null,
        contactNumber: body.mother.contactNumber || null,
        email: body.mother.email || null,
      });
    }
    if (body.guardian?.lastName && body.guardian?.firstName) {
      guardianData.push({
        relationship: "GUARDIAN",
        lastName: body.guardian.lastName,
        firstName: body.guardian.firstName,
        middleName: body.guardian.middleName || null,
        contactNumber: body.guardian.contactNumber || null,
        email: body.guardian.email || null,
      });
    }

    // 5. Create/reuse registrant + guardians + registration in a transaction
    const registrantPayload = {
      lrn,
      firstName: body.firstName,
      lastName: body.lastName,
      middleName: body.middleName || null,
      extensionName: body.extensionName || null,
      birthdate: birthDate,
      sex: body.sex === "MALE" ? ("MALE" as const) : ("FEMALE" as const),
      religion: body.religion || null,
      isIpCommunity: body.isIpCommunity ?? false,
      ipGroupName: body.isIpCommunity ? body.ipGroupName : null,
      isLearnerWithDisability: body.isLearnerWithDisability ?? false,
      disabilityTypes: body.isLearnerWithDisability
        ? body.disabilityTypes || []
        : [],
      houseNoStreet: body.houseNoStreet || null,
      sitio: body.sitio || null,
      barangay: body.barangay,
      cityMunicipality: body.cityMunicipality,
      province: body.province,
    };

    const result = await prisma.$transaction(async (tx) => {
      let registrant: { id: number };

      if (lrn) {
        const existingRegistrant = await tx.earlyRegistrant.findUnique({
          where: { lrn },
          select: { id: true },
        });

        if (existingRegistrant) {
          registrant = await tx.earlyRegistrant.update({
            where: { id: existingRegistrant.id },
            data: {
              ...registrantPayload,
              guardians: {
                deleteMany: {},
                ...(guardianData.length > 0
                  ? { createMany: { data: guardianData } }
                  : {}),
              },
            },
            select: { id: true },
          });
        } else {
          registrant = await tx.earlyRegistrant.create({
            data: {
              ...registrantPayload,
              guardians:
                guardianData.length > 0
                  ? { createMany: { data: guardianData } }
                  : undefined,
            },
            select: { id: true },
          });
        }
      } else {
        registrant = await tx.earlyRegistrant.create({
          data: {
            ...registrantPayload,
            guardians:
              guardianData.length > 0
                ? { createMany: { data: guardianData } }
                : undefined,
          },
          select: { id: true },
        });
      }

      const registration = await tx.earlyRegistration.create({
        data: {
          registrantId: registrant.id,
          schoolYearId: activeYear.id,
          gradeLevel: body.gradeLevel,
          learnerType: body.learnerType,
          applicantType,
          status: "SUBMITTED",
          channel: options.channel,
          gradeLevelIdV2: gradeLevelV2?.id ?? null,
          learnerTypeV2,
          statusV2: "SUBMITTED",
          channelV2: options.channel,
          contactNumber: body.contactNumber,
          email: body.email || null,
          primaryContact: body.primaryContact || null,
          primaryContactV2,
          hasNoMother: body.hasNoMother ?? false,
          hasNoFather: body.hasNoFather ?? false,
          isPrivacyConsentGiven: body.isPrivacyConsentGiven ?? false,
          encodedById: options.encodedById ?? null,
        },
        select: { id: true },
      });

      return { registrant, registration };
    });

    // 6. Audit log (non-blocking)
    auditLog({
      userId: options.encodedById ?? null,
      actionType: "EARLY_REGISTRATION_SUBMITTED",
      description: `Early registration submitted for ${body.lastName}, ${body.firstName} — Grade ${body.gradeLevel} (${options.channel}). Age: ${age}.`,
      subjectType: "EarlyRegistration",
      recordId: result.registration.id,
      req,
    }).catch(() => {});

    res.status(201).json({
      id: result.registration.id,
      registrantId: result.registrant.id,
      gradeLevel: body.gradeLevel,
      applicantType,
      learnerName: `${body.lastName}, ${body.firstName}`,
      age,
      message:
        "Matagumpay na nai-submit ang iyong early registration. / Your early registration has been submitted successfully.",
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
      throw new AppError(400, "Invalid LRN format.");
    }

    const settings = await prisma.schoolSetting.findFirst({
      include: { activeSchoolYear: true },
    });

    if (!settings?.activeSchoolYear) {
      throw new AppError(400, "No active school year configured.");
    }

    const activeYear = settings.activeSchoolYear;

    // Check early registrations
    const existingEarlyReg = await prisma.earlyRegistrant.findFirst({
      where: {
        lrn,
        registrations: {
          some: { schoolYearId: activeYear.id },
        },
      },
      select: { id: true },
    });

    if (existingEarlyReg) {
      return res.json({
        exists: true,
        type: "EARLY_REGISTRATION",
        message: `Mayroon nang naka-register na may LRN ${lrn} para sa taong panuruan na ito. / A registration with LRN ${lrn} already exists for this school year.`,
      });
    }

    // Check applicants table
    const existingApplicant = await prisma.applicant.findFirst({
      where: { lrn, schoolYearId: activeYear.id },
      select: { id: true },
    });

    if (existingApplicant) {
      return res.json({
        exists: true,
        type: "APPLICANT",
        message: `May application na ang LRN ${lrn} para sa taong panuruan na ito. / An application with LRN ${lrn} already exists for this school year.`,
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

    const where: Record<string, unknown> = {
      schoolYearId: resolvedSchoolYearId,
    };
    const andFilters: Record<string, unknown>[] = [];

    if (status) {
      andFilters.push({ OR: [{ status }, { statusV2: status }] });
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
            { name: normalizedGradeLevel },
            { name: `GRADE ${normalizedGradeLevel}` },
          ],
        },
        select: { id: true },
      });

      const gradeLevelFilters: Record<string, unknown>[] = [
        { gradeLevel: normalizedGradeLevel },
      ];

      if (matchingGradeLevels.length > 0) {
        gradeLevelFilters.push({
          gradeLevelIdV2: { in: matchingGradeLevels.map((g) => g.id) },
        });
      }

      andFilters.push({ OR: gradeLevelFilters });
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    if (search) {
      where.registrant = {
        OR: [
          { lastName: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lrn: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const [registrations, total] = await Promise.all([
      prisma.earlyRegistration.findMany({
        where: where as any,
        include: {
          registrant: {
            include: { guardians: true },
          },
          gradeLevelV2: { select: { id: true, name: true } },
          schoolYear: { select: { yearLabel: true } },
          encodedBy: { select: { firstName: true, lastName: true } },
          verifiedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { submittedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.earlyRegistration.count({ where: where as any }),
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

/** GET /:id — Get a single early registration detail */
export async function show(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id));
    const registration = await prisma.earlyRegistration.findUnique({
      where: { id },
      include: {
        registrant: {
          include: { guardians: true },
        },
        gradeLevelV2: { select: { id: true, name: true } },
        schoolYear: { select: { yearLabel: true } },
        encodedBy: { select: { firstName: true, lastName: true } },
        verifiedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!registration) {
      throw new AppError(404, "Early registration not found.");
    }

    res.json(registration);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/verify — Registrar marks a registration as verified */
export async function verify(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id));
    const registration = await prisma.earlyRegistration.findUnique({
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

    const updated = await prisma.earlyRegistration.update({
      where: { id },
      data: {
        status: "VERIFIED",
        statusV2: "VERIFIED",
        verifiedAt: new Date(),
        verifiedById: req.user!.userId,
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REGISTRATION_VERIFIED",
      description: `Early registration #${id} verified.`,
      subjectType: "EarlyRegistration",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}
