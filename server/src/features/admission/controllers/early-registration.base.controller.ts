import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../lib/AppError.js";
import {
  Prisma,
  type ApplicationStatus,
  type ApplicantType,
  type LearnerType,
  type FamilyRelationship,
  type AdmissionChannel,
} from "../../../generated/prisma/index.js";
import type { AdmissionControllerDeps } from "../services/admission-controller.deps.js";
import { createAdmissionControllerDeps } from "../services/admission-controller.deps.js";
import {
  createEarlyRegistrationSharedService,
  createInitialTrackingPayload,
  normalizeTrackingStatus,
} from "../services/early-registration-shared.service.js";
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
    resolveLinkedEarlyRegistration,
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
      const take = parseInt(limit as string);

      // 1. Resolve School Year ID
      let syId: number | undefined;
      if (schoolYearId) {
        syId = parseInt(String(schoolYearId));
      } else {
        const settings = await prisma.schoolSetting.findFirst({
          select: { activeSchoolYearId: true },
        });
        syId = settings?.activeSchoolYearId || undefined;
      }

      // 2. Build Status Filters for Raw SQL
      const statusFilters = (Array.isArray(status) ? status : [status])
        .flatMap((value) => String(value ?? "").split(","))
        .map((value) => value.trim())
        .filter((value) => value.length > 0 && value !== "ALL")
        .filter((value): value is ApplicationStatus => Boolean(value));

      // 3. Execution: Unified Raw Query for ID and Metadata
      // We use raw SQL to handle UNION ALL + cross-table pagination + complex filters efficiently.
      // This ensures READY_FOR_ENROLLMENT Phase 1 apps are visible in Phase 2 queue.

      const searchPattern = search ? `%${String(search)}%` : null;
      const gradeId = gradeLevelId ? parseInt(String(gradeLevelId)) : null;

      const results = await prisma.$queryRaw<
        { id: number; source: "ENROLLMENT" | "EARLY_REGISTRATION" }[]
      >`
        WITH base_queue AS (
          -- Phase 2: Official Enrollment Applications
          SELECT 
            id, 
            created_at, 
            'ENROLLMENT'::text as source,
            status,
            applicant_type,
            grade_level_id,
            school_year_id,
            tracking_number,
            learner_id
          FROM enrollment_applications
          WHERE 1=1
            ${syId ? Prisma.sql`AND school_year_id = ${syId}` : Prisma.empty}
            ${gradeId ? Prisma.sql`AND grade_level_id = ${gradeId}` : Prisma.empty}
            ${statusFilters.length > 0 ? Prisma.sql`AND status::text IN (${Prisma.join(statusFilters)})` : Prisma.empty}
            ${applicantType && applicantType !== "ALL" ? Prisma.sql`AND applicant_type::text = ${applicantType}` : Prisma.empty}
            ${isTruthyQuery(withoutSection) ? Prisma.sql`AND NOT EXISTS (SELECT 1 FROM enrollment_records WHERE enrollment_application_id = enrollment_applications.id)` : Prisma.empty}
            ${isTruthyQuery(withSection) || status === "ENROLLED" || status === "OFFICIALLY_ENROLLED" ? Prisma.sql`AND EXISTS (SELECT 1 FROM enrollment_records WHERE enrollment_application_id = enrollment_applications.id)` : Prisma.empty}

          UNION ALL

          -- Phase 1: Early Registration Applications (Queued for Phase 2)
          -- ONLY include if NOT yet migrated to an enrollment_application record.
          SELECT 
            id, 
            created_at, 
            'EARLY_REGISTRATION'::text as source,
            status,
            applicant_type,
            grade_level_id,
            school_year_id,
            tracking_number,
            learner_id
          FROM early_registration_applications e
          WHERE 1=1
            AND NOT EXISTS (SELECT 1 FROM enrollment_applications WHERE early_registration_id = e.id)
            ${syId ? Prisma.sql`AND school_year_id = ${syId}` : Prisma.empty}
            ${gradeId ? Prisma.sql`AND grade_level_id = ${gradeId}` : Prisma.empty}
            ${statusFilters.length > 0 ? Prisma.sql`AND status::text IN (${Prisma.join(statusFilters)})` : Prisma.empty}
            ${applicantType && applicantType !== "ALL" ? Prisma.sql`AND applicant_type::text = ${applicantType}` : Prisma.empty}
            -- Early reg apps NEVER have enrollment records (Phase 2 only)
            ${isTruthyQuery(withSection) || status === "ENROLLED" || status === "OFFICIALLY_ENROLLED" ? Prisma.sql`AND 1=0` : Prisma.empty}
        ),
        filtered_queue AS (
          SELECT q.* FROM base_queue q
          JOIN learners l ON q.learner_id = l.id
          WHERE 1=1
            ${
              searchPattern
                ? Prisma.sql`AND (
                l.lrn ILIKE ${searchPattern} OR 
                l.first_name ILIKE ${searchPattern} OR 
                l.last_name ILIKE ${searchPattern} OR 
                q.tracking_number ILIKE ${searchPattern}
              )`
                : Prisma.empty
            }
            ${
              isTruthyQuery(withoutLrn)
                ? Prisma.sql`AND l.is_pending_lrn_creation = true`
                : Prisma.empty
            }
        )
        SELECT id, source::text as source
        FROM filtered_queue
        ORDER BY created_at DESC
        LIMIT ${take} OFFSET ${skip}
      `;

      const [{ count: totalCount }] = await prisma.$queryRaw<
        { count: bigint }[]
      >`
        WITH base_queue AS (
          SELECT id, learner_id, tracking_number FROM enrollment_applications
          WHERE 1=1
            ${syId ? Prisma.sql`AND school_year_id = ${syId}` : Prisma.empty}
            ${gradeId ? Prisma.sql`AND grade_level_id = ${gradeId}` : Prisma.empty}
            ${statusFilters.length > 0 ? Prisma.sql`AND status::text IN (${Prisma.join(statusFilters)})` : Prisma.empty}
            ${applicantType && applicantType !== "ALL" ? Prisma.sql`AND applicant_type::text = ${applicantType}` : Prisma.empty}
            ${isTruthyQuery(withoutSection) ? Prisma.sql`AND NOT EXISTS (SELECT 1 FROM enrollment_records WHERE enrollment_application_id = enrollment_applications.id)` : Prisma.empty}
            ${isTruthyQuery(withSection) || status === "ENROLLED" || status === "OFFICIALLY_ENROLLED" ? Prisma.sql`AND EXISTS (SELECT 1 FROM enrollment_records WHERE enrollment_application_id = enrollment_applications.id)` : Prisma.empty}

          UNION ALL

          SELECT id, learner_id, tracking_number FROM early_registration_applications e
          WHERE 1=1
            AND NOT EXISTS (SELECT 1 FROM enrollment_applications WHERE early_registration_id = e.id)
            ${syId ? Prisma.sql`AND school_year_id = ${syId}` : Prisma.empty}
            ${gradeId ? Prisma.sql`AND grade_level_id = ${gradeId}` : Prisma.empty}
            ${statusFilters.length > 0 ? Prisma.sql`AND status::text IN (${Prisma.join(statusFilters)})` : Prisma.empty}
            ${applicantType && applicantType !== "ALL" ? Prisma.sql`AND applicant_type::text = ${applicantType}` : Prisma.empty}
            ${isTruthyQuery(withSection) || status === "ENROLLED" || status === "OFFICIALLY_ENROLLED" ? Prisma.sql`AND 1=0` : Prisma.empty}
        )
        SELECT COUNT(*) as count FROM base_queue q
        JOIN learners l ON q.learner_id = l.id
        WHERE 1=1
          ${
            searchPattern
              ? Prisma.sql`AND (
              l.lrn ILIKE ${searchPattern} OR 
              l.first_name ILIKE ${searchPattern} OR 
              l.last_name ILIKE ${searchPattern} OR 
              q.tracking_number ILIKE ${searchPattern}
            )`
              : Prisma.empty
          }
          ${
            isTruthyQuery(withoutLrn)
              ? Prisma.sql`AND l.is_pending_lrn_creation = true`
              : Prisma.empty
          }
      `;

      // 4. Hydrate Results with Prisma (to maintain include logic)
      const enrollmentIds = results
        .filter((r) => r.source === "ENROLLMENT")
        .map((r) => r.id);
      const earlyRegIds = results
        .filter((r) => r.source === "EARLY_REGISTRATION")
        .map((r) => r.id);

      const [enrollmentApps, earlyRegApps] = await Promise.all([
        prisma.enrollmentApplication.findMany({
          where: { id: { in: enrollmentIds } },
          include: {
            learner: true,
            gradeLevel: true,
            enrollmentRecord: { include: { section: true } },
            programDetail: true,
            earlyRegistration: {
              include: { assessments: { orderBy: { createdAt: "desc" } } },
            },
          },
        }),
        prisma.earlyRegistrationApplication.findMany({
          where: { id: { in: earlyRegIds } },
          include: {
            learner: true,
            gradeLevel: true,
            assessments: { orderBy: { createdAt: "desc" } },
          },
        }),
      ]);

      // Combine and Restore Original Sort Order
      const appsMap = new Map<string, any>();
      enrollmentApps.forEach((a) => appsMap.set(`ENROLLMENT-${a.id}`, a));
      earlyRegApps.forEach((a) => appsMap.set(`EARLY_REGISTRATION-${a.id}`, a));

      const sortedApps = results
        .map((r) => {
          const app = appsMap.get(`${r.source}-${r.id}`);
          if (app) {
            app._sourceTable = r.source; // Add metadata for internal identification
          }
          return app;
        })
        .filter(Boolean);

      res.json({
        applications: await Promise.all(
          sortedApps.map((app) => flattenAssessmentData(app)),
        ),
        total: Number(totalCount),
        page: parseInt(page as string),
        limit: take,
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

        if (
          (earlyReg.status === "SUBMITTED" ||
            earlyReg.status === "EARLY_REG_SUBMITTED") &&
          canStartReview
        ) {
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
  ): Promise<
    {
      trackingNumber: string;
      applicantType: ApplicantType;
    } & ReturnType<typeof createInitialTrackingPayload>
  > {
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

    // 5. Determine applicant type
    let applicantType: ApplicantType = "REGULAR";
    if (body.isScpApplication && body.scpType) {
      applicantType = body.scpType;
    }

    const { linkedEarlyRegistrationId } = await resolveLinkedEarlyRegistration({
      requestedEarlyRegistrationId: body.earlyRegistrationId,
      activeSchoolYearId: activeYear.id,
      submittedLrn: lrn,
      expectedApplicantType: applicantType,
    });

    if (applicantType !== "REGULAR" && !linkedEarlyRegistrationId) {
      throw new AppError(
        422,
        "SCP applicants must complete Early Registration and run LRN lookup before final enrollment.",
      );
    }

    if (lrn) {
      const [existingByLrn, existingEarlyRegByLrn] = await Promise.all([
        prisma.enrollmentApplication.findFirst({
          where: { learner: { lrn }, schoolYearId: activeYear.id },
        }),
        prisma.earlyRegistrationApplication.findFirst({
          where: { learner: { lrn }, schoolYearId: activeYear.id },
          select: { id: true, trackingNumber: true },
        }),
      ]);

      if (existingByLrn) {
        throw new AppError(
          409,
          `An enrollment application with LRN ${lrn} already exists for this School Year. Tracking number: ${existingByLrn.trackingNumber}.`,
        );
      }

      if (
        existingEarlyRegByLrn &&
        existingEarlyRegByLrn.id !== linkedEarlyRegistrationId
      ) {
        throw new AppError(
          409,
          `An early registration with LRN ${lrn} already exists for this School Year. Tracking number: ${existingEarlyRegByLrn.trackingNumber}.`,
        );
      }
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

        // Online enrollment no longer requires grade payload fields to be present.
        // If grades are provided, they are still validated against configured thresholds.
        const submittedGeneralAverage =
          typeof body.generalAverage === "number" &&
          Number.isFinite(body.generalAverage)
            ? body.generalAverage
            : null;

        if (
          reqs.minGeneralAverage != null &&
          submittedGeneralAverage != null &&
          submittedGeneralAverage < reqs.minGeneralAverage
        ) {
          failures.push(
            `General Average must be at least ${reqs.minGeneralAverage} (submitted: ${submittedGeneralAverage})`,
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

            if (submitted == null) {
              continue;
            }

            if (submitted < sr.minGrade) {
              failures.push(
                `${sr.subject} grade must be at least ${sr.minGrade} (submitted: ${submitted})`,
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
    const guardianFirstName = body.guardian?.firstName?.trim();
    const guardianLastName = body.guardian?.lastName?.trim();
    if (guardianFirstName && guardianLastName) {
      familyData.push({
        relationship: "GUARDIAN",
        firstName: guardianFirstName,
        lastName: guardianLastName,
        middleName: body.guardian?.middleName?.trim() || null,
        contactNumber: body.guardian?.contactNumber?.trim() || null,
        email: body.guardian?.email?.trim() || null,
        occupation: body.guardian?.occupation?.trim() || null,
      });
    }

    // Ensure learner exists or update
    const learnerPayload = {
      lrn,
      isPendingLrnCreation: hasNoLrnDeclared && !lrn,
      psaBirthCertNumber: body.psaBirthCertNumber?.trim().toUpperCase() || null,
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
          earlyRegistrationId: linkedEarlyRegistrationId,
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
          // Reuse existing checklist if early registration is linked
          ...(linkedEarlyRegistrationId ? {} : { checklist: { create: {} } }),
        },
        include: { learner: true },
      });

      if (linkedEarlyRegistrationId) {
        // Link existing checklist to the new enrollment application
        const existingChecklist = await tx.applicationChecklist.findUnique({
          where: { earlyRegistrationId: linkedEarlyRegistrationId },
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
              earlyRegistrationId: linkedEarlyRegistrationId,
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
    if (linkedEarlyRegistrationId) {
      const nextEarlyRegStatus: ApplicationStatus = "PRE_REGISTERED";

      await prisma.earlyRegistrationApplication.update({
        where: { id: linkedEarlyRegistrationId },
        data: {
          status: nextEarlyRegStatus,
        },
      });
    }

    return {
      trackingNumber,
      applicantType: application.applicantType,
      ...createInitialTrackingPayload(application.applicantType),
    };
  }

  /** Wrap known Prisma constraint errors into user-safe AppError responses. */
  function rethrowPrismaKnown(error: unknown): never {
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

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2003"
    ) {
      const fieldName = String(
        (error as { meta?: { field_name?: string } }).meta?.field_name ?? "",
      );
      if (fieldName.includes("early_registration_id")) {
        throw new AppError(
          422,
          "The selected early registration record is invalid or outdated. Please run LRN lookup again.",
        );
      }

      throw new AppError(
        409,
        "The request references related data that no longer exists.",
      );
    }

    throw error;
  }

  // ── Submit new application (public) ──
  async function store(req: Request, res: Response, next: NextFunction) {
    try {
      const submission = await submitApplication(req, {
        channel: "ONLINE",
        trackingPrefix: "ENR",
        encodedById: null,
      });
      res.status(201).json(submission);
    } catch (error) {
      try {
        rethrowPrismaKnown(error);
      } catch (mapped) {
        next(mapped);
      }
    }
  }

  // ── Submit F2F walk-in application (authenticated - REGISTRAR/SYSTEM_ADMIN) ──
  async function storeF2F(req: Request, res: Response, next: NextFunction) {
    try {
      const submission = await submitApplication(req, {
        channel: "F2F",
        trackingPrefix: "F2F-ENR",
        encodedById: req.user!.userId,
      });
      res.status(201).json(submission);
    } catch (error) {
      try {
        rethrowPrismaKnown(error);
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

      const flattened = (await flattenAssessmentData(application!)) as Record<
        string,
        any
      >;
      const rawStatus = String(
        flattened.status ?? "PENDING_VERIFICATION",
      ).toUpperCase();
      const status = normalizeTrackingStatus(
        flattened.trackingStatus ?? rawStatus,
      );

      res.json({
        ...flattened,
        status,
        rawStatus,
      });
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
              status: {
                in: [
                  "EARLY_REG_SUBMITTED",
                  "PRE_REGISTERED",
                  "PENDING_VERIFICATION",
                  "READY_FOR_SECTIONING",
                  "SUBMITTED",
                  "VERIFIED",
                  "UNDER_REVIEW",
                  "FOR_REVISION",
                  "ELIGIBLE",
                  "EXAM_SCHEDULED",
                  "ASSESSMENT_TAKEN",
                  "PASSED",
                  "INTERVIEW_SCHEDULED",
                  "READY_FOR_ENROLLMENT",
                  "TEMPORARILY_ENROLLED",
                  "FAILED_ASSESSMENT",
                ],
              },
            },
            include: {
              familyMembers: true,
              addresses: true,
              gradeLevel: { select: { name: true } },
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
      const currentAddress = reg.addresses.find(
        (address) => address.addressType === "CURRENT",
      );
      const permanentAddress = reg.addresses.find(
        (address) => address.addressType === "PERMANENT",
      );
      const normalizedGradeLevel =
        normalizeGradeLevelToken(reg.gradeLevel?.name) ||
        normalizeGradeLevelToken(reg.gradeLevelId);

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
        gradeLevel: normalizedGradeLevel,
        learnerType: reg.learnerType,
        applicantType: reg.applicantType,
        contactNumber: reg.contactNumber,
        email: reg.email,
        primaryContact: reg.primaryContact,
        guardianRelationship: reg.guardianRelationship,
        hasNoMother: reg.hasNoMother,
        hasNoFather: reg.hasNoFather,
        currentAddress: currentAddress
          ? {
              houseNo: currentAddress.houseNoStreet,
              street: currentAddress.sitio,
              barangay: currentAddress.barangay,
              cityMunicipality: currentAddress.cityMunicipality,
              province: currentAddress.province,
            }
          : null,
        permanentAddress: permanentAddress
          ? {
              houseNo: permanentAddress.houseNoStreet,
              street: permanentAddress.sitio,
              barangay: permanentAddress.barangay,
              cityMunicipality: permanentAddress.cityMunicipality,
              province: permanentAddress.province,
            }
          : null,
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
