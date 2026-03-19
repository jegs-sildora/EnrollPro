import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { auditLog } from "../services/auditLogger.js";
import { isEnrollmentOpen } from "../services/enrollmentGateService.js";
import type { ApplicationStatus } from "@prisma/client";

// â"€â"€ Valid status transitions â"€â"€
const VALID_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "REJECTED", "WITHDRAWN"],
  UNDER_REVIEW: [
    "FOR_REVISION",
    "ELIGIBLE",
    "PRE_REGISTERED",
    "REJECTED",
    "WITHDRAWN",
  ],
  FOR_REVISION: ["UNDER_REVIEW", "WITHDRAWN"],
  ELIGIBLE: ["ASSESSMENT_SCHEDULED", "PRE_REGISTERED", "WITHDRAWN"],
  ASSESSMENT_SCHEDULED: ["ASSESSMENT_TAKEN", "WITHDRAWN"],
  ASSESSMENT_TAKEN: ["PASSED", "NOT_QUALIFIED", "WITHDRAWN"],
  PASSED: ["PRE_REGISTERED", "WITHDRAWN"],
  PRE_REGISTERED: ["ENROLLED", "WITHDRAWN"],
  NOT_QUALIFIED: ["UNDER_REVIEW", "WITHDRAWN", "REJECTED"],
  ENROLLED: ["WITHDRAWN"],
  REJECTED: ["UNDER_REVIEW", "WITHDRAWN"],
  WITHDRAWN: [],
};

/**
 * Recursively converts all string values in an object to uppercase and trims them.
 */
function toUpperCaseRecursive(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map((v) => toUpperCaseRecursive(v));
  } else if (
    obj !== null &&
    typeof obj === "object" &&
    !(obj instanceof Date)
  ) {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = toUpperCaseRecursive(obj[key]);
    }
    return newObj;
  } else if (typeof obj === "string") {
    return obj.trim().toUpperCase();
  }
  return obj;
}

function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// â"€â"€ List all applications (paginated, filterable) â"€â"€
export async function index(req: Request, res: Response) {
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

    const where: any = {};

    // Scope to active academic year by default
    const settings = await prisma.schoolSettings.findFirst({
      select: { activeAcademicYearId: true },
    });
    if (settings?.activeAcademicYearId) {
      where.academicYearId = settings.activeAcademicYearId;
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
    if (status && status !== "ALL") where.status = status;
    if (applicantType && applicantType !== "ALL")
      where.applicantType = applicantType;

    const [applications, total] = await Promise.all([
      prisma.applicant.findMany({
        where,
        include: {
          gradeLevel: true,
          strand: true,
          enrollment: { include: { section: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.applicant.count({ where }),
    ]);

    res.json({
      applications,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (error: any) {
    console.error("[ApplicationIndex]", error);
    res.status(500).json({ message: error.message });
  }
}

// — Show single application —
export async function show(req: Request, res: Response) {
  try {
    const application = await prisma.applicant.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      include: {
        gradeLevel: true,
        strand: true,
        academicYear: true,
        encodedBy: { select: { id: true, name: true, role: true } },
        enrollment: {
          include: {
            section: {
              include: {
                advisingTeacher: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
            enrolledBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Automatically transition to UNDER_REVIEW when opened by registrar
    if (application.status === "SUBMITTED" && req.user?.role === "REGISTRAR") {
      await prisma.applicant.update({
        where: { id: application.id },
        data: { status: "UNDER_REVIEW" },
      });
      application.status = "UNDER_REVIEW";

      // Log the status change
      await auditLog({
        userId: req.user.userId,
        actionType: "APPLICATION_REVIEWED",
        description: `Started reviewing application for ${application.firstName} ${application.lastName}`,
        subjectType: "Applicant",
        subjectId: application.id,
        req,
      });
    }

    res.json(application);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// â"€â"€ Submit new application (public) â"€â"€
export async function store(req: Request, res: Response) {
  try {
    // 1. Find active academic year
    const settings = await prisma.schoolSettings.findFirst({
      include: { activeAcademicYear: true },
    });

    if (!settings?.activeAcademicYear) {
      return res.status(400).json({
        message:
          "No active academic year configured. Enrollment is not available.",
      });
    }

    const activeYear = settings.activeAcademicYear;

    // 2. Check enrollment gate
    if (!isEnrollmentOpen(activeYear)) {
      return res.status(400).json({
        message:
          "Enrollment is currently closed. Please check back during the enrollment period.",
      });
    }

    const body = toUpperCaseRecursive(req.body);

    // 3. Resolve grade level
    const gradeLevel = await prisma.gradeLevel.findFirst({
      where: {
        academicYearId: activeYear.id,
        name: { contains: body.gradeLevel, mode: "insensitive" },
      },
    });

    if (!gradeLevel) {
      return res.status(400).json({
        message: `Grade ${body.gradeLevel} is not available for the current academic year.`,
      });
    }

    // 4. Check duplicate LRN in same academic year (if LRN provided)
    if (body.lrn) {
      const existingByLrn = await prisma.applicant.findFirst({
        where: {
          lrn: body.lrn,
          academicYearId: activeYear.id,
        },
      });

      if (existingByLrn) {
        return res.status(409).json({
          message: `An application with LRN ${body.lrn} already exists for this academic year. Your tracking number is ${existingByLrn.trackingNumber}.`,
        });
      }
    }

    // 5. Resolve SHS track and strand (for G11)
    let strandId: number | null = null;
    let shsTrack: "ACADEMIC" | "TECHPRO" | null = null;

    if (body.gradeLevel === "11" && body.shsTrack) {
      shsTrack = body.shsTrack === "ACADEMIC" ? "ACADEMIC" : "TECHPRO";

      if (body.electiveCluster) {
        const strand = await prisma.strand.findFirst({
          where: {
            academicYearId: activeYear.id,
            name: { contains: body.electiveCluster, mode: "insensitive" },
          },
        });
        if (strand) {
          strandId = strand.id;
        }
      }
    }

    // 6. Determine applicant type
    let applicantType: string = "REGULAR";
    if (body.scpApplication && body.scpType) {
      applicantType = body.scpType;
    } else if (body.gradeLevel === "11" && body.electiveCluster === "AC-STEM") {
      applicantType = "STEM_GRADE11";
    }

    // 7. Build parent contact info (primary contact for quick access)
    const motherContact = body.mother?.contactNumber;
    const fatherContact = body.father?.contactNumber;
    const guardianContact = body.guardian?.contactNumber;
    const emailAddress = body.email || null;

    // 8. Parse birthdate
    const birthDate = new Date(body.birthdate);
    if (isNaN(birthDate.getTime())) {
      return res.status(400).json({ message: "Invalid birthdate format." });
    }

    // 9. Create applicant with a temporary tracking number (will update after ID is known)
    const year = new Date().getFullYear();
    const tempTracking = `APP-${year}-TEMP-${Date.now()}`;

    const applicant = await prisma.applicant.create({
      data: {
        lrn: body.lrn || null,
        psaBcNumber: body.psaBcNumber || null,
        lastName: body.lastName,
        firstName: body.firstName,
        middleName: body.middleName || null,
        suffix: body.extensionName || null,
        birthDate,
        sex: body.sex === "MALE" ? "MALE" : "FEMALE",
        placeOfBirth: body.placeOfBirth || null,
        religion: body.religion || null,

        // Address as JSON
        currentAddress: body.currentAddress,
        permanentAddress: body.permanentAddress || null,

        // Parent/guardian as JSON
        motherName: body.mother,
        fatherName: body.father,
        guardianInfo: body.guardian || null,
        emailAddress,

        // Background classifications
        isIpCommunity: body.isIpCommunity ?? false,
        ipGroupName: body.isIpCommunity ? body.ipGroupName : null,
        is4PsBeneficiary: body.is4PsBeneficiary ?? false,
        householdId4Ps: body.is4PsBeneficiary ? body.householdId4Ps : null,
        isBalikAral: body.isBalikAral ?? false,
        lastYearEnrolled: body.isBalikAral ? body.lastYearEnrolled : null,
        isLearnerWithDisability: body.isLearnerWithDisability ?? false,
        snedCategory: body.isLearnerWithDisability
          ? body.snedCategory || null
          : null,
        hasPwdId: body.isLearnerWithDisability
          ? (body.hasPwdId ?? false)
          : false,
        disabilityType: body.isLearnerWithDisability
          ? body.disabilityType || []
          : [],

        // Previous school
        lastSchoolName: body.lastSchoolName?.trim() || null,
        lastSchoolId: body.lastSchoolId?.trim() || null,
        lastGradeCompleted: body.lastGradeCompleted || null,
        syLastAttended: body.syLastAttended || null,
        lastSchoolAddress: body.lastSchoolAddress?.trim() || null,
        lastSchoolType: body.lastSchoolType || null,

        // Enrollment preferences
        learnerType: body.learnerType || null,
        learningModalities: body.learningModalities || [],
        electiveCluster: body.electiveCluster || null,
        scpApplication: body.scpApplication ?? false,
        scpType: body.scpApplication ? body.scpType : null,
        spaArtField: body.scpType === "SPA" ? body.spaArtField : null,
        spsSports: body.scpType === "SPS" ? body.spsSports || [] : [],
        spflLanguage: body.scpType === "SPFL" ? body.spflLanguage : null,

        // Grades (STEM G11)
        grade10ScienceGrade: body.g10ScienceGrade ?? null,
        grade10MathGrade: body.g10MathGrade ?? null,

        // Relations
        gradeLevelId: gradeLevel.id,
        strandId,
        academicYearId: activeYear.id,
        applicantType: applicantType as any,
        shsTrack: shsTrack as any,
        trackingNumber: tempTracking,
      },
    });

    // 10. Generate proper tracking number from ID
    const trackingNumber = `APP-${year}-${String(applicant.id).padStart(5, "0")}`;
    await prisma.applicant.update({
      where: { id: applicant.id },
      data: { trackingNumber },
    });

    // 11. Audit log
    await auditLog({
      userId: null,
      actionType: "APPLICATION_SUBMITTED",
      description: `Guest submitted application for ${applicant.firstName} ${applicant.lastName}${body.lrn ? ` (LRN: ${body.lrn})` : ""}. Tracking: ${trackingNumber}`,
      subjectType: "Applicant",
      subjectId: applicant.id,
      req,
    });

    // 12. Create email log entry (email sending is async / background)
    if (emailAddress) {
      try {
        await prisma.emailLog.create({
          data: {
            recipient: emailAddress,
            subject: `Application Received - ${trackingNumber}`,
            trigger: "APPLICATION_SUBMITTED",
            status: "PENDING",
            applicantId: applicant.id,
          },
        });
      } catch {
        // Non-critical - don't fail the submission
      }
    }

    res.status(201).json({ trackingNumber });
  } catch (error: any) {
    console.error("[ApplicationStore]", error);

    // Handle Prisma unique constraint violations
    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (target?.includes("lrn")) {
        return res
          .status(409)
          .json({ message: "An application with this LRN already exists." });
      }
      return res
        .status(409)
        .json({ message: "A duplicate application was detected." });
    }

    res
      .status(500)
      .json({ message: "Failed to submit application. Please try again." });
  }
}

// â"€â"€ Submit F2F walk-in application (authenticated - REGISTRAR/SYSTEM_ADMIN) â"€â"€
export async function storeF2F(req: Request, res: Response) {
  try {
    // 1. Find active academic year
    const settings = await prisma.schoolSettings.findFirst({
      include: { activeAcademicYear: true },
    });

    if (!settings?.activeAcademicYear) {
      return res.status(400).json({
        message:
          "No active academic year configured. Enrollment is not available.",
      });
    }

    const activeYear = settings.activeAcademicYear;

    // 2. Check enrollment gate
    if (!isEnrollmentOpen(activeYear)) {
      return res.status(400).json({
        message:
          "Enrollment is currently closed. Please check back during the enrollment period.",
      });
    }

    const body = toUpperCaseRecursive(req.body);

    // 3. Resolve grade level
    const gradeLevel = await prisma.gradeLevel.findFirst({
      where: {
        academicYearId: activeYear.id,
        name: { contains: body.gradeLevel, mode: "insensitive" },
      },
    });

    if (!gradeLevel) {
      return res.status(400).json({
        message: `Grade ${body.gradeLevel} is not available for the current academic year.`,
      });
    }

    // 4. Check duplicate LRN in same academic year (if LRN provided)
    if (body.lrn) {
      const existingByLrn = await prisma.applicant.findFirst({
        where: {
          lrn: body.lrn,
          academicYearId: activeYear.id,
        },
      });

      if (existingByLrn) {
        return res.status(409).json({
          message: `An application with LRN ${body.lrn} already exists for this academic year. Tracking number: ${existingByLrn.trackingNumber}.`,
        });
      }
    }

    // 5. Resolve SHS track and strand (for G11)
    let strandId: number | null = null;
    let shsTrack: "ACADEMIC" | "TECHPRO" | null = null;

    if (body.gradeLevel === "11" && body.shsTrack) {
      shsTrack = body.shsTrack === "ACADEMIC" ? "ACADEMIC" : "TECHPRO";

      if (body.electiveCluster) {
        const strand = await prisma.strand.findFirst({
          where: {
            academicYearId: activeYear.id,
            name: { contains: body.electiveCluster, mode: "insensitive" },
          },
        });
        if (strand) {
          strandId = strand.id;
        }
      }
    }

    // 6. Determine applicant type
    let applicantType: string = "REGULAR";
    if (body.scpApplication && body.scpType) {
      applicantType = body.scpType;
    } else if (body.gradeLevel === "11" && body.electiveCluster === "AC-STEM") {
      applicantType = "STEM_GRADE11";
    }

    // 7. Build parent contact info (primary contact for quick access)
    const emailAddress = body.email || null;

    // 8. Parse birthdate
    const birthDate = new Date(body.birthdate);
    if (isNaN(birthDate.getTime())) {
      return res.status(400).json({ message: "Invalid birthdate format." });
    }

    // 9. Create applicant with a temporary tracking number (will update after ID is known)
    const year = new Date().getFullYear();
    const tempTracking = `F2F-${year}-TEMP-${Date.now()}`;

    const applicant = await prisma.applicant.create({
      data: {
        lrn: body.lrn || null,
        psaBcNumber: body.psaBcNumber || null,
        lastName: body.lastName,
        firstName: body.firstName,
        middleName: body.middleName || null,
        suffix: body.extensionName || null,
        birthDate,
        sex: body.sex === "MALE" ? "MALE" : "FEMALE",
        placeOfBirth: body.placeOfBirth || null,
        religion: body.religion || null,

        // Address as JSON
        currentAddress: body.currentAddress,
        permanentAddress: body.permanentAddress || null,

        // Parent/guardian as JSON
        motherName: body.mother,
        fatherName: body.father,
        guardianInfo: body.guardian || null,
        emailAddress,

        // Background classifications
        isIpCommunity: body.isIpCommunity ?? false,
        ipGroupName: body.isIpCommunity ? body.ipGroupName : null,
        is4PsBeneficiary: body.is4PsBeneficiary ?? false,
        householdId4Ps: body.is4PsBeneficiary ? body.householdId4Ps : null,
        isBalikAral: body.isBalikAral ?? false,
        lastYearEnrolled: body.isBalikAral ? body.lastYearEnrolled : null,
        isLearnerWithDisability: body.isLearnerWithDisability ?? false,
        snedCategory: body.isLearnerWithDisability
          ? body.snedCategory || null
          : null,
        hasPwdId: body.isLearnerWithDisability
          ? (body.hasPwdId ?? false)
          : false,
        disabilityType: body.isLearnerWithDisability
          ? body.disabilityType || []
          : [],

        // Previous school
        lastSchoolName: body.lastSchoolName?.trim() || null,
        lastSchoolId: body.lastSchoolId?.trim() || null,
        lastGradeCompleted: body.lastGradeCompleted || null,
        syLastAttended: body.syLastAttended || null,
        lastSchoolAddress: body.lastSchoolAddress?.trim() || null,
        lastSchoolType: body.lastSchoolType || null,

        // Enrollment preferences
        learnerType: body.learnerType || null,
        learningModalities: body.learningModalities || [],
        electiveCluster: body.electiveCluster || null,
        scpApplication: body.scpApplication ?? false,
        scpType: body.scpApplication ? body.scpType : null,
        spaArtField: body.scpType === "SPA" ? body.spaArtField : null,
        spsSports: body.scpType === "SPS" ? body.spsSports || [] : [],
        spflLanguage: body.scpType === "SPFL" ? body.spflLanguage : null,

        // Grades (STEM G11)
        grade10ScienceGrade: body.g10ScienceGrade ?? null,
        grade10MathGrade: body.g10MathGrade ?? null,

        // Relations
        gradeLevelId: gradeLevel.id,
        strandId,
        academicYearId: activeYear.id,
        applicantType: applicantType as any,
        shsTrack: shsTrack as any,
        trackingNumber: tempTracking,

        // F2F EARLY REGISTRATION tracking
        admissionChannel: "F2F",
        encodedById: req.user!.userId,
      },
    });

    // 10. Generate proper tracking number from ID (F2F prefix)
    const trackingNumber = `F2F-${year}-${String(applicant.id).padStart(5, "0")}`;
    await prisma.applicant.update({
      where: { id: applicant.id },
      data: { trackingNumber },
    });

    // 11. Audit log with user info
    await auditLog({
      userId: req.user!.userId,
      actionType: "F2F_APPLICATION_SUBMITTED",
      description: `${req.user!.role} encoded F2F walk-in application for ${applicant.firstName} ${applicant.lastName}${body.lrn ? ` (LRN: ${body.lrn})` : ""}. Tracking: ${trackingNumber}`,
      subjectType: "Applicant",
      subjectId: applicant.id,
      req,
    });

    // 12. Create email log entry (email sending is async / background)
    if (emailAddress) {
      try {
        await prisma.emailLog.create({
          data: {
            recipient: emailAddress,
            subject: `Application Received - ${trackingNumber}`,
            trigger: "APPLICATION_SUBMITTED",
            status: "PENDING",
            applicantId: applicant.id,
          },
        });
      } catch {
        // Non-critical - don't fail the submission
      }
    }

    res.status(201).json({ trackingNumber });
  } catch (error: any) {
    console.error("[F2FApplicationStore]", error);

    // Handle Prisma unique constraint violations
    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (target?.includes("lrn")) {
        return res
          .status(409)
          .json({ message: "An application with this LRN already exists." });
      }
      return res
        .status(409)
        .json({ message: "A duplicate application was detected." });
    }

    res
      .status(500)
      .json({ message: "Failed to submit F2F application. Please try again." });
  }
}

// â"€â"€ Track application by tracking number (public) â"€â"€
export async function track(req: Request, res: Response) {
  try {
    const application = await prisma.applicant.findUnique({
      where: { trackingNumber: String(req.params.trackingNumber) },
      select: {
        trackingNumber: true,
        firstName: true,
        lastName: true,
        status: true,
        applicantType: true,
        createdAt: true,
        gradeLevel: { select: { name: true } },
        strand: { select: { name: true } },
        enrollment: {
          select: { section: { select: { name: true } }, enrolledAt: true },
        },
        examDate: true,
        rejectionReason: true,
        scpApplication: true,
        scpType: true,
      },
    });

    if (!application) {
      return res
        .status(404)
        .json({ message: "No application found with this tracking number." });
    }

    res.json(application);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// â"€â"€ Approve + Enroll â"€â"€
export async function approve(req: Request, res: Response) {
  try {
    const { sectionId } = req.body;
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });
    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    if (!canTransition(applicant.status, "PRE_REGISTERED")) {
      return res.status(422).json({
        message: `Cannot approve an application with status "${applicant.status}". Only UNDER_REVIEW, ELIGIBLE, or PASSED applications can be approved (moved to PRE_REGISTERED).`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const [section] = await tx.$queryRaw<any[]>`
        SELECT id, "maxCapacity" FROM "Section" WHERE id = ${sectionId} FOR UPDATE
      `;

      if (!section) throw new Error("Section not found");

      const enrolledCount = await tx.enrollment.count({ where: { sectionId } });
      if (enrolledCount >= section.maxCapacity) {
        throw new Error("This section has reached maximum capacity");
      }

      const enrollment = await tx.enrollment.create({
        data: {
          applicantId,
          sectionId,
          academicYearId: applicant.academicYearId,
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
      subjectId: applicantId,
      req,
    });

    // Queue email notification
    if (applicant.emailAddress) {
      try {
        await prisma.emailLog.create({
          data: {
            recipient: applicant.emailAddress,
            subject: `Application Approved - ${applicant.trackingNumber}`,
            trigger: "APPLICATION_APPROVED",
            status: "PENDING",
            applicantId,
          },
        });
      } catch {
        /* non-critical */
      }
    }

    res.json(result);
  } catch (error: any) {
    const status = error.message?.includes("capacity") ? 422 : 500;
    res.status(status).json({ message: error.message });
  }
}

// â"€â"€ Finalize Enrollment (Phase 2 complete) â"€â"€
export async function enroll(req: Request, res: Response) {
  try {
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });
    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    if (!canTransition(applicant.status, "ENROLLED")) {
      return res.status(422).json({
        message: `Cannot finalize enrollment. Current status: "${applicant.status}". Only PRE_REGISTERED applications can be enrolled.`,
      });
    }

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: "ENROLLED" },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_ENROLLED",
      description: `Finalized enrollment for ${applicant.firstName} ${applicant.lastName} (#${applicantId})`,
      subjectType: "Applicant",
      subjectId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// â"€â"€ Request Revision â"€â"€
export async function requestRevision(req: Request, res: Response) {
  try {
    const { message } = toUpperCaseRecursive(req.body);
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });
    if (!applicant)
      return res.status(404).json({ message: "Applicant not found" });

    if (!canTransition(applicant.status, "FOR_REVISION")) {
      return res.status(422).json({
        message: `Cannot request revision for status "${applicant.status}"`,
      });
    }

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: "FOR_REVISION" },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "REVISION_REQUESTED",
      description: `Requested revision for #${applicantId}. Message: ${message || "N/A"}`,
      subjectType: "Applicant",
      subjectId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// â"€â"€ Withdraw Application â"€â"€
export async function withdraw(req: Request, res: Response) {
  try {
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });
    if (!applicant)
      return res.status(404).json({ message: "Applicant not found" });

    if (!canTransition(applicant.status, "WITHDRAWN")) {
      return res.status(422).json({
        message: `Cannot withdraw application with status "${applicant.status}"`,
      });
    }

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: "WITHDRAWN" },
    });

    await auditLog({
      userId: req.user?.userId || null,
      actionType: "APPLICATION_WITHDRAWN",
      description: `Application #${applicantId} withdrawn`,
      subjectType: "Applicant",
      subjectId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// â"€â"€ Reject â"€â"€
export async function reject(req: Request, res: Response) {
  try {
    const rejectionReason = req.body.rejectionReason?.trim();
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });
    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    if (!canTransition(applicant.status, "REJECTED")) {
      return res.status(422).json({
        message: `Cannot reject an application with status "${applicant.status}".`,
      });
    }

    // Require reason when rejecting from FAILED/NOT_QUALIFIED state per UX spec
    if (applicant.status === "NOT_QUALIFIED" && !rejectionReason) {
      return res.status(400).json({
        message: "A rejection reason is required when the applicant is not qualified.",
      });
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
      subjectId: applicantId,
      req,
    });

    if (applicant.emailAddress) {
      try {
        await prisma.emailLog.create({
          data: {
            recipient: applicant.emailAddress,
            subject: `Application Update - ${applicant.trackingNumber}`,
            trigger: "APPLICATION_REJECTED",
            status: "PENDING",
            applicantId,
          },
        });
      } catch {
        /* non-critical */
      }
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// â"€â"€ Mark as eligible (cleared for assessment or regular approval) â"€â"€
export async function markEligible(req: Request, res: Response) {
  try {
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });
    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    if (!canTransition(applicant.status, "ELIGIBLE")) {
      return res.status(422).json({
        message: `Cannot mark as eligible. Current status: "${applicant.status}".`,
      });
    }

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: "ELIGIBLE" },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_ELIGIBLE",
      description: `Marked ${applicant.firstName} ${applicant.lastName} (#${applicantId}) as ELIGIBLE - docs verified`,
      subjectType: "Applicant",
      subjectId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// — Schedule assessment (SCP flow) —
export async function scheduleExam(req: Request, res: Response) {
  try {
    const body = toUpperCaseRecursive(req.body);
    const { examDate, assessmentType } = body;
    // examVenue should preserve case, not uppercase
    const examVenue = req.body.examVenue || null;
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });
    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    if (!canTransition(applicant.status, "ASSESSMENT_SCHEDULED")) {
      return res.status(422).json({
        message: `Cannot schedule assessment for application with status "${applicant.status}". Only ELIGIBLE applications can be scheduled.`,
      });
    }

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: {
        status: "ASSESSMENT_SCHEDULED",
        examDate: new Date(examDate),
        assessmentType,
        examVenue,
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EXAM_SCHEDULED",
      description: `Scheduled ${assessmentType} for ${applicant.firstName} ${applicant.lastName} (#${applicantId}) on ${examDate}${examVenue ? ` at ${examVenue}` : ""}`,
      subjectType: "Applicant",
      subjectId: applicantId,
      req,
    });

    if (applicant.emailAddress) {
      try {
        await prisma.emailLog.create({
          data: {
            recipient: applicant.emailAddress,
            subject: `Assessment Scheduled - ${applicant.trackingNumber}`,
            trigger: "EXAM_SCHEDULED",
            status: "PENDING",
            applicantId,
          },
        });
      } catch {
        /* non-critical */
      }
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// — Record assessment result —
export async function recordResult(req: Request, res: Response) {
  try {
    const body = toUpperCaseRecursive(req.body);
    const {
      examScore,
      examResult,
      examNotes,
      interviewResult,
      interviewNotes,
      auditionResult,
      tryoutResult,
      natScore,
    } = body;
    // Parse interview date if provided
    const interviewDate = req.body.interviewDate
      ? new Date(req.body.interviewDate)
      : null;
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });
    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    if (!canTransition(applicant.status, "ASSESSMENT_TAKEN")) {
      return res.status(422).json({
        message: `Cannot record result for application with status "${applicant.status}". Only ASSESSMENT_SCHEDULED applications can record results.`,
      });
    }

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: {
        status: "ASSESSMENT_TAKEN",
        examScore: examScore ?? null,
        examResult: examResult ?? null,
        examNotes: examNotes ?? null,
        interviewResult: interviewResult ?? null,
        interviewDate,
        interviewNotes: interviewNotes ?? null,
        auditionResult: auditionResult ?? null,
        tryoutResult: tryoutResult ?? null,
        natScore: natScore ?? null,
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EXAM_RESULT_RECORDED",
      description: `Recorded assessment result for ${applicant.firstName} ${applicant.lastName} (#${applicantId}): ${examResult || "N/A"} (Score: ${examScore ?? natScore ?? "N/A"})`,
      subjectType: "Applicant",
      subjectId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// â"€â"€ Mark as passed (Clearing for section assignment) â"€â"€
export async function pass(req: Request, res: Response) {
  try {
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });
    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    if (!canTransition(applicant.status, "PASSED")) {
      return res.status(422).json({
        message: `Cannot mark as passed. Current status: "${applicant.status}". Only ASSESSMENT_TAKEN applications can be marked as passed.`,
      });
    }

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: "PASSED" },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_PASSED",
      description: `Marked ${applicant.firstName} ${applicant.lastName} (#${applicantId}) as PASSED - ready for section assignment`,
      subjectType: "Applicant",
      subjectId: applicantId,
      req,
    });

    if (applicant.emailAddress) {
      try {
        await prisma.emailLog.create({
          data: {
            recipient: applicant.emailAddress,
            subject: `Assessment Passed - ${applicant.trackingNumber}`,
            trigger: "ASSESSMENT_PASSED",
            status: "PENDING",
            applicantId,
          },
        });
      } catch {
        /* non-critical */
      }
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// â"€â"€ Mark as not qualified â"€â"€
export async function fail(req: Request, res: Response) {
  try {
    const { examNotes } = req.body;
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });
    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    if (!canTransition(applicant.status, "NOT_QUALIFIED")) {
      return res.status(422).json({
        message: `Cannot mark as not qualified. Current status: "${applicant.status}". Only ASSESSMENT_TAKEN applications can be marked as not qualified.`,
      });
    }

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: "NOT_QUALIFIED", examNotes },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_FAILED",
      description: `Marked ${applicant.firstName} ${applicant.lastName} (#${applicantId}) as NOT_QUALIFIED. Notes: ${examNotes || "N/A"}`,
      subjectType: "Applicant",
      subjectId: applicantId,
      req,
    });

    if (applicant.emailAddress) {
      try {
        await prisma.emailLog.create({
          data: {
            recipient: applicant.emailAddress,
            subject: `Assessment Result — ${applicant.trackingNumber}`,
            trigger: "ASSESSMENT_FAILED",
            status: "PENDING",
            applicantId,
          },
        });
      } catch {
        /* non-critical */
      }
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// — Get application timeline (audit history) —
export async function getTimeline(req: Request, res: Response) {
  try {
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      select: { id: true },
    });
    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    const timeline = await prisma.auditLog.findMany({
      where: {
        subjectType: "Applicant",
        subjectId: applicantId,
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ timeline });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// — Offer regular section (for failed SCP applicants) —
export async function offerRegular(req: Request, res: Response) {
  try {
    const { sectionId } = req.body;
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });
    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    // Only allow offering regular section to NOT_QUALIFIED SCP applicants
    if (applicant.status !== "NOT_QUALIFIED") {
      return res.status(422).json({
        message: `Cannot offer regular section. Current status: "${applicant.status}". Only NOT_QUALIFIED applications can be offered a regular section.`,
      });
    }

    if (applicant.applicantType === "REGULAR") {
      return res.status(422).json({
        message: "This applicant is already in the regular program.",
      });
    }

    const originalType = applicant.applicantType;

    const result = await prisma.$transaction(async (tx) => {
      // Lock section for capacity check
      const [section] = await tx.$queryRaw<any[]>`
        SELECT id, "maxCapacity" FROM "Section" WHERE id = ${sectionId} FOR UPDATE
      `;

      if (!section) throw new Error("Section not found");

      const enrolledCount = await tx.enrollment.count({ where: { sectionId } });
      if (enrolledCount >= section.maxCapacity) {
        throw new Error("This section has reached maximum capacity");
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
          academicYearId: applicant.academicYearId,
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
      subjectId: applicantId,
      req,
    });

    // Send email notification
    if (applicant.emailAddress) {
      try {
        await prisma.emailLog.create({
          data: {
            recipient: applicant.emailAddress,
            subject: `Regular Section Placement — ${applicant.trackingNumber}`,
            trigger: "APPLICATION_APPROVED",
            status: "PENDING",
            applicantId,
          },
        });
      } catch {
        /* non-critical */
      }
    }

    res.json(result);
  } catch (error: any) {
    const status = error.message?.includes("capacity") ? 422 : 500;
    res.status(status).json({ message: error.message });
  }
}

// — Navigate to prev/next application —
export async function navigate(req: Request, res: Response) {
  try {
    const currentId = parseInt(String(req.params.id));
    const direction = req.query.direction as "prev" | "next";
    const { status, gradeLevelId, applicantType, search } = req.query;

    if (!direction || !["prev", "next"].includes(direction)) {
      return res
        .status(400)
        .json({ message: 'Direction must be "prev" or "next"' });
    }

    // Build the same filter as the list
    const where: any = {};

    // Scope to active academic year by default
    const settings = await prisma.schoolSettings.findFirst({
      select: { activeAcademicYearId: true },
    });
    if (settings?.activeAcademicYearId) {
      where.academicYearId = settings.activeAcademicYearId;
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
    if (status && status !== "ALL") where.status = status;
    if (applicantType && applicantType !== "ALL")
      where.applicantType = applicantType;

    // Get ordered list of IDs
    const applications = await prisma.applicant.findMany({
      where,
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    const ids = applications.map((a) => a.id);
    const currentIndex = ids.indexOf(currentId);

    if (currentIndex === -1) {
      return res
        .status(404)
        .json({ message: "Current application not found in list" });
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// — Get sections for section assignment dialog —
export async function getSectionsForAssignment(req: Request, res: Response) {
  try {
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      include: { gradeLevel: true },
    });

    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// — Update application info —
export async function update(req: Request, res: Response) {
  try {
    const applicantId = parseInt(String(req.params.id));
    const { status, trackingNumber, academicYearId, id, ...data } = req.body;

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: {
        ...data,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
        examDate: data.examDate ? new Date(data.examDate) : undefined,
        interviewDate: data.interviewDate ? new Date(data.interviewDate) : undefined,
      }
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_UPDATED",
      description: `Updated application info for ${updated.firstName} ${updated.lastName} (#${applicantId})`,
      subjectType: "Applicant",
      subjectId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// — Show detailed application info —
export async function showDetailed(req: Request, res: Response) {
  try {
    const application = await prisma.applicant.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      include: {
        gradeLevel: true,
        strand: true,
        academicYear: true,
        encodedBy: { select: { id: true, name: true, role: true } },
        enrollment: {
          include: {
            section: {
              include: {
                advisingTeacher: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
            enrolledBy: { select: { id: true, name: true } },
          },
        },
        emailLogs: {
          orderBy: { attemptedAt: 'desc' },
          take: 10
        }
      },
    });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    res.json(application);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// — Reschedule assessment —
export async function rescheduleExam(req: Request, res: Response) {
  try {
    const { examDate, examVenue } = req.body;
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });
    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: {
        examDate: new Date(examDate),
        examVenue: examVenue || null,
        status: "ASSESSMENT_SCHEDULED",
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EXAM_RESCHEDULED",
      description: `Rescheduled assessment for ${applicant.firstName} ${applicant.lastName} (#${applicantId}) to ${examDate}${examVenue ? ` at ${examVenue}` : ""}`,
      subjectType: "Applicant",
      subjectId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
