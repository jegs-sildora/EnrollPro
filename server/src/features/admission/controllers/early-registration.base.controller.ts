import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../lib/AppError.js";
import type {
  ApplicationStatus,
  ApplicantType,
  Prisma,
  LearnerType,
  FamilyRelationship,
  AdmissionChannel,
} from "../../../generated/prisma/index.js";
import type { AdmissionControllerDeps } from "../services/admission-controller.deps.js";
import { createAdmissionControllerDeps } from "../services/admission-controller.deps.js";
import { createEarlyRegistrationSharedService } from "../services/early-registration-shared.service.js";
import { getSCPRankings } from "../services/scp-ranking.service.js";

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
  const {
    flattenAssessmentData,
    queueEmail,
    toUpperCaseRecursive,
    findApplicantOrThrow,
  } = createEarlyRegistrationSharedService(deps);

  const LRN_REGEX = /^\d{12}$/;

  function isTruthyQuery(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return (
        normalized === "true" || normalized === "1" || normalized === "yes"
      );
    }
    return false;
  }

  function normalizeGradeLevelToken(value: unknown): string {
    const raw = String(value ?? "").trim();
    const digitMatch = raw.match(/\d+/);
    return digitMatch?.[0] ?? raw;
  }

  async function getRequirements(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant } = await findApplicantOrThrow(applicantId);

      let documentRequirements: Array<{
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
          select: { gradeRequirements: true },
        });

        if (scpConfig?.gradeRequirements) {
          const payload = scpConfig.gradeRequirements as {
            documentRequirements?: Array<{
              docId: string;
              policy: "REQUIRED" | "OPTIONAL" | "HIDDEN";
              phase?: "EARLY_REGISTRATION" | "ENROLLMENT" | null;
              notes?: string | null;
            }>;
          };

          if (Array.isArray(payload.documentRequirements)) {
            documentRequirements = payload.documentRequirements;
          }
        }
      }

      const requirements = getRequiredDocuments({
        learnerType: applicant.learnerType,
        gradeLevel: applicant.gradeLevel.name,
        applicantType: applicant.applicantType,
        isLwd: applicant.learner?.isLearnerWithDisability ?? false,
        isPeptAePasser: false,
        documentRequirements,
      });

      res.json({ requirements });
    } catch (error) {
      next(error);
    }
  }

  // ── List all enrollment applications (paginated, filterable) ──
  async function index(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        search,
        gradeLevelId,
        status,
        applicantType,
        schoolYearId,
        withoutLrn,
        withoutSection,
        withSection,
        page = "1",
        limit = "15",
      } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const where: Prisma.EnrollmentApplicationWhereInput = {};

      // Scope to specified or active School Year
      if (schoolYearId) {
        where.schoolYearId = parseInt(String(schoolYearId));
      } else {
        const settings = await prisma.schoolSetting.findFirst({
          select: { activeSchoolYearId: true },
        });
        if (settings?.activeSchoolYearId) {
          where.schoolYearId = settings.activeSchoolYearId;
        }
      }

      if (search) {
        const s = String(search);
        where.OR = [
          { learner: { lrn: { contains: s, mode: "insensitive" } } },
          { learner: { firstName: { contains: s, mode: "insensitive" } } },
          { learner: { lastName: { contains: s, mode: "insensitive" } } },
          { trackingNumber: { contains: s, mode: "insensitive" } },
        ];
      }
      if (gradeLevelId) where.gradeLevelId = parseInt(String(gradeLevelId));
      if (status && status !== "ALL")
        where.status = status as ApplicationStatus;

      if (isTruthyQuery(withoutSection)) {
        where.enrollmentRecord = { is: null };
      } else if (isTruthyQuery(withSection) || status === "ENROLLED") {
        where.enrollmentRecord = { isNot: null };
      }

      if (applicantType && applicantType !== "ALL")
        where.applicantType = applicantType as Prisma.EnumApplicantTypeFilter;

      if (isTruthyQuery(withoutLrn)) {
        where.AND = [
          ...(Array.isArray(where.AND)
            ? where.AND
            : where.AND
              ? [where.AND]
              : []),
          { learner: { isPendingLrnCreation: true } },
        ];
      }

      const [applications, total] = await Promise.all([
        prisma.enrollmentApplication.findMany({
          where,
          include: {
            learner: true,
            gradeLevel: true,
            enrollmentRecord: { include: { section: true } },
            programDetail: true,
            // Enrollment applications might not have assessments directly anymore,
            // they might link to early registration assessments.
            // For now, let's keep it if they exist, but the new schema moved them to early registration.
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: parseInt(limit as string),
        }),
        prisma.enrollmentApplication.count({ where }),
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

  // ── Show single enrollment application ──
  async function show(req: Request, res: Response, next: NextFunction) {
    try {
      const application = await prisma.enrollmentApplication.findUnique({
        where: { id: parseInt(String(req.params.id)) },
        include: {
          learner: true,
          gradeLevel: true,
          schoolYear: true,
          addresses: true,
          familyMembers: true,
          previousSchool: true,
          programDetail: true,
          earlyRegistration: {
            include: {
              assessments: { orderBy: { createdAt: "desc" } },
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
          enrollmentRecord: {
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

      if (!application) {
        // Fallback: check early registration table
        const earlyReg = await prisma.earlyRegistrationApplication.findUnique({
          where: { id: parseInt(String(req.params.id)) },
          include: {
            learner: true,
            gradeLevel: true,
            schoolYear: true,
            familyMembers: true,
            addresses: true,
            assessments: { orderBy: { createdAt: "desc" } },
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
            verifiedBy: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
        });

        if (!earlyReg) throw new AppError(404, "Application not found");

        const canStartReview =
          req.user?.role === "REGISTRAR" || req.user?.role === "SYSTEM_ADMIN";

        if (earlyReg.status === "SUBMITTED" && canStartReview) {
          await prisma.earlyRegistrationApplication.update({
            where: { id: earlyReg.id },
            data: { status: "UNDER_REVIEW" },
          });
          earlyReg.status = "UNDER_REVIEW";

          await auditLog({
            userId: req.user!.userId,
            actionType: "APPLICATION_REVIEWED",
            description: `Started reviewing early registration application for ${earlyReg.learner.firstName} ${earlyReg.learner.lastName}`,
            subjectType: "EarlyRegistrationApplication",
            recordId: earlyReg.id,
            req,
          });
        }

        return res.json(await flattenAssessmentData(earlyReg));
      }

      // Automatically transition to UNDER_REVIEW when opened by registrar/admin
      const canStartReview =
        req.user?.role === "REGISTRAR" || req.user?.role === "SYSTEM_ADMIN";
      if (application.status === "SUBMITTED" && canStartReview) {
        await prisma.enrollmentApplication.update({
          where: { id: application.id },
          data: { status: "UNDER_REVIEW" },
        });
        application.status = "UNDER_REVIEW";

        await auditLog({
          userId: req.user!.userId,
          actionType: "APPLICATION_REVIEWED",
          description: `Started reviewing enrollment application for ${application.learner.firstName} ${application.learner.lastName}`,
          subjectType: "EnrollmentApplication",
          recordId: application.id,
          req,
        });
      }

      res.json(await flattenAssessmentData(application!));
    } catch (error) {
      next(error);
    }
  }

  // ── Shared application builder ──

  interface SubmitOptions {
    channel: AdmissionChannel;
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
        "Enrollment is currently closed. Please check back during the enrollment period.",
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
    const bodyLType = String(body.learnerType).toUpperCase();
    let lType: LearnerType = "NEW_ENROLLEE";
    if (bodyLType === "TRANSFEREE") lType = "TRANSFEREE";
    else if (bodyLType === "RETURNING" || bodyLType === "BALIK_ARAL")
      lType = "RETURNING";
    else if (bodyLType === "CONTINUING") lType = "CONTINUING";
    else if (bodyLType === "OSCYA") lType = "OSCYA";
    else if (bodyLType === "ALS") lType = "ALS";

    const rawLrn = String(body.lrn ?? "").trim();
    const hasNoLrnDeclared = body.hasNoLrn === true;
    const normalizedGradeLevel = normalizeGradeLevelToken(body.gradeLevel);
    const canSubmitWithoutLrn =
      lType === "TRANSFEREE" ||
      (lType === "NEW_ENROLLEE" && normalizedGradeLevel === "7");

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

    const lrn = hasNoLrnDeclared ? null : rawLrn || null;
    if (!hasNoLrnDeclared && !lrn) {
      throw new AppError(
        422,
        "LRN is required unless you declare that the learner has no LRN.",
      );
    }

    if (lrn && !LRN_REGEX.test(lrn)) {
      throw new AppError(422, "LRN must be exactly 12 numeric digits.");
    }

    if (lrn) {
      const [existingByLrn, existingEarlyRegByLrn] = await Promise.all([
        prisma.enrollmentApplication.findFirst({
          where: { learner: { lrn }, schoolYearId: activeYear.id },
        }),
        prisma.earlyRegistrationApplication.findFirst({
          where: { learner: { lrn }, schoolYearId: activeYear.id },
        }),
      ]);

      if (existingByLrn) {
        throw new AppError(
          409,
          `An enrollment application with LRN ${lrn} already exists for this School Year. Tracking number: ${existingByLrn.trackingNumber}.`,
        );
      }

      if (existingEarlyRegByLrn) {
        throw new AppError(
          409,
          `An early registration with LRN ${lrn} already exists for this School Year. Tracking number: ${existingEarlyRegByLrn.trackingNumber}.`,
        );
      }
    }

    // 5. Determine applicant type
    let applicantType: ApplicantType = "REGULAR";
    if (body.isScpApplication && body.scpType) {
      applicantType = body.scpType;
    }

    // 5b. SCP grade-gate validation
    if (applicantType !== "REGULAR") {
      const scpConfig = await prisma.scpProgramConfig.findFirst({
        where: {
          schoolYearId: activeYear.id,
          scpType: applicantType,
          isOffered: true,
        },
        select: { gradeRequirements: true },
      });

      if (scpConfig?.gradeRequirements) {
        const reqs = scpConfig.gradeRequirements as {
          minGeneralAverage?: number;
          subjectRequirements?: { subject: string; minGrade: number }[];
        };
        const failures: string[] = [];

        if (
          reqs.minGeneralAverage != null &&
          (body.generalAverage == null ||
            body.generalAverage < reqs.minGeneralAverage)
        ) {
          failures.push(
            `General Average must be at least ${reqs.minGeneralAverage} (submitted: ${body.generalAverage ?? "none"})`,
          );
        }

        if (reqs.subjectRequirements) {
          const gradeMap: Record<string, number | null | undefined> = {
            SCIENCE: body.g10ScienceGrade,
            MATH: body.grade10MathGrade,
          };
          for (const sr of reqs.subjectRequirements) {
            const key = sr.subject.toUpperCase();
            const submitted = gradeMap[key];
            if (submitted == null || submitted < sr.minGrade) {
              failures.push(
                `${sr.subject} grade must be at least ${sr.minGrade} (submitted: ${submitted ?? "none"})`,
              );
            }
          }
        }

        if (failures.length > 0) {
          throw new AppError(
            422,
            `Grade requirements not met for ${applicantType.replace(/_/g, " ")}: ${failures.join("; ")}`,
          );
        }
      }
    }

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
    const addressData: Prisma.ApplicationAddressCreateManyInput[] = [];
    if (body.currentAddress) {
      addressData.push({ addressType: "CURRENT", ...body.currentAddress });
    }
    if (body.permanentAddress) {
      addressData.push({ addressType: "PERMANENT", ...body.permanentAddress });
    }

    // Build nested family member data
    const familyData: Prisma.ApplicationFamilyMemberCreateManyInput[] = [];
    if (body.mother)
      familyData.push({ relationship: "MOTHER", ...body.mother });
    if (body.father)
      familyData.push({ relationship: "FATHER", ...body.father });
    if (body.guardian)
      familyData.push({ relationship: "GUARDIAN", ...body.guardian });

    // Ensure learner exists or update
    const learnerPayload = {
      lrn,
      isPendingLrnCreation: hasNoLrnDeclared && !lrn,
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
      is4PsBeneficiary: body.is4PsBeneficiary ?? false,
      householdId4Ps: body.is4PsBeneficiary ? body.householdId4Ps : null,
    };

    const application = await prisma.$transaction(async (tx) => {
      let learner: { id: number };
      if (lrn) {
        learner = await tx.learner.upsert({
          where: { lrn },
          update: learnerPayload,
          create: learnerPayload,
          select: { id: true },
        });
      } else {
        learner = await tx.learner.create({
          data: learnerPayload,
          select: { id: true },
        });
      }

      const createdApplication = await tx.enrollmentApplication.create({
        data: {
          learnerId: learner.id,
          earlyRegistrationId: body.earlyRegistrationId || null,
          studentPhoto: studentPhotoUrl,
          learningModalities: body.learningModalities || [],

          // Enrollment preferences
          learnerType: lType,
          isPrivacyConsentGiven: body.isPrivacyConsentGiven ?? false,
          guardianRelationship: body.guardian?.relationship || null,
          hasNoMother: body.hasNoMother ?? false,
          hasNoFather: body.hasNoFather ?? false,

          // Relations
          gradeLevelId: gradeLevel.id,
          schoolYearId: activeYear.id,
          applicantType,
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
          // Reuse existing checklist if earlyRegistrationId is provided
          ...(body.earlyRegistrationId ? {} : { checklist: { create: {} } }),
        },
        include: { learner: true },
      });

      if (body.earlyRegistrationId) {
        // Link existing checklist to the new enrollment application
        const existingChecklist = await tx.applicationChecklist.findUnique({
          where: { earlyRegistrationId: body.earlyRegistrationId },
        });

        if (existingChecklist) {
          await tx.applicationChecklist.update({
            where: { id: existingChecklist.id },
            data: { enrollmentId: createdApplication.id },
          });
        } else {
          // Create new checklist linked to both
          await tx.applicationChecklist.create({
            data: {
              enrollmentId: createdApplication.id,
              earlyRegistrationId: body.earlyRegistrationId,
            },
          });
        }
      }

      return createdApplication;
    });

    // Generate proper tracking number from ID
    let prefix = "REG";
    if (application.applicantType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") {
      prefix = "STE";
    } else if (application.applicantType === "SPECIAL_PROGRAM_IN_THE_ARTS") {
      prefix = "SPA";
    } else if (application.applicantType === "SPECIAL_PROGRAM_IN_SPORTS") {
      prefix = "SPS";
    } else if (application.applicantType === "SPECIAL_PROGRAM_IN_JOURNALISM") {
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

    const trackingNumber = `${prefix}-${year}-${String(application.id).padStart(5, "0")}`;
    await prisma.enrollmentApplication.update({
      where: { id: application.id },
      data: { trackingNumber },
    });

    // Audit log
    const logPrefix =
      options.channel === "F2F"
        ? `${req.user!.role} encoded F2F walk-in enrollment application for`
        : `Guest submitted enrollment application for`;
    await auditLog({
      userId: options.encodedById,
      actionType:
        options.channel === "F2F"
          ? "F2F_APPLICATION_SUBMITTED"
          : "APPLICATION_SUBMITTED",
      description: `${logPrefix} ${application.learner.firstName} ${application.learner.lastName}${lrn ? ` (LRN: ${lrn})` : hasNoLrnDeclared ? " (PENDING LRN CREATION)" : ""}. Tracking: ${trackingNumber}`,
      subjectType: "EnrollmentApplication",
      recordId: application.id,
      req,
    });

    await queueEmail(
      application.id,
      body.email,
      `Enrollment Application Received - ${trackingNumber}`,
      "APPLICATION_SUBMITTED",
    );

    // Link early registration if provided
    if (body.earlyRegistrationId) {
      const nextEarlyRegStatus: ApplicationStatus = hasNoLrnDeclared
        ? "TEMPORARILY_ENROLLED"
        : "ENROLLED";

      await prisma.earlyRegistrationApplication.update({
        where: { id: body.earlyRegistrationId },
        data: {
          status: nextEarlyRegStatus,
        },
      });
    }

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
        throw new AppError(
          409,
          "An enrollment application with this LRN already exists.",
        );
      }
      throw new AppError(
        409,
        "A duplicate enrollment application was detected.",
      );
    }
    throw error;
  }

  // ── Submit new application (public) ──
  async function store(req: Request, res: Response, next: NextFunction) {
    try {
      const trackingNumber = await submitApplication(req, {
        channel: "ONLINE",
        trackingPrefix: "ENR",
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
        trackingPrefix: "F2F-ENR",
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
      const trackingNumber = String(req.params.trackingNumber);
      let application = await prisma.enrollmentApplication.findUnique({
        where: { trackingNumber },
        include: {
          learner: true,
          gradeLevel: true,
          schoolYear: true,
          addresses: true,
          familyMembers: true,
          previousSchool: true,
          programDetail: true,
          earlyRegistration: {
            include: {
              assessments: { orderBy: { createdAt: "desc" } },
            },
          },
          enrollmentRecord: {
            include: { section: true },
          },
        },
      });

      if (!application) {
        // Fallback: Check early registration applications
        const earlyReg = await prisma.earlyRegistrationApplication.findUnique({
          where: { trackingNumber },
          include: {
            learner: true,
            gradeLevel: true,
            schoolYear: true,
            familyMembers: true,
            addresses: true,
            assessments: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        });

        if (!earlyReg) {
          throw new AppError(
            404,
            "No application found with this tracking number.",
          );
        }
        application = earlyReg as any;
      }

      res.json(await flattenAssessmentData(application!));
    } catch (error) {
      next(error);
    }
  }

  // ── LRN lookup: pre-fill enrollment form from early registration data ──
  async function lookupByLrn(req: Request, res: Response, next: NextFunction) {
    try {
      const lrn = String(req.params.lrn).trim();
      if (!/^\d{12}$/.test(lrn)) {
        throw new AppError(400, "LRN must be exactly 12 numeric digits.");
      }

      // Find active school year
      const settings = await prisma.schoolSetting.findFirst({
        select: { activeSchoolYearId: true },
      });
      if (!settings?.activeSchoolYearId) {
        throw new AppError(400, "No active School Year configured.");
      }

      const learner = await prisma.learner.findUnique({
        where: { lrn },
        include: {
          earlyRegistrationApplications: {
            where: {
              schoolYearId: settings.activeSchoolYearId,
              status: { in: ["PASSED", "PRE_REGISTERED"] },
            },
            include: {
              familyMembers: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!learner || learner.earlyRegistrationApplications.length === 0) {
        throw new AppError(
          404,
          "No eligible early registration found for this LRN in the current School Year.",
        );
      }

      const reg = learner.earlyRegistrationApplications[0];

      // Map family members to father/mother/guardian fields
      const father = reg.familyMembers.find((g) => g.relationship === "FATHER");
      const mother = reg.familyMembers.find((g) => g.relationship === "MOTHER");
      const guardian = reg.familyMembers.find(
        (g) => g.relationship === "GUARDIAN",
      );

      res.json({
        earlyRegistrationId: reg.id,
        lrn: learner.lrn,
        psaBirthCertNumber: learner.psaBirthCertNumber,
        firstName: learner.firstName,
        lastName: learner.lastName,
        middleName: learner.middleName,
        extensionName: learner.extensionName,
        birthdate: learner.birthdate,
        sex: learner.sex,
        religion: learner.religion,
        isIpCommunity: learner.isIpCommunity,
        ipGroupName: learner.ipGroupName,
        isLearnerWithDisability: learner.isLearnerWithDisability,
        disabilityTypes: learner.disabilityTypes,
        specialNeedsCategory: learner.specialNeedsCategory,
        hasPwdId: learner.hasPwdId,
        isBalikAral: learner.isBalikAral,
        lastYearEnrolled: learner.lastYearEnrolled,
        lastGradeLevel: learner.lastGradeLevel,
        is4PsBeneficiary: learner.is4PsBeneficiary,
        householdId4Ps: learner.householdId4Ps,
        // Demographic fields from learner table
        gradeLevel: reg.gradeLevelId, // Send ID or Name? Usually form needs something it can resolve
        learnerType: reg.learnerType,
        applicantType: reg.applicantType,
        contactNumber: reg.contactNumber,
        email: reg.email,
        father: father
          ? {
              lastName: father.lastName,
              firstName: father.firstName,
              middleName: father.middleName,
              contactNumber: father.contactNumber,
              email: father.email,
            }
          : undefined,
        mother: mother
          ? {
              lastName: mother.lastName,
              firstName: mother.firstName,
              middleName: mother.middleName,
              contactNumber: mother.contactNumber,
              email: mother.email,
            }
          : undefined,
        guardian: guardian
          ? {
              lastName: guardian.lastName,
              firstName: guardian.firstName,
              middleName: guardian.middleName,
              contactNumber: guardian.contactNumber,
              email: guardian.email,
            }
          : undefined,
      });
    } catch (error) {
      next(error);
    }
  }

  // ── SCP Rankings ──
  async function getRankings(req: Request, res: Response, next: NextFunction) {
    try {
      const { scpType, schoolYearId } = req.query;

      if (!scpType) {
        throw new AppError(400, "scpType query parameter is required.");
      }

      // Resolve school year — fallback to active
      let syId: number;
      if (schoolYearId) {
        syId = parseInt(String(schoolYearId));
        if (isNaN(syId)) throw new AppError(400, "Invalid schoolYearId.");
      } else {
        const settings = await prisma.schoolSetting.findFirst({
          select: { activeSchoolYearId: true },
        });
        if (!settings?.activeSchoolYearId) {
          throw new AppError(400, "No active School Year configured.");
        }
        syId = settings.activeSchoolYearId;
      }

      const rankings = await getSCPRankings(
        syId,
        scpType as ApplicantType,
        prisma,
      );

      res.json({ rankings, total: rankings.length });
    } catch (error) {
      next(error);
    }
  }

  // ── Approve + Enroll ──
  return {
    getRequirements,
    index,
    show,
    store,
    storeF2F,
    track,
    lookupByLrn,
    getRankings,
  };
}

const baseController = createEarlyRegistrationBaseController();

export const getRequirements = baseController.getRequirements;
export const index = baseController.index;
export const show = baseController.show;
export const store = baseController.store;
export const storeF2F = baseController.storeF2F;
export const track = baseController.track;
export const lookupByLrn = baseController.lookupByLrn;
export const getRankings = baseController.getRankings;
