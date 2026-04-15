import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../lib/AppError.js";
import type { ApplicationStatus, Prisma } from "../../../generated/prisma";
import type { AdmissionControllerDeps } from "../services/admission-controller.deps.js";
import { createAdmissionControllerDeps } from "../services/admission-controller.deps.js";
import { createEarlyRegistrationSharedService } from "../services/early-registration-shared.service.js";

export function createEarlyRegistrationBaseController(
  deps: AdmissionControllerDeps = createAdmissionControllerDeps(),
) {
  const {
    prisma,
    saveBase64Image,
    auditLog,
    isEnrollmentOpen,
    normalizeDateToUtcNoon,
    getRequiredDocuments,
  } = deps;
  const { flattenAssessmentData, queueEmail, toUpperCaseRecursive } =
    createEarlyRegistrationSharedService(deps);
  async function getRequirements(
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

      let dynamicDocumentRequirements: Array<{
        docId: string;
        policy: "REQUIRED" | "OPTIONAL" | "HIDDEN";
        phase?: "EARLY_REGISTRATION" | "ENROLLMENT" | null;
        notes?: string | null;
      }> | null = null;

      if (applicant.applicantType !== "REGULAR") {
        const scpConfig = await prisma.scpProgramConfig.findUnique({
          where: {
            uq_scp_program_configs_type: {
              schoolYearId: applicant.schoolYearId,
              scpType: applicant.applicantType,
            },
          },
          select: { documentRequirements: true },
        });

        if (Array.isArray(scpConfig?.documentRequirements)) {
          dynamicDocumentRequirements =
            scpConfig.documentRequirements as Array<{
              docId: string;
              policy: "REQUIRED" | "OPTIONAL" | "HIDDEN";
              phase?: "EARLY_REGISTRATION" | "ENROLLMENT" | null;
              notes?: string | null;
            }>;
        }
      }

      const requirements = getRequiredDocuments({
        learnerType: applicant.learnerType,
        gradeLevel: applicant.gradeLevel.name,
        applicantType: applicant.applicantType,
        isLwd: applicant.isLearnerWithDisability,
        isPeptAePasser: false,
        documentRequirements: dynamicDocumentRequirements,
      });

      res.json({ requirements });
    } catch (error) {
      next(error);
    }
  }

  // ── List all applications (paginated, filterable) ──
  async function index(req: Request, res: Response, next: NextFunction) {
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
      if (status && status !== "ALL")
        where.status = status as ApplicationStatus;
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
  async function show(req: Request, res: Response, next: NextFunction) {
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
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          },
          checklist: {
            include: {
              updatedBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
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
      if (
        application.status === "SUBMITTED" &&
        req.user?.role === "REGISTRAR"
      ) {
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
    const familyData: Prisma.ApplicantFamilyMemberCreateManyApplicantInput[] =
      [];
    if (body.mother)
      familyData.push({ relationship: "MOTHER", ...body.mother });
    if (body.father)
      familyData.push({ relationship: "FATHER", ...body.father });
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
        hasPwdId: body.isLearnerWithDisability
          ? (body.hasPwdId ?? false)
          : false,
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
  async function store(req: Request, res: Response, next: NextFunction) {
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
  async function storeF2F(req: Request, res: Response, next: NextFunction) {
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
  async function track(req: Request, res: Response, next: NextFunction) {
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
  return { getRequirements, index, show, store, storeF2F, track };
}

const baseController = createEarlyRegistrationBaseController();

export const getRequirements = baseController.getRequirements;
export const index = baseController.index;
export const show = baseController.show;
export const store = baseController.store;
export const storeF2F = baseController.storeF2F;
export const track = baseController.track;
