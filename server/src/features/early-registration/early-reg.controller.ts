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

// ── Shared store logic for both public and F2F ──

interface StoreOptions {
  channel: "ONLINE" | "F2F";
  encodedById?: number | null;
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
      });
      if (existingEarlyReg) {
        throw new AppError(
          409,
          `Mayroon nang naka-register na may LRN ${lrn} para sa taong panuruan na ito. / A registration with LRN ${lrn} already exists for this school year.`,
        );
      }

      const existingApplicant = await prisma.applicant.findFirst({
        where: { lrn, schoolYearId: activeYear.id },
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

    // 5. Create registrant + guardians + registration in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const registrant = await tx.earlyRegistrant.create({
        data: {
          lrn,
          firstName: body.firstName,
          lastName: body.lastName,
          middleName: body.middleName || null,
          extensionName: body.extensionName || null,
          birthdate: birthDate,
          sex: body.sex === "MALE" ? "MALE" : "FEMALE",
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
          guardians:
            guardianData.length > 0
              ? { createMany: { data: guardianData } }
              : undefined,
        },
      });

      const registration = await tx.earlyRegistration.create({
        data: {
          registrantId: registrant.id,
          schoolYearId: activeYear.id,
          gradeLevel: body.gradeLevel,
          learnerType: body.learnerType,
          status: "SUBMITTED",
          channel: options.channel,
          contactNumber: body.contactNumber,
          email: body.email || null,
          primaryContact: body.primaryContact || null,
          hasNoMother: body.hasNoMother ?? false,
          hasNoFather: body.hasNoFather ?? false,
          isPrivacyConsentGiven: body.isPrivacyConsentGiven ?? false,
          encodedById: options.encodedById ?? null,
        },
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
      learnerName: `${body.lastName}, ${body.firstName}`,
      age,
      message:
        "Matagumpay na nai-submit ang iyong early registration. / Your early registration has been submitted successfully.",
    });
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

    const where: Record<string, unknown> = { schoolYearId };
    if (status) where.status = status;
    if (gradeLevel) where.gradeLevel = gradeLevel;

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
