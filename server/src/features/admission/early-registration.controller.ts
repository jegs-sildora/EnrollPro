import { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { saveBase64Image } from "../../lib/fileUploader.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { isEnrollmentOpen } from "../settings/enrollment-gate.service.js";
import { normalizeDateToUtcNoon } from "../school-year/school-year.service.js";
import { getRequiredDocuments } from "../enrollment/enrollment-requirement.service.js";
import { AppError } from "../../lib/AppError.js";
import type {
  ApplicationStatus,
  Prisma,
  Applicant,
} from "../../generated/prisma";

// ── Helpers ──

/** Fetch an applicant by ID or throw 404. */
async function findApplicantOrThrow(id: number): Promise<Applicant> {
  const applicant = await prisma.applicant.findUnique({ where: { id } });
  if (!applicant) throw new AppError(404, "Applicant not found");
  return applicant;
}

/** Assert a status transition is valid, or throw 422. */
function assertTransition(
  applicant: Applicant,
  to: ApplicationStatus,
  contextMessage?: string,
): void {
  if (!(VALID_TRANSITIONS[applicant.status]?.includes(to) ?? false)) {
    throw new AppError(
      422,
      contextMessage ??
        `Cannot transition from "${applicant.status}" to "${to}".`,
    );
  }
}

/** Queue an email notification (non-critical — never throws). */
async function queueEmail(
  applicantId: number,
  recipient: string | null,
  subject: string,
  trigger: Parameters<typeof prisma.emailLog.create>[0]["data"]["trigger"],
): Promise<void> {
  if (!recipient) return;
  try {
    await prisma.emailLog.create({
      data: { recipient, subject, trigger, status: "PENDING", applicantId },
    });
  } catch {
    // Non-critical — don't fail the request
  }
}

/** Flatten nested assessments array and scpDetail into a pipeline-aware response the client expects. */
async function flattenAssessmentData(application: Record<string, any>) {
  const assessments = (application.assessments ?? []) as Array<{
    id: number;
    type: string;
    stepOrder: number | null;
    scheduledDate: string | null;
    scheduledTime: string | null;
    venue: string | null;
    score: number | null;
    result: string | null;
    notes: string | null;
    conductedAt: string | null;
  }>;

  const scpDetail = application.programDetail ?? null;

  // Load pipeline step config for SCP applicants
  let pipelineSteps: Array<{
    stepOrder: number;
    kind: string;
    label: string;
    description: string | null;
    isRequired: boolean;
    scheduledDate: string | null;
    scheduledTime: string | null;
    venue: string | null;
    notes: string | null;
    cutoffScore: number | null;
  }> = [];

  if (application.applicantType !== "REGULAR") {
    const scpConfig = await prisma.scpProgramConfig.findUnique({
      where: {
        uq_scp_program_configs_type: {
          schoolYearId: application.schoolYearId,
          scpType: application.applicantType,
        },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    if (scpConfig) {
      pipelineSteps = scpConfig.steps.map((s) => ({
        stepOrder: s.stepOrder,
        kind: s.kind,
        label: s.label,
        description: s.description,
        isRequired: s.isRequired,
        scheduledDate: s.scheduledDate?.toISOString() ?? null,
        scheduledTime: s.scheduledTime,
        venue: s.venue,
        notes: s.notes,
        cutoffScore: s.cutoffScore ?? null,
      }));
    }
  }

  // Build steps array: merge pipeline config with actual assessment records
  const steps = pipelineSteps.map((step) => {
    // Find matching assessment by stepOrder (preferred) or kind fallback
    const match =
      assessments.find((a) => a.stepOrder === step.stepOrder) ??
      assessments.find((a) => a.type === step.kind);

    let stepStatus: "PENDING" | "SCHEDULED" | "COMPLETED" = "PENDING";
    if (match?.conductedAt || match?.result != null || match?.score != null) {
      stepStatus = "COMPLETED";
    } else if (match?.scheduledDate) {
      stepStatus = "SCHEDULED";
    }

    return {
      stepOrder: step.stepOrder,
      kind: step.kind,
      label: step.label,
      description: step.description,
      isRequired: step.isRequired,
      // Config defaults
      configDate: step.scheduledDate,
      configTime: step.scheduledTime,
      configVenue: step.venue,
      configNotes: step.notes,
      cutoffScore: step.cutoffScore ?? null,
      // Actual assessment data
      assessmentId: match?.id ?? null,
      scheduledDate: match?.scheduledDate ?? null,
      scheduledTime: match?.scheduledTime ?? null,
      venue: match?.venue ?? null,
      score: match?.score ?? null,
      result: match?.result ?? null,
      notes: match?.notes ?? null,
      conductedAt: match?.conductedAt ?? null,
      status: stepStatus,
    };
  });

  // Backward-compat flat fields (from first/primary assessment)
  const primary = assessments[0] ?? null;
  const interview = assessments.find((a) => a.type === "INTERVIEW") ?? null;

  return {
    ...application,
    isScpApplication: application.applicantType !== "REGULAR",
    scpType: scpDetail?.scpType ?? null,
    artField: scpDetail?.artField ?? null,
    foreignLanguage: scpDetail?.foreignLanguage ?? null,
    sportsList: scpDetail?.sportsList ?? [],
    // Pipeline-aware data
    assessmentSteps: steps,
    // Legacy flat fields for backward compat
    assessmentType: primary?.type ?? null,
    examDate: primary?.scheduledDate ?? null,
    examVenue: primary?.venue ?? null,
    examScore: primary?.score ?? null,
    examResult: primary?.result ?? null,
    examNotes: primary?.notes ?? null,
    interviewDate: interview?.scheduledDate ?? null,
    interviewResult: interview?.result ?? null,
    interviewNotes: interview?.notes ?? null,
  };
}

// ── Valid status transitions ──
const VALID_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "ASSESSMENT_SCHEDULED", "REJECTED", "WITHDRAWN"],
  UNDER_REVIEW: [
    "FOR_REVISION",
    "ELIGIBLE",
    "ASSESSMENT_SCHEDULED",
    "PRE_REGISTERED",
    "TEMPORARILY_ENROLLED",
    "REJECTED",
    "WITHDRAWN",
  ],
  FOR_REVISION: ["UNDER_REVIEW", "WITHDRAWN"],
  ELIGIBLE: ["ASSESSMENT_SCHEDULED", "PRE_REGISTERED", "WITHDRAWN"],
  ASSESSMENT_SCHEDULED: [
    "ASSESSMENT_TAKEN",
    "ASSESSMENT_SCHEDULED",
    "INTERVIEW_SCHEDULED",
    "WITHDRAWN",
  ],
  ASSESSMENT_TAKEN: [
    "PASSED",
    "NOT_QUALIFIED",
    "ASSESSMENT_SCHEDULED",
    "WITHDRAWN",
  ],
  PASSED: [
    "PRE_REGISTERED",
    "INTERVIEW_SCHEDULED",
    "ASSESSMENT_SCHEDULED",
    "WITHDRAWN",
  ],
  INTERVIEW_SCHEDULED: ["PRE_REGISTERED", "WITHDRAWN"],
  PRE_REGISTERED: ["ENROLLED", "TEMPORARILY_ENROLLED", "WITHDRAWN"],
  TEMPORARILY_ENROLLED: ["ENROLLED", "WITHDRAWN"],
  NOT_QUALIFIED: ["UNDER_REVIEW", "WITHDRAWN", "REJECTED"],
  ENROLLED: ["WITHDRAWN"],
  REJECTED: ["UNDER_REVIEW", "WITHDRAWN"],
  WITHDRAWN: [],
};

/** Recursively converts all string values in an object to uppercase and trims them. */
function toUpperCaseRecursive(obj: unknown): unknown {
  const skipKeys = ["studentPhoto", "email", "emailAddress", "password"];

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

// ── Handlers ──

// Get Required Documents for an Applicant
export async function getRequirements(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      include: { gradeLevel: true },
    });
    if (!applicant) throw new AppError(404, "Applicant not found");

    const requirements = getRequiredDocuments({
      learnerType: applicant.learnerType,
      gradeLevel: applicant.gradeLevel.name,
      applicantType: applicant.applicantType,
      isLwd: applicant.isLearnerWithDisability,
      isPeptAePasser: false,
    });

    res.json({ requirements });
  } catch (error) {
    next(error);
  }
}

// ── List all applications (paginated, filterable) ──
export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      search,
      gradeLevelId,
      status,
      applicantType,
      page = "1",
      limit = "15",
    } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: Prisma.ApplicantWhereInput = {};

    // Scope to active School Year by default
    const settings = await prisma.schoolSetting.findFirst({
      select: { activeSchoolYearId: true },
    });
    if (settings?.activeSchoolYearId) {
      where.schoolYearId = settings.activeSchoolYearId;
    }

    if (search) {
      const s = String(search);
      where.OR = [
        { lrn: { contains: s, mode: "insensitive" } },
        { firstName: { contains: s, mode: "insensitive" } },
        { lastName: { contains: s, mode: "insensitive" } },
        { trackingNumber: { contains: s, mode: "insensitive" } },
      ];
    }
    if (gradeLevelId) where.gradeLevelId = parseInt(String(gradeLevelId));
    if (status && status !== "ALL") where.status = status as ApplicationStatus;
    if (applicantType && applicantType !== "ALL")
      where.applicantType = applicantType as Prisma.EnumApplicantTypeFilter;

    const [applications, total] = await Promise.all([
      prisma.applicant.findMany({
        where,
        include: {
          gradeLevel: true,
          enrollment: { include: { section: true } },
          programDetail: true,
          assessments: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.applicant.count({ where }),
    ]);

    res.json({
      applications: await Promise.all(
        applications.map((app) => flattenAssessmentData(app)),
      ),
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (error) {
    next(error);
  }
}

// ── Show single application ──
export async function show(req: Request, res: Response, next: NextFunction) {
  try {
    const application = await prisma.applicant.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      include: {
        gradeLevel: true,
        schoolYear: true,
        addresses: true,
        familyMembers: true,
        previousSchool: true,
        assessments: { orderBy: { createdAt: "desc" } },
        programDetail: true,
        documents: {
          include: {
            uploadedBy: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
        },
        checklist: {
          include: {
            updatedBy: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
        },
        encodedBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        enrollment: {
          include: {
            section: {
              include: {
                advisingTeacher: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
            enrolledBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!application) throw new AppError(404, "Application not found");

    // Automatically transition to UNDER_REVIEW when opened by registrar
    if (application.status === "SUBMITTED" && req.user?.role === "REGISTRAR") {
      await prisma.applicant.update({
        where: { id: application.id },
        data: { status: "UNDER_REVIEW" },
      });
      application.status = "UNDER_REVIEW";

      await auditLog({
        userId: req.user.userId,
        actionType: "APPLICATION_REVIEWED",
        description: `Started reviewing application for ${application.firstName} ${application.lastName}`,
        subjectType: "Applicant",
        recordId: application.id,
        req,
      });
    }

    res.json(await flattenAssessmentData(application));
  } catch (error) {
    next(error);
  }
}

// ── Shared application builder ──

interface SubmitOptions {
  channel: "ONLINE" | "F2F";
  trackingPrefix: string;
  encodedById: number | null;
}

async function submitApplication(
  req: Request,
  options: SubmitOptions,
): Promise<string> {
  // 1. Find active School Year
  const settings = await prisma.schoolSetting.findFirst({
    include: { activeSchoolYear: true },
  });

  if (!settings?.activeSchoolYear) {
    throw new AppError(
      400,
      "No active School Year configured. Enrollment is not available.",
    );
  }

  const activeYear = settings.activeSchoolYear;

  // 2. Check enrollment gate
  if (!isEnrollmentOpen(activeYear)) {
    throw new AppError(
      400,
      "Early Registration is currently closed. Please check back during the enrollment period.",
    );
  }

  const body = toUpperCaseRecursive(req.body) as Record<string, any>;

  // 3. Resolve grade level
  const gradeLevel = await prisma.gradeLevel.findFirst({
    where: {
      schoolYearId: activeYear.id,
      name: { contains: body.gradeLevel, mode: "insensitive" },
    },
  });

  if (!gradeLevel) {
    throw new AppError(
      400,
      `Grade ${body.gradeLevel} is not available for the current School Year.`,
    );
  }

  // 4. Check duplicate LRN in same School Year
  if (body.lrn) {
    const existingByLrn = await prisma.applicant.findFirst({
      where: { lrn: body.lrn, schoolYearId: activeYear.id },
    });

    if (existingByLrn) {
      throw new AppError(
        409,
        `An application with LRN ${body.lrn} already exists for this School Year. Tracking number: ${existingByLrn.trackingNumber}.`,
      );
    }
  }

  // 5. Determine applicant type
  let applicantType: string = "REGULAR";
  if (body.isScpApplication && body.scpType) {
    applicantType = body.scpType;
  }

  // 6. Map Learner Type
  let lType:
    | "NEW_ENROLLEE"
    | "TRANSFEREE"
    | "RETURNING"
    | "CONTINUING"
    | "OSCYA"
    | "ALS" = "NEW_ENROLLEE";
  const bodyLType = String(body.learnerType).toUpperCase();
  if (bodyLType === "TRANSFEREE") lType = "TRANSFEREE";
  else if (bodyLType === "RETURNING" || bodyLType === "BALIK_ARAL")
    lType = "RETURNING";
  else if (bodyLType === "CONTINUING") lType = "CONTINUING";
  else if (bodyLType === "OSCYA") lType = "OSCYA";
  else if (bodyLType === "ALS") lType = "ALS";

  const emailAddress: string | null = body.email || null;

  // Parse birthdate
  const rawBirthDate = new Date(body.birthdate);
  if (isNaN(rawBirthDate.getTime())) {
    throw new AppError(400, "Invalid birthdate format.");
  }
  const birthDate = normalizeDateToUtcNoon(rawBirthDate);

  // Save student photo
  const studentPhotoUrl = await saveBase64Image(body.studentPhoto, "photo");

  const year = new Date().getFullYear();
  const tempTracking = `${options.trackingPrefix}-${year}-TEMP-${Date.now()}`;

  // Build nested address data
  const addressData: Prisma.ApplicantAddressCreateManyApplicantInput[] = [];
  if (body.currentAddress) {
    addressData.push({ addressType: "CURRENT", ...body.currentAddress });
  }
  if (body.permanentAddress) {
    addressData.push({ addressType: "PERMANENT", ...body.permanentAddress });
  }

  // Build nested family member data
  const familyData: Prisma.ApplicantFamilyMemberCreateManyApplicantInput[] = [];
  if (body.mother) familyData.push({ relationship: "MOTHER", ...body.mother });
  if (body.father) familyData.push({ relationship: "FATHER", ...body.father });
  if (body.guardian)
    familyData.push({ relationship: "GUARDIAN", ...body.guardian });

  const applicant = await prisma.applicant.create({
    data: {
      lrn: body.lrn || null,
      psaBirthCertNumber: body.psaBirthCertNumber || null,
      studentPhoto: studentPhotoUrl,
      lastName: body.lastName,
      firstName: body.firstName,
      middleName: body.middleName || null,
      suffix: body.extensionName || null,
      birthDate,
      sex: body.sex === "MALE" ? "MALE" : "FEMALE",
      placeOfBirth: body.placeOfBirth || null,
      religion: body.religion || null,
      emailAddress,

      // Background classifications
      isIpCommunity: body.isIpCommunity ?? false,
      ipGroupName: body.isIpCommunity ? body.ipGroupName : null,
      is4PsBeneficiary: body.is4PsBeneficiary ?? false,
      householdId4Ps: body.is4PsBeneficiary ? body.householdId4Ps : null,
      isBalikAral: body.isBalikAral ?? false,
      lastYearEnrolled: body.isBalikAral ? body.lastYearEnrolled : null,
      isLearnerWithDisability: body.isLearnerWithDisability ?? false,
      specialNeedsCategory: body.isLearnerWithDisability
        ? body.specialNeedsCategory || null
        : null,
      hasPwdId: body.isLearnerWithDisability ? (body.hasPwdId ?? false) : false,
      disabilityTypes: body.isLearnerWithDisability
        ? body.disabilityTypes || []
        : [],

      // Enrollment preferences
      learnerType: lType,
      learningModalities: body.learningModalities || [],
      isPrivacyConsentGiven: body.isPrivacyConsentGiven ?? false,

      // Relations
      gradeLevelId: gradeLevel.id,
      schoolYearId: activeYear.id,
      applicantType:
        applicantType as Prisma.EnumApplicantTypeFieldUpdateOperationsInput["set"] &
          string,
      trackingNumber: tempTracking,

      // Channel-specific fields
      admissionChannel: options.channel,
      ...(options.encodedById ? { encodedById: options.encodedById } : {}),

      // Normalized nested creates
      addresses:
        addressData.length > 0
          ? { createMany: { data: addressData } }
          : undefined,
      familyMembers:
        familyData.length > 0
          ? { createMany: { data: familyData } }
          : undefined,
      previousSchool: body.lastSchoolName
        ? {
            create: {
              schoolName: body.lastSchoolName?.trim() || null,
              schoolDepedId: body.lastSchoolId?.trim() || null,
              gradeCompleted: body.lastGradeCompleted || null,
              schoolYearAttended: body.schoolYearLastAttended || null,
              schoolAddress: body.lastSchoolAddress?.trim() || null,
              schoolType: body.lastSchoolType || null,
              natScore: body.natScore ?? null,
              grade10ScienceGrade: body.g10ScienceGrade ?? null,
              grade10MathGrade: body.grade10MathGrade ?? null,
              generalAverage: body.generalAverage ?? null,
            },
          }
        : undefined,
      programDetail:
        body.isScpApplication && body.scpType
          ? {
              create: {
                scpType: body.scpType,
                artField:
                  body.scpType === "SPECIAL_PROGRAM_IN_THE_ARTS"
                    ? body.artField
                    : null,
                sportsList:
                  body.scpType === "SPECIAL_PROGRAM_IN_SPORTS"
                    ? body.sportsList || []
                    : [],
                foreignLanguage:
                  body.scpType === "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE"
                    ? body.foreignLanguage
                    : null,
              },
            }
          : undefined,
      checklist: { create: {} },
    },
  });

  // Generate proper tracking number from ID
  const trackingNumber = `${options.trackingPrefix}-${year}-${String(applicant.id).padStart(5, "0")}`;
  await prisma.applicant.update({
    where: { id: applicant.id },
    data: { trackingNumber },
  });

  // Audit log
  const prefix =
    options.channel === "F2F"
      ? `${req.user!.role} encoded F2F walk-in application for`
      : `Guest submitted application for`;
  await auditLog({
    userId: options.encodedById,
    actionType:
      options.channel === "F2F"
        ? "F2F_APPLICATION_SUBMITTED"
        : "APPLICATION_SUBMITTED",
    description: `${prefix} ${applicant.firstName} ${applicant.lastName}${body.lrn ? ` (LRN: ${body.lrn})` : ""}. Tracking: ${trackingNumber}`,
    subjectType: "Applicant",
    recordId: applicant.id,
    req,
  });

  await queueEmail(
    applicant.id,
    emailAddress,
    `Application Received - ${trackingNumber}`,
    "APPLICATION_SUBMITTED",
  );

  return trackingNumber;
}

/** Wrap Prisma P2002 unique-constraint errors into AppError(409). */
function rethrowPrismaUnique(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  ) {
    const meta = (error as { meta?: { target?: string[] } }).meta;
    if (meta?.target?.includes("lrn")) {
      throw new AppError(409, "An application with this LRN already exists.");
    }
    throw new AppError(409, "A duplicate application was detected.");
  }
  throw error;
}

// ── Submit new application (public) ──
export async function store(req: Request, res: Response, next: NextFunction) {
  try {
    const trackingNumber = await submitApplication(req, {
      channel: "ONLINE",
      trackingPrefix: "APP",
      encodedById: null,
    });
    res.status(201).json({ trackingNumber });
  } catch (error) {
    try {
      rethrowPrismaUnique(error);
    } catch (mapped) {
      next(mapped);
    }
  }
}

// ── Submit F2F walk-in application (authenticated - REGISTRAR/SYSTEM_ADMIN) ──
export async function storeF2F(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const trackingNumber = await submitApplication(req, {
      channel: "F2F",
      trackingPrefix: "F2F",
      encodedById: req.user!.userId,
    });
    res.status(201).json({ trackingNumber });
  } catch (error) {
    try {
      rethrowPrismaUnique(error);
    } catch (mapped) {
      next(mapped);
    }
  }
}

// ── Track application by tracking number (public) ──
export async function track(req: Request, res: Response, next: NextFunction) {
  try {
    const application = await prisma.applicant.findUnique({
      where: { trackingNumber: String(req.params.trackingNumber) },
      select: {
        trackingNumber: true,
        firstName: true,
        middleName: true,
        lastName: true,
        status: true,
        applicantType: true,
        schoolYearId: true,
        createdAt: true,
        gradeLevel: { select: { name: true } },
        enrollment: {
          select: { section: { select: { name: true } }, enrolledAt: true },
        },
        assessments: {
          select: {
            type: true,
            scheduledDate: true,
            scheduledTime: true,
            venue: true,
            notes: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        rejectionReason: true,
        programDetail: { select: { scpType: true } },
      },
    });

    if (!application) {
      throw new AppError(
        404,
        "No application found with this tracking number.",
      );
    }

    res.json(await flattenAssessmentData(application));
  } catch (error) {
    next(error);
  }
}

// ── Approve + Enroll ──
export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const { sectionId } = req.body;
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    assertTransition(
      applicant,
      "PRE_REGISTERED",
      `Cannot approve an application with status "${applicant.status}". Only UNDER_REVIEW, ELIGIBLE, or PASSED applications can be approved (moved to PRE_REGISTERED).`,
    );

    const result = await prisma.$transaction(async (tx) => {
      const [section] = await tx.$queryRaw<
        { id: number; maxCapacity: number }[]
      >`
        SELECT id, "max_capacity" as "maxCapacity" FROM "sections" WHERE id = ${sectionId} FOR UPDATE
      `;

      if (!section) throw new AppError(404, "Section not found");

      const enrolledCount = await tx.enrollment.count({ where: { sectionId } });
      if (enrolledCount >= section.maxCapacity) {
        throw new AppError(422, "This section has reached maximum capacity");
      }

      const enrollment = await tx.enrollment.create({
        data: {
          applicantId,
          sectionId,
          schoolYearId: applicant.schoolYearId,
          enrolledById: req.user!.userId,
        },
      });

      await tx.applicant.update({
        where: { id: applicantId },
        data: { status: "PRE_REGISTERED" },
      });

      return enrollment;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_APPROVED",
      description: `Approved application #${applicantId} for ${applicant.firstName} ${applicant.lastName} and pre-registered to section ${sectionId}`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    await queueEmail(
      applicantId,
      applicant.emailAddress,
      `Application Approved - ${applicant.trackingNumber}`,
      "APPLICATION_APPROVED",
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
}

// Finalize Enrollment (Phase 2 complete)
export async function enroll(req: Request, res: Response, next: NextFunction) {
  try {
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      include: {
        gradeLevel: true,
        checklist: true,
      },
    });
    if (!applicant) throw new AppError(404, "Applicant not found");

    assertTransition(
      applicant,
      "ENROLLED",
      `Cannot finalize enrollment. Current status: "${applicant.status}". Only PRE_REGISTERED or TEMPORARILY_ENROLLED applications can be enrolled.`,
    );

    // Validate mandatory requirements for official enrollment
    const requirements = getRequiredDocuments({
      learnerType: applicant.learnerType,
      gradeLevel: applicant.gradeLevel.name,
      applicantType: applicant.applicantType,
      isLwd: applicant.isLearnerWithDisability,
      isPeptAePasser: false, // Default
    });

    const checklist = applicant.checklist;
    if (!checklist) {
      throw new AppError(
        422,
        "Requirement checklist not found for this applicant.",
      );
    }

    const missingMandatory: string[] = [];

    requirements.forEach((req) => {
      if (req.isRequired) {
        let isMet = false;
        switch (req.type) {
          case "BEEF":
            // BEEF is the form itself, we assume it's met if they applied
            isMet = true;
            break;
          case "CONFIRMATION_SLIP":
            isMet = checklist.isConfirmationSlipReceived;
            break;
          case "PSA_BIRTH_CERTIFICATE":
            // Official enrollment REQUIRES PSA BC (presented now or already on file).
            // Secondary proof only allows TEMPORARY enrollment.
            isMet = checklist.isPsaBirthCertPresented;
            break;
          case "SF9_REPORT_CARD":
          case "ACADEMIC_RECORD":
            isMet = checklist.isSf9Submitted;
            break;
          case "PEPT_AE_CERTIFICATE":
            // PEPT/A&E requirement is met if it was ever marked as presented
            // (Note: column isPeptAeSubmitted was dropped in favor of simplified checklist)
            isMet = false; // We don't have a direct field for this anymore in the simplified checklist
            break;
          // PWD_ID and MEDICAL_EVALUATION are marked as isRequired: false in our service for now
        }

        if (!isMet) {
          missingMandatory.push(req.label);
        }
      }
    });

    if (missingMandatory.length > 0) {
      throw Object.assign(
        new AppError(
          422,
          "Cannot finalize official enrollment due to missing mandatory documents. Please mark as TEMPORARILY ENROLLED instead.",
        ),
        { missingRequirements: missingMandatory },
      );
    }

    const { generatePortalPin } =
      await import("../learner/portal-pin.service.js");
    const { raw: rawPin, hash: pinHash } = generatePortalPin();

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: {
        status: "ENROLLED",
        isTemporarilyEnrolled: false,
        portalPin: pinHash,
        portalPinChangedAt: new Date(),
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_ENROLLED",
      description: `Finalized official enrollment for ${applicant.firstName} ${applicant.lastName} (#${applicantId}) - All mandatory docs verified`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    res.json({ ...updated, rawPortalPin: rawPin });
  } catch (error) {
    next(error);
  }
}

// ── Mark as Temporarily Enrolled (Phase 2 - Missing Docs) ──
export async function markTemporarilyEnrolled(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    assertTransition(
      applicant,
      "TEMPORARILY_ENROLLED",
      `Cannot mark as temporarily enrolled. Current status: "${applicant.status}".`,
    );

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: {
        status: "TEMPORARILY_ENROLLED",
        isTemporarilyEnrolled: true,
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_TEMPORARILY_ENROLLED",
      description: `Marked ${applicant.firstName} ${applicant.lastName} (#${applicantId}) as TEMPORARILY ENROLLED (awaiting docs)`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// â"€â"€ Update Requirement Checklist â"€â"€
export async function updateChecklist(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const applicantId = parseInt(String(req.params.id));
    const data = req.body;

    // Filter allowed fields only to prevent Prisma errors on extra fields
    const allowedFields = [
      "isPsaBirthCertPresented",
      "isOriginalPsaBcCollected",
      "isSf9Submitted",
      "isSf10Requested",
      "isGoodMoralPresented",
      "isMedicalEvalSubmitted",
      "isUndertakingSigned",
      "isConfirmationSlipReceived",
    ] as const;

    const filteredData: Partial<
      Record<(typeof allowedFields)[number], boolean>
    > = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        filteredData[key] = data[key];
      }
    }

    // Get current state for auditing
    const currentChecklist = await prisma.applicantChecklist.findUnique({
      where: { applicantId },
    });

    const updated = await prisma.applicantChecklist.upsert({
      where: { applicantId },
      update: { ...filteredData, updatedById: req.user!.userId },
      create: { ...filteredData, applicantId, updatedById: req.user!.userId },
    });

    // Record individual audit entries for each changed requirement
    const fieldsToLabel: Partial<
      Record<(typeof allowedFields)[number], string>
    > = {
      isPsaBirthCertPresented: "PSA Birth Certificate",
      isSf9Submitted: "SF9 / Report Card",
      isConfirmationSlipReceived: "Confirmation Slip",
      isSf10Requested: "SF10 (Permanent Record)",
      isGoodMoralPresented: "Good Moral Certificate",
      isMedicalEvalSubmitted: "Medical Evaluation",
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
          description: `${newValue ? "Added" : "Removed"} requirement: ${label} for applicant #${applicantId}`,
          subjectType: "Applicant",
          recordId: applicantId,
          req,
        });
      }
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "CHECKLIST_UPDATED",
      description: `Updated requirement checklist for applicant #${applicantId}`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// â"€â"€ Request Revision â"€â"€
export async function requestRevision(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { message } = toUpperCaseRecursive(req.body) as Record<
      string,
      unknown
    >;
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    assertTransition(
      applicant,
      "FOR_REVISION",
      `Cannot request revision for status "${applicant.status}"`,
    );

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: "FOR_REVISION" },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "REVISION_REQUESTED",
      description: `Requested revision for #${applicantId}. Message: ${message || "N/A"}`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// â"€â"€ Withdraw Application â"€â"€
export async function withdraw(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    assertTransition(
      applicant,
      "WITHDRAWN",
      `Cannot withdraw application with status "${applicant.status}"`,
    );

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: "WITHDRAWN" },
    });

    await auditLog({
      userId: req.user?.userId || null,
      actionType: "APPLICATION_WITHDRAWN",
      description: `Application #${applicantId} withdrawn`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// â"€â"€ Reject â"€â"€
export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const rejectionReason = req.body.rejectionReason?.trim();
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    assertTransition(
      applicant,
      "REJECTED",
      `Cannot reject an application with status "${applicant.status}".`,
    );

    // Require reason when rejecting from FAILED/NOT_QUALIFIED state per UX spec
    if (applicant.status === "NOT_QUALIFIED" && !rejectionReason) {
      throw new AppError(
        400,
        "A rejection reason is required when the applicant is not qualified.",
      );
    }

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: "REJECTED", rejectionReason: rejectionReason || null },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_REJECTED",
      description: `Rejected application #${applicantId} for ${applicant.firstName} ${applicant.lastName}. Reason: ${rejectionReason || "N/A"}`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    await queueEmail(
      applicantId,
      applicant.emailAddress,
      `Application Update - ${applicant.trackingNumber}`,
      "APPLICATION_REJECTED",
    );

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// â"€â"€ Mark as eligible (cleared for assessment or regular approval) â"€â"€
export async function markEligible(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    assertTransition(
      applicant,
      "ELIGIBLE",
      `Cannot mark as eligible. Current status: "${applicant.status}".`,
    );

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: "ELIGIBLE" },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_ELIGIBLE",
      description: `Marked ${applicant.firstName} ${applicant.lastName} (#${applicantId}) as ELIGIBLE - docs verified`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// — Schedule assessment step (pipeline-aware SCP flow) —
export async function scheduleAssessmentStep(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { stepOrder, kind, scheduledDate, scheduledTime, venue, notes } =
      req.body;
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    const targetStatus =
      kind === "INTERVIEW" ? "INTERVIEW_SCHEDULED" : "ASSESSMENT_SCHEDULED";

    assertTransition(
      applicant,
      targetStatus,
      `Cannot schedule assessment for application with status "${applicant.status}".`,
    );

    // Fetch pipeline step config for defaults
    const scpConfig = await prisma.scpProgramConfig.findUnique({
      where: {
        uq_scp_program_configs_type: {
          schoolYearId: applicant.schoolYearId,
          scpType: applicant.applicantType as any,
        },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    const stepConfig = scpConfig?.steps.find((s) => s.stepOrder === stepOrder);

    // Prerequisite gating: all previous required steps must have result = 'PASSED'
    if (scpConfig && stepOrder > 1) {
      const previousRequiredSteps = scpConfig.steps.filter(
        (s) => s.stepOrder < stepOrder && s.isRequired,
      );
      if (previousRequiredSteps.length > 0) {
        const existingAssessments = await prisma.applicantAssessment.findMany({
          where: { applicantId },
        });
        const unmet = previousRequiredSteps.filter(
          (prev) =>
            !existingAssessments.some(
              (a) => a.stepOrder === prev.stepOrder && a.result === "PASSED",
            ),
        );
        if (unmet.length > 0) {
          const labels = unmet.map((s) => s.label).join(", ");
          throw new AppError(
            400,
            `Cannot schedule step ${stepOrder}: prerequisite step(s) not passed — ${labels}.`,
          );
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.applicantAssessment.create({
        data: {
          applicantId,
          type: kind as any,
          stepOrder,
          scheduledDate: normalizeDateToUtcNoon(new Date(scheduledDate)),
          scheduledTime: scheduledTime || stepConfig?.scheduledTime || null,
          venue: venue || stepConfig?.venue || null,
          notes: notes || stepConfig?.notes || null,
        },
      });

      return tx.applicant.update({
        where: { id: applicantId },
        data: { status: targetStatus },
      });
    });

    const stepLabel = stepConfig?.label || kind;
    await auditLog({
      userId: req.user!.userId,
      actionType:
        kind === "INTERVIEW"
          ? "INTERVIEW_SCHEDULED"
          : "ASSESSMENT_STEP_SCHEDULED",
      description: `Scheduled ${stepLabel} (step ${stepOrder}) for ${applicant.firstName} ${applicant.lastName} (#${applicantId}) on ${scheduledDate}${venue || stepConfig?.venue ? ` at ${venue || stepConfig?.venue}` : ""}`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    await queueEmail(
      applicantId,
      applicant.emailAddress,
      `Assessment Scheduled - ${applicant.trackingNumber}`,
      "EXAM_SCHEDULED",
    );

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// Keep legacy alias for backward compat
export const scheduleExam = scheduleAssessmentStep;

// — Record assessment step result (pipeline-aware) —
export async function recordStepResult(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { stepOrder, kind, score, result, notes } = req.body;
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    assertTransition(
      applicant,
      "ASSESSMENT_TAKEN",
      `Cannot record result for application with status "${applicant.status}".`,
    );

    // Find the assessment record for this step
    const assessment = await prisma.applicantAssessment.findFirst({
      where: { applicantId, stepOrder, type: kind as any },
      orderBy: { createdAt: "desc" },
    });

    if (!assessment) {
      throw new AppError(
        404,
        `No scheduled assessment found for step ${stepOrder} (${kind}). Schedule the step first.`,
      );
    }

    // Load pipeline config to determine if all required steps are done
    const scpConfig = await prisma.scpProgramConfig.findUnique({
      where: {
        uq_scp_program_configs_type: {
          schoolYearId: applicant.schoolYearId,
          scpType: applicant.applicantType as any,
        },
      },
      include: {
        steps: { where: { isRequired: true }, orderBy: { stepOrder: "asc" } },
      },
    });

    const updated = await prisma.$transaction(async (tx) => {
      // Auto-determine result from step-level cutoff score if configured
      const stepConfig = scpConfig?.steps.find(
        (s) => s.stepOrder === stepOrder,
      );
      let finalResult = result ?? null;
      if (stepConfig?.cutoffScore != null && score != null) {
        finalResult = score >= stepConfig.cutoffScore ? "PASSED" : "FAILED";
      }

      // Update the specific assessment record
      await tx.applicantAssessment.update({
        where: { id: assessment.id },
        data: {
          score: score ?? null,
          result: finalResult,
          notes: notes ?? null,
          conductedAt: new Date(),
        },
      });

      // Check if all required pipeline steps have results
      const allAssessments = await tx.applicantAssessment.findMany({
        where: { applicantId },
      });

      const requiredSteps = scpConfig?.steps ?? [];
      const requiredNonInterview = requiredSteps.filter(
        (step) => step.kind !== "INTERVIEW",
      );
      const allRequiredDone = requiredNonInterview.every((step) =>
        allAssessments.some(
          (a) =>
            a.stepOrder === step.stepOrder &&
            (a.conductedAt != null || a.result != null || a.score != null),
        ),
      );

      // If all required non-interview steps have results → ASSESSMENT_TAKEN
      // Interview has its own separate flow (INTERVIEW_SCHEDULED → PRE_REGISTERED)
      const newStatus = allRequiredDone
        ? "ASSESSMENT_TAKEN"
        : "ASSESSMENT_SCHEDULED";

      return tx.applicant.update({
        where: { id: applicantId },
        data: { status: newStatus },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "STEP_RESULT_RECORDED",
      description: `Recorded result for step ${stepOrder} (${kind}) for ${applicant.firstName} ${applicant.lastName} (#${applicantId}): ${result || "N/A"} (Score: ${score ?? "N/A"})`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// Legacy alias
export const recordResult = recordStepResult;

// — Schedule interview (legacy alias — redirects to scheduleAssessmentStep) —
export async function scheduleInterview(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { interviewDate, interviewTime, interviewVenue, interviewNotes } =
      req.body;
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    assertTransition(
      applicant,
      "INTERVIEW_SCHEDULED",
      `Cannot schedule interview for application with status "${applicant.status}".`,
    );

    // Find the interview step in the pipeline
    const scpConfig = await prisma.scpProgramConfig.findUnique({
      where: {
        uq_scp_program_configs_type: {
          schoolYearId: applicant.schoolYearId,
          scpType: applicant.applicantType as any,
        },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    const interviewStep = scpConfig?.steps.find((s) => s.kind === "INTERVIEW");
    const stepOrder = interviewStep?.stepOrder ?? 99;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.applicantAssessment.create({
        data: {
          applicantId,
          type: "INTERVIEW",
          stepOrder,
          scheduledDate: normalizeDateToUtcNoon(new Date(interviewDate)),
          scheduledTime: interviewTime || null,
          venue: interviewVenue || null,
          notes: interviewNotes || null,
        },
      });

      return tx.applicant.update({
        where: { id: applicantId },
        data: { status: "INTERVIEW_SCHEDULED" },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "INTERVIEW_SCHEDULED",
      description: `Scheduled interview (step ${stepOrder}) for ${applicant.firstName} ${applicant.lastName} (#${applicantId}) on ${interviewDate}`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    await queueEmail(
      applicantId,
      applicant.emailAddress,
      `Interview Scheduled - ${applicant.trackingNumber}`,
      "EXAM_SCHEDULED",
    );

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// — Record interview result (legacy alias — redirects to recordStepResult) —
export async function recordInterviewResult(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { interviewScore, interviewResult, interviewNotes } = req.body;
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      include: { assessments: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!applicant) throw new AppError(404, "Applicant not found");

    assertTransition(
      applicant,
      "ASSESSMENT_TAKEN",
      `Cannot record interview result for application with status "${applicant.status}".`,
    );

    // Find the interview assessment
    const interviewAssessment = await prisma.applicantAssessment.findFirst({
      where: { applicantId, type: "INTERVIEW" },
      orderBy: { createdAt: "desc" },
    });

    if (!interviewAssessment) {
      throw new AppError(
        422,
        "No pending interview assessment found. Schedule an interview first.",
      );
    }

    // Load pipeline config for all-steps-done check
    const scpConfig = await prisma.scpProgramConfig.findUnique({
      where: {
        uq_scp_program_configs_type: {
          schoolYearId: applicant.schoolYearId,
          scpType: applicant.applicantType as any,
        },
      },
      include: {
        steps: { where: { isRequired: true }, orderBy: { stepOrder: "asc" } },
      },
    });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.applicantAssessment.update({
        where: { id: interviewAssessment.id },
        data: {
          score: interviewScore ?? null,
          result: interviewResult ?? null,
          notes: interviewNotes ?? null,
          conductedAt: new Date(),
        },
      });

      // Check if all required steps are done
      const allAssessments = await tx.applicantAssessment.findMany({
        where: { applicantId },
      });

      const requiredSteps = scpConfig?.steps ?? [];
      const allRequiredDone = requiredSteps.every((step) =>
        allAssessments.some(
          (a) =>
            a.stepOrder === step.stepOrder &&
            (a.conductedAt != null || a.result != null || a.score != null),
        ),
      );

      const newStatus = allRequiredDone
        ? "ASSESSMENT_TAKEN"
        : "ASSESSMENT_SCHEDULED";

      return tx.applicant.update({
        where: { id: applicantId },
        data: { status: newStatus },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "INTERVIEW_RESULT_RECORDED",
      description: `Recorded interview result for ${applicant.firstName} ${applicant.lastName} (#${applicantId}): ${interviewResult || "N/A"}`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// â"€â"€ Mark as passed (Clearing for section assignment) â"€â"€

// -- Mark interview as passed -> PRE_REGISTERED --
export async function markInterviewPassed(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    assertTransition(
      applicant,
      "PRE_REGISTERED",
      `Cannot mark interview as passed. Current status: "${applicant.status}". Only INTERVIEW_SCHEDULED applications can proceed.`,
    );

    // Find the interview assessment record
    const interviewAssessment = await prisma.applicantAssessment.findFirst({
      where: { applicantId, type: "INTERVIEW" },
      orderBy: { createdAt: "desc" },
    });

    const updated = await prisma.$transaction(async (tx) => {
      if (interviewAssessment) {
        await tx.applicantAssessment.update({
          where: { id: interviewAssessment.id },
          data: {
            result: "PASSED",
            conductedAt: new Date(),
          },
        });
      }

      return tx.applicant.update({
        where: { id: applicantId },
        data: { status: "PRE_REGISTERED" },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "INTERVIEW_PASSED",
      description: `Interview passed for ${applicant.firstName} ${applicant.lastName} (#${applicantId}). Status moved to PRE_REGISTERED.`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    await queueEmail(
      applicantId,
      applicant.emailAddress,
      `Interview Passed - ${applicant.trackingNumber}`,
      "APPLICATION_APPROVED",
    );

    res.json(updated);
  } catch (error) {
    next(error);
  }
}
export async function pass(req: Request, res: Response, next: NextFunction) {
  try {
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    assertTransition(
      applicant,
      "PASSED",
      `Cannot mark as passed. Current status: "${applicant.status}". Only ASSESSMENT_TAKEN applications can be marked as passed.`,
    );

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: "PASSED" },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_PASSED",
      description: `Marked ${applicant.firstName} ${applicant.lastName} (#${applicantId}) as PASSED - ready for section assignment`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    await queueEmail(
      applicantId,
      applicant.emailAddress,
      `Assessment Passed - ${applicant.trackingNumber}`,
      "ASSESSMENT_PASSED",
    );

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// â"€â"€ Mark as not qualified â"€â"€
export async function fail(req: Request, res: Response, next: NextFunction) {
  try {
    const { examNotes } = req.body;
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    assertTransition(
      applicant,
      "NOT_QUALIFIED",
      `Cannot mark as not qualified. Current status: "${applicant.status}". Only ASSESSMENT_TAKEN applications can be marked as not qualified.`,
    );

    // Store failure notes on the latest assessment and update status
    const updated = await prisma.$transaction(async (tx) => {
      if (examNotes) {
        const latestAssessment = await tx.applicantAssessment.findFirst({
          where: { applicantId },
          orderBy: { createdAt: "desc" },
        });
        if (latestAssessment) {
          await tx.applicantAssessment.update({
            where: { id: latestAssessment.id },
            data: { notes: examNotes },
          });
        }
      }

      return tx.applicant.update({
        where: { id: applicantId },
        data: { status: "NOT_QUALIFIED" },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_FAILED",
      description: `Marked ${applicant.firstName} ${applicant.lastName} (#${applicantId}) as NOT_QUALIFIED. Notes: ${examNotes || "N/A"}`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    await queueEmail(
      applicantId,
      applicant.emailAddress,
      `Assessment Result — ${applicant.trackingNumber}`,
      "ASSESSMENT_FAILED",
    );

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// — Get application timeline (audit history) —
export async function getTimeline(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const applicantId = parseInt(String(req.params.id));
    await findApplicantOrThrow(applicantId);

    const timeline = await prisma.auditLog.findMany({
      where: {
        subjectType: "Applicant",
        recordId: applicantId,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ timeline });
  } catch (error) {
    next(error);
  }
}

// — Offer regular section (for failed SCP applicants) —
export async function offerRegular(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { sectionId } = req.body;
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    // Only allow offering regular section to NOT_QUALIFIED SCP applicants
    if (applicant.status !== "NOT_QUALIFIED") {
      throw new AppError(
        422,
        `Cannot offer regular section. Current status: "${applicant.status}". Only NOT_QUALIFIED applications can be offered a regular section.`,
      );
    }

    if (applicant.applicantType === "REGULAR") {
      throw new AppError(
        422,
        "This applicant is already in the regular program.",
      );
    }

    const originalType = applicant.applicantType;

    const result = await prisma.$transaction(async (tx) => {
      // Lock section for capacity check
      const [section] = await tx.$queryRaw<
        { id: number; maxCapacity: number }[]
      >`
        SELECT id, "max_capacity" as "maxCapacity" FROM "sections" WHERE id = ${sectionId} FOR UPDATE
      `;

      if (!section) throw new AppError(404, "Section not found");

      const enrolledCount = await tx.enrollment.count({ where: { sectionId } });
      if (enrolledCount >= section.maxCapacity) {
        throw new AppError(422, "This section has reached maximum capacity");
      }

      // Update applicant to REGULAR type and create enrollment
      await tx.applicant.update({
        where: { id: applicantId },
        data: {
          applicantType: "REGULAR",
          status: "PRE_REGISTERED",
        },
      });

      const enrollment = await tx.enrollment.create({
        data: {
          applicantId,
          sectionId,
          schoolYearId: applicant.schoolYearId,
          enrolledById: req.user!.userId,
        },
      });

      return enrollment;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "OFFER_REGULAR_SECTION",
      description: `Converted ${applicant.firstName} ${applicant.lastName} (#${applicantId}) from ${originalType} to REGULAR and assigned to section ${sectionId}`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    await queueEmail(
      applicantId,
      applicant.emailAddress,
      `Regular Section Placement — ${applicant.trackingNumber}`,
      "APPLICATION_APPROVED",
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
}

// — Navigate to prev/next application —
export async function navigate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const currentId = parseInt(String(req.params.id));
    const direction = req.query.direction as "prev" | "next";
    const { status, gradeLevelId, applicantType, search } = req.query;

    if (!direction || !["prev", "next"].includes(direction)) {
      throw new AppError(400, 'Direction must be "prev" or "next"');
    }

    // Build the same filter as the list
    const where: Prisma.ApplicantWhereInput = {};

    // Scope to active School Year by default
    const settings = await prisma.schoolSetting.findFirst({
      select: { activeSchoolYearId: true },
    });
    if (settings?.activeSchoolYearId) {
      where.schoolYearId = settings.activeSchoolYearId;
    }

    if (search) {
      const s = String(search);
      where.OR = [
        { lrn: { contains: s, mode: "insensitive" } },
        { firstName: { contains: s, mode: "insensitive" } },
        { lastName: { contains: s, mode: "insensitive" } },
        { trackingNumber: { contains: s, mode: "insensitive" } },
      ];
    }
    if (gradeLevelId) where.gradeLevelId = parseInt(String(gradeLevelId));
    if (status && status !== "ALL")
      where.status = status as Prisma.EnumApplicationStatusFilter;
    if (applicantType && applicantType !== "ALL")
      where.applicantType = applicantType as Prisma.EnumApplicantTypeFilter;

    // Get ordered list of IDs
    const applications = await prisma.applicant.findMany({
      where,
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    const ids = applications.map((a) => a.id);
    const currentIndex = ids.indexOf(currentId);

    if (currentIndex === -1) {
      throw new AppError(404, "Current application not found in list");
    }

    let targetId: number | null = null;
    if (direction === "prev" && currentIndex > 0) {
      targetId = ids[currentIndex - 1];
    } else if (direction === "next" && currentIndex < ids.length - 1) {
      targetId = ids[currentIndex + 1];
    }

    res.json({
      currentIndex,
      totalCount: ids.length,
      previousId: currentIndex > 0 ? ids[currentIndex - 1] : null,
      nextId: currentIndex < ids.length - 1 ? ids[currentIndex + 1] : null,
      targetId,
    });
  } catch (error) {
    next(error);
  }
}

// — Get sections for section assignment dialog —
export async function getSectionsForAssignment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      include: { gradeLevel: true },
    });
    if (!applicant) throw new AppError(404, "Applicant not found");

    const sections = await prisma.section.findMany({
      where: { gradeLevelId: applicant.gradeLevelId },
      include: {
        advisingTeacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
        _count: { select: { enrollments: true } },
      },
      orderBy: { name: "asc" },
    });

    const formatted = sections.map((s) => ({
      id: s.id,
      name: s.name,
      maxCapacity: s.maxCapacity,
      enrolledCount: s._count.enrollments,
      availableSlots: s.maxCapacity - s._count.enrollments,
      fillPercent:
        s.maxCapacity > 0
          ? Math.round((s._count.enrollments / s.maxCapacity) * 100)
          : 0,
      isFull: s._count.enrollments >= s.maxCapacity,
      isNearFull: s._count.enrollments >= s.maxCapacity * 0.8,
      advisingTeacher: s.advisingTeacher
        ? {
            id: s.advisingTeacher.id,
            name: `${s.advisingTeacher.lastName}, ${s.advisingTeacher.firstName}${s.advisingTeacher.middleName ? ` ${s.advisingTeacher.middleName.charAt(0)}.` : ""}`,
          }
        : null,
    }));

    res.json({
      applicant: {
        id: applicant.id,
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        gradeLevelId: applicant.gradeLevelId,
        gradeLevelName: applicant.gradeLevel.name,
      },
      sections: formatted,
    });
  } catch (error) {
    next(error);
  }
}

// — Update application info —
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const applicantId = parseInt(String(req.params.id));

    // Whitelist editable fields to prevent status/tracking/schoolYear tampering
    const {
      firstName,
      middleName,
      lastName,
      suffix,
      lrn,
      sex,
      birthDate,
      placeOfBirth,
      motherTongue,
      religion,
      emailAddress,
      isIpCommunity,
      ipGroupName,
      is4PsBeneficiary,
      householdId4Ps,
      gradeLevelId,
      applicantType,
      studentPhoto,
      psaBirthCertNumber,
      learnerType,
    } = req.body;

    const data: Prisma.ApplicantUpdateInput = {
      firstName,
      middleName,
      lastName,
      suffix,
      lrn,
      sex,
      birthDate: birthDate
        ? normalizeDateToUtcNoon(new Date(birthDate))
        : undefined,
      placeOfBirth,
      motherTongue,
      religion,
      emailAddress,
      isIpCommunity,
      ipGroupName,
      is4PsBeneficiary,
      householdId4Ps,
      applicantType,
      studentPhoto,
      psaBirthCertNumber,
      learnerType,
    };

    // Only set gradeLevelId if provided (relation connect)
    if (gradeLevelId !== undefined) {
      data.gradeLevel = { connect: { id: gradeLevelId } };
    }

    // Strip undefined values so Prisma doesn't overwrite unmentioned fields
    for (const key of Object.keys(data) as (keyof typeof data)[]) {
      if (data[key] === undefined) delete data[key];
    }

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data,
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_UPDATED",
      description: `Updated application info for ${updated.firstName} ${updated.lastName} (#${applicantId})`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// — Show detailed application info —
export async function showDetailed(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const application = await prisma.applicant.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      include: {
        gradeLevel: true,
        schoolYear: true,
        addresses: true,
        familyMembers: true,
        previousSchool: true,
        assessments: { orderBy: { createdAt: "desc" } },
        programDetail: true,
        documents: {
          include: {
            uploadedBy: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
        },
        checklist: {
          include: {
            updatedBy: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
        },
        encodedBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        enrollment: {
          include: {
            section: {
              include: {
                advisingTeacher: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
            enrolledBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        emailLogs: {
          orderBy: { attemptedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!application) throw new AppError(404, "Application not found");

    // Fetch audit logs for the applicant
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        subjectType: "Applicant",
        recordId: application.id,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(await flattenAssessmentData({ ...application, auditLogs }));
  } catch (error) {
    next(error);
  }
}

// — Reschedule assessment —
export async function rescheduleAssessmentStep(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { stepOrder, kind, scheduledDate, scheduledTime, venue } = req.body;
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    // Create a new assessment record for the reschedule
    const updated = await prisma.$transaction(async (tx) => {
      await tx.applicantAssessment.create({
        data: {
          applicantId,
          type: (kind || "QUALIFYING_EXAMINATION") as any,
          stepOrder: stepOrder ?? null,
          scheduledDate: normalizeDateToUtcNoon(new Date(scheduledDate)),
          scheduledTime: scheduledTime || null,
          venue: venue || null,
          notes: "Rescheduled",
        },
      });

      return tx.applicant.update({
        where: { id: applicantId },
        data: { status: "ASSESSMENT_SCHEDULED" },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "ASSESSMENT_RESCHEDULED",
      description: `Rescheduled step ${stepOrder ?? "?"} (${kind || "WRITTEN_EXAM"}) for ${applicant.firstName} ${applicant.lastName} (#${applicantId}) to ${scheduledDate}`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// Legacy alias
export const rescheduleExam = rescheduleAssessmentStep;

// ── Batch Process Registration ──

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

    // Fetch all applicants in a single query
    const applicants = await prisma.applicant.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        status: true,
        firstName: true,
        lastName: true,
        trackingNumber: true,
      },
    });

    const foundIds = new Set(applicants.map((a) => a.id));

    const succeeded: Array<{
      id: number;
      name: string;
      trackingNumber: string;
      previousStatus: string;
    }> = [];
    const failed: Array<{
      id: number;
      name: string;
      trackingNumber: string;
      reason: string;
    }> = [];

    // Categorize: valid transitions vs invalid
    const validApplicants: typeof applicants = [];

    for (const id of ids) {
      if (!foundIds.has(id)) {
        failed.push({
          id,
          name: "Unknown",
          trackingNumber: "",
          reason: "Applicant not found",
        });
        continue;
      }

      const applicant = applicants.find((a) => a.id === id)!;
      const allowedTransitions = VALID_TRANSITIONS[applicant.status] ?? [];

      if (!allowedTransitions.includes(targetStatus)) {
        failed.push({
          id: applicant.id,
          name: `${applicant.lastName}, ${applicant.firstName}`,
          trackingNumber: applicant.trackingNumber,
          reason: `Cannot transition from "${applicant.status}" to "${targetStatus}"`,
        });
        continue;
      }

      validApplicants.push(applicant);
    }

    // Execute all valid transitions in a single atomic transaction
    if (validApplicants.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const applicant of validApplicants) {
          await tx.applicant.update({
            where: { id: applicant.id },
            data: { status: targetStatus },
          });
        }
      });

      // Record successes
      for (const applicant of validApplicants) {
        succeeded.push({
          id: applicant.id,
          name: `${applicant.lastName}, ${applicant.firstName}`,
          trackingNumber: applicant.trackingNumber,
          previousStatus: applicant.status,
        });
      }

      // Audit log each successful transition (non-critical, outside transaction)
      for (const applicant of validApplicants) {
        auditLog({
          userId: req.user!.userId,
          actionType: "STATUS_CHANGED",
          description: `Batch: ${applicant.firstName} ${applicant.lastName} (#${applicant.id}) status changed from ${applicant.status} to ${targetStatus}`,
          subjectType: "Applicant",
          recordId: applicant.id,
          req,
        }).catch(() => {});
      }
    }

    res.json({
      processed: ids.length,
      succeeded,
      failed,
    });
  } catch (error) {
    next(error);
  }
}
