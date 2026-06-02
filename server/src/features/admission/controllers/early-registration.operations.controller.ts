import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../lib/AppError.js";
import { saveBase64Image } from "../../../lib/fileUploader.js";
import type {
  ApplicationStatus,
  Prisma,
} from "../../../generated/prisma/index.js";
import type { AdmissionControllerDeps } from "../services/admission-controller.deps.js";
import { createAdmissionControllerDeps } from "../services/admission-controller.deps.js";
import {
  createEarlyRegistrationSharedService,
  resolveAllowedTransitionsForApplicant,
} from "../services/early-registration-shared.service.js";

export function createEarlyRegistrationOperationsController(
  deps: AdmissionControllerDeps = createAdmissionControllerDeps(),
) {
  const { prisma, auditLog, normalizeDateToUtcNoon } = deps;
  const {
    findApplicantOrThrow,
    getDetailedApplicationOrThrow,
    updateApplicationStatus,
  } = createEarlyRegistrationSharedService(deps);

  const csvEscape = (value: unknown): string =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;
  const toDateOnly = (value?: Date | null): string =>
    value ? value.toISOString().slice(0, 10) : "";

  // — Get application timeline (audit history) —
  async function getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const applicantId = parseInt(String(req.params.id));
      await findApplicantOrThrow(applicantId);

      const timeline = await prisma.auditLog.findMany({
        where: {
          subjectType: {
            in: [
              "Applicant",
              "EnrollmentApplication",
            ],
          },
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

  // — Navigate to prev/next application —
  async function navigate(req: Request, res: Response, next: NextFunction) {
    try {
      const currentId = parseInt(String(req.params.id));
      const direction = req.query.direction as "prev" | "next";
      const { status, gradeLevelId, applicantType, search } = req.query;

      if (!direction || !["prev", "next"].includes(direction)) {
        throw new AppError(400, 'Direction must be "prev" or "next"');
      }

      // Build filters
      const where: Prisma.EnrollmentApplicationWhereInput = {};

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
      if (applicantType && applicantType !== "ALL")
        where.applicantType = applicantType as any;

      // Scope to active School Year by default
      const settings = await prisma.schoolSetting.findFirst({
        select: { activeSchoolYearId: true },
      });
      if (settings?.activeSchoolYearId) {
        where.schoolYearId = settings.activeSchoolYearId;
      }

      // Get ordered list of IDs from EnrollmentApplication table only
      const enrollmentApps = await prisma.enrollmentApplication.findMany({
        where,
        select: { id: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });

      const combined = enrollmentApps.map((a: { id: number; createdAt: Date }) => ({
        id: a.id,
        createdAt: a.createdAt,
        type: "ENROLLMENT",
      }));

      const currentIndex = combined.findIndex((a) => a.id === currentId);

      if (currentIndex === -1) {
        throw new AppError(404, "Current application not found in list");
      }

      let targetId: number | null = null;
      if (direction === "prev" && currentIndex > 0) {
        targetId = combined[currentIndex - 1].id;
      } else if (direction === "next" && currentIndex < combined.length - 1) {
        targetId = combined[currentIndex + 1].id;
      }

      res.json({
        currentIndex,
        totalCount: combined.length,
        previousId: currentIndex > 0 ? combined[currentIndex - 1].id : null,
        nextId:
          currentIndex < combined.length - 1
            ? combined[currentIndex + 1].id
            : null,
        targetId,
      });
    } catch (error) {
      next(error);
    }
  }

  // — Get sections for section assignment dialog —
  async function getSectionsForAssignment(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant } = await findApplicantOrThrow(applicantId);
      const requiredSectionProgramType = "REGULAR";

      const sections = await prisma.section.findMany({
        where: {
          gradeLevelId: applicant.gradeLevelId,
          programType: "REGULAR",
        },
        include: {
          advisers: {
            where: { status: "ACTIVE" },
            include: {
              teacher: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  middleName: true,
                },
              },
            },
          },
          _count: { select: { enrollmentRecords: true } },
        },
        orderBy: { name: "asc" },
      });

      const formatted = sections.map((s) => ({
        id: s.id,
        name: s.name,
        programType: s.programType,
        maxCapacity: s.maxCapacity,
        enrolledCount: s._count.enrollmentRecords,
        availableSlots: s.maxCapacity - s._count.enrollmentRecords,
        fillPercent:
          s.maxCapacity > 0
            ? Math.round((s._count.enrollmentRecords / s.maxCapacity) * 100)
            : 0,
        isFull: s._count.enrollmentRecords >= s.maxCapacity,
        isNearFull: s._count.enrollmentRecords >= s.maxCapacity * 0.8,
        advisingTeacher: s.advisers?.[0]?.teacher
          ? {
              id: s.advisers[0].teacher.id,
              name: `${s.advisers[0].teacher.lastName}, ${s.advisers[0].teacher.firstName}${s.advisers[0].teacher.middleName ? ` ${s.advisers[0].teacher.middleName.charAt(0)}.` : ""}`,
            }
          : null,
      }));

      res.json({
        applicant: {
          id: applicant.id,
          firstName: applicant.learner.firstName,
          lastName: applicant.learner.lastName,
          gradeLevelId: applicant.gradeLevelId,
          gradeLevelName: applicant.gradeLevel.name,
          applicantType: applicant.applicantType,
          requiredSectionProgramType,
        },
        sections: formatted,
      });
    } catch (error) {
      next(error);
    }
  }

  // — Update application info —
  async function update(req: Request, res: Response, next: NextFunction) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant } =
        await findApplicantOrThrow(applicantId);

      if (applicant.isProfileLocked) {
        throw new AppError(
          423,
          "Enrollment profile is locked after official enrollment. A SYSTEM_ADMIN must run explicit profile-lock override before editing.",
        );
      }

      // Whitelist editable fields to prevent status/tracking/schoolYear tampering
      const {
        firstName,
        middleName,
        lastName,
        suffix,
        lrn,
        psaBirthCertNumber,
        sex,
        birthDate,
        placeOfBirth,
        motherTongue,
        religion,
        isIpCommunity,
        ipGroupName,
        is4PsBeneficiary,
        householdId4Ps,
        gradeLevelId,
        applicantType,
        studentPhoto,
        learnerType,
        lastSchoolName,
        lastSchoolId,
        lastGradeCompleted,
        schoolYearLastAttended,
        lastSchoolAddress,
        lastSchoolType,
        generalAverage,
        natScore,
        learningModalities,
        isBalikAral,
        lastYearEnrolled,
        lastGradeLevel,
        motherMaidenName,
      } = req.body;

      // Fields that belong to Learner model
      const learnerData: Record<string, unknown> = {};
      if (firstName !== undefined) learnerData.firstName = firstName;
      if (middleName !== undefined) learnerData.middleName = middleName;
      if (lastName !== undefined) learnerData.lastName = lastName;
      if (suffix !== undefined) learnerData.extensionName = suffix;
      if (lrn !== undefined) learnerData.lrn = lrn;
      if (psaBirthCertNumber !== undefined)
        learnerData.psaBirthCertNumber = psaBirthCertNumber;
      if (sex !== undefined) learnerData.sex = sex;
      if (birthDate !== undefined)
        learnerData.birthdate = normalizeDateToUtcNoon(new Date(birthDate));
      if (placeOfBirth !== undefined) learnerData.placeOfBirth = placeOfBirth;
      if (motherTongue !== undefined) learnerData.motherTongue = motherTongue;
      if (religion !== undefined) learnerData.religion = religion;
      if (isIpCommunity !== undefined)
        learnerData.isIpCommunity = isIpCommunity;
      if (ipGroupName !== undefined) learnerData.ipGroupName = ipGroupName;
      if (is4PsBeneficiary !== undefined)
        learnerData.is4PsBeneficiary = is4PsBeneficiary;
      if (householdId4Ps !== undefined)
        learnerData.householdId4Ps = householdId4Ps;
      if (isBalikAral !== undefined) learnerData.isBalikAral = isBalikAral;
      if (lastYearEnrolled !== undefined)
        learnerData.lastYearEnrolled = lastYearEnrolled;
      if (lastGradeLevel !== undefined)
        learnerData.lastGradeLevel = lastGradeLevel;

      if (studentPhoto !== undefined) {
        learnerData.studentPhoto = await saveBase64Image(studentPhoto, "photo");
      }

      // Fields that belong to PreviousSchool
      const prevSchoolData: Record<string, unknown> = {};
      if (lastSchoolName !== undefined)
        prevSchoolData.schoolName = lastSchoolName;
      if (lastSchoolId !== undefined)
        prevSchoolData.schoolDepedId = lastSchoolId;
      if (lastGradeCompleted !== undefined)
        prevSchoolData.gradeCompleted = lastGradeCompleted;
      if (schoolYearLastAttended !== undefined)
        prevSchoolData.schoolYearAttended = schoolYearLastAttended;
      if (lastSchoolAddress !== undefined)
        prevSchoolData.schoolAddress = lastSchoolAddress;
      if (lastSchoolType !== undefined)
        prevSchoolData.schoolType = lastSchoolType;
      if (generalAverage !== undefined)
        prevSchoolData.generalAverage =
          generalAverage != null && !isNaN(parseFloat(String(generalAverage)))
            ? parseFloat(String(generalAverage))
            : null;
      if (natScore !== undefined)
        prevSchoolData.natScore =
          natScore != null && !isNaN(parseFloat(String(natScore)))
            ? parseFloat(String(natScore))
            : null;

      // Fields that belong to application models
      const appData: Record<string, unknown> = {};
      if (applicantType !== undefined) appData.applicantType = applicantType;
      if (learnerType !== undefined) appData.learnerType = learnerType;
      if (gradeLevelId !== undefined)
        appData.gradeLevel = { connect: { id: gradeLevelId } };
      if (learningModalities !== undefined)
        appData.learningModalities = learningModalities;

      // Family member updates
      const familyUpdatePromises: Promise<unknown>[] = [];
      if (motherMaidenName !== undefined) {
        familyUpdatePromises.push(
          prisma.applicationFamilyMember.updateMany({
            where: { enrollmentId: applicantId, relationship: "MOTHER" },
            data: { maidenName: motherMaidenName },
          }),
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (Object.keys(learnerData).length > 0) {
          await tx.learner.update({
            where: { id: applicant.learnerId },
            data: learnerData,
          });
        }

        if (familyUpdatePromises.length > 0) {
          await Promise.all(familyUpdatePromises);
        }

        return tx.enrollmentApplication.update({
          where: { id: applicantId },
          data: {
            ...appData,
            previousSchool:
              Object.keys(prevSchoolData).length > 0
                ? {
                    upsert: {
                      create: prevSchoolData as any,
                      update: prevSchoolData as any,
                    },
                  }
                : undefined,
          },
          include: { learner: true },
        });
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_UPDATED",
        description: `Updated application info for ${updated.learner.firstName} ${updated.learner.lastName} (#${applicantId})`,
        subjectType: "EnrollmentApplication",
        recordId: applicantId,
        req,
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  async function setProfileLock(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const { lock, reason } = (req.body ?? {}) as {
        lock?: boolean;
        reason?: string;
      };

      if (typeof lock !== "boolean") {
        throw new AppError(422, 'Field "lock" must be a boolean value.');
      }

      const { data: applicant } =
        await findApplicantOrThrow(applicantId);

      if (applicant.status !== "ENROLLED") {
        throw new AppError(
          422,
          "Profile lock override is available only for enrolled learners.",
        );
      }

      const updated = await prisma.enrollmentApplication.update({
        where: { id: applicantId },
        data: {
          isProfileLocked: lock,
          profileLockedAt: lock ? new Date() : null,
          profileLockedById: lock ? req.user!.userId : null,
        },
        select: {
          id: true,
          isProfileLocked: true,
          profileLockedAt: true,
          profileLockedById: true,
        },
      });

      const actionType = lock
        ? "APPLICATION_PROFILE_LOCKED"
        : "APPLICATION_PROFILE_UNLOCKED";
      const reasonSuffix =
        typeof reason === "string" && reason.trim().length > 0
          ? ` Reason: ${reason.trim()}`
          : "";

      await auditLog({
        userId: req.user!.userId,
        actionType,
        description: `${lock ? "Locked" : "Unlocked"} enrollment profile for ${applicant.learner.firstName} ${applicant.learner.lastName} (#${applicantId}).${reasonSuffix}`,
        subjectType: "EnrollmentApplication",
        recordId: applicantId,
        req,
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  async function exportSf1Csv(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const schoolYearIdRaw = req.query.schoolYearId
        ? Number(req.query.schoolYearId)
        : null;

      if (schoolYearIdRaw !== null && !Number.isInteger(schoolYearIdRaw)) {
        throw new AppError(400, "schoolYearId must be a valid integer.");
      }

      let targetSchoolYearId = schoolYearIdRaw;
      if (targetSchoolYearId === null) {
        const settings = await prisma.schoolSetting.findFirst({
          select: { activeSchoolYearId: true },
        });

        if (!settings?.activeSchoolYearId) {
          throw new AppError(400, "No active School Year configured.");
        }

        targetSchoolYearId = settings.activeSchoolYearId;
      }

      const applicantType = req.query.applicantType as string | undefined;

      const records = await prisma.enrollmentApplication.findMany({
        where: {
          schoolYearId: targetSchoolYearId,
          status: { in: ["ENROLLED", "OFFICIALLY_ENROLLED"] },
          enrollmentRecord: { isNot: null },
          ...(applicantType && applicantType !== "ALL"
            ? { applicantType: applicantType as any }
            : {}),
        },
        include: {
          learner: true,
          schoolYear: { select: { yearLabel: true } },
          gradeLevel: { select: { name: true } },
          enrollmentRecord: {
            include: {
              section: { select: { name: true } },
            },
          },
        },
      });

      if (records.length === 0) {
        throw new AppError(404, "No enrolled learners found to export.");
      }

      // Group by section
      const sectionsMap = new Map<string, typeof records>();
      records.forEach((r) => {
        const sectionName = r.enrollmentRecord?.section?.name ?? "UNASSIGNED";
        if (!sectionsMap.has(sectionName)) {
          sectionsMap.set(sectionName, []);
        }
        sectionsMap.get(sectionName)!.push(r);
      });

      const allCsvRows: string[][] = [];

      for (const [sectionName, sectionRecords] of sectionsMap.entries()) {
        const males = sectionRecords.filter((r) => r.learner.sex === "MALE");
        const females = sectionRecords.filter(
          (r) => r.learner.sex === "FEMALE",
        );

        const sortByNames = (a: typeof records[0], b: typeof records[0]) => {
          const ln = a.learner.lastName.localeCompare(b.learner.lastName);
          if (ln !== 0) return ln;
          return a.learner.firstName.localeCompare(b.learner.firstName);
        };

        males.sort(sortByNames);
        females.sort(sortByNames);

        const sampleRecord = sectionRecords[0];

        // Header Rows according to CSV template
        allCsvRows.push(["School Form 1 (SF 1) School Register", ...Array(45).fill("")]);
        allCsvRows.push(['"(This replaces  Form 1, Master List & STS Form 2-Family Background and Profile)"', ...Array(45).fill("")]);
        allCsvRows.push(["School ID ", ...Array(15).fill(""), "Division ", ...Array(29).fill("")]);
        
        const syLabel = sampleRecord?.schoolYear?.yearLabel ?? "";
        const glName = sampleRecord?.gradeLevel?.name ?? "";
        
        const metaRow = Array(46).fill("");
        metaRow[0] = "School Name ";
        metaRow[16] = "School Year ";
        metaRow[17] = syLabel;
        metaRow[26] = "Grade Level ";
        metaRow[27] = glName;
        metaRow[36] = "Section ";
        metaRow[37] = sectionName;
        allCsvRows.push(metaRow);

        allCsvRows.push([
          "LRN", "", "NAME\n(Last Name, First Name, Middle Name)", "", "", "", "Sex (M/F)", "BIRTH DATE\n(mm/dd/yyyy)", "", "AGE as of 1st Friday June", "", "MOTHER TONGUE (Grade 1 to 3 Only)", "", "IP\n(Ethnic Group)", "RELIGION", "ADDRESS", "", "", "", "", "", "", "", "", "", "", "", "PARENTS", "", "", "", "", "", "", "", "", "GUARDIAN\n(if Not Parent)", "", "", "", "", "Contact Number of Parent or Guardian", "", "Learning Modality", "REMARKS", "", ""
        ]);
        allCsvRows.push([
          "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "House #/ Street/ Sitio/ Purok", "", "Barangay", "", "", "Municipality/ City", "", "Province", "", "", "", "", "Father's Name (Last Name, First Name, Middle Name)     ", "", "", "", "Mother's Maiden Name (Last Name, First Name, Middle Name)", "", "", "", "", "Name", "", "", "", "Relationship", "", "", "", "(Please refer to the legend on last page)", "", ""
        ]);

        const mapToRow = (r: typeof records[0]) => {
          const row = Array(46).fill("");
          row[0] = r.learner.lrn ?? "";
          row[2] = `${r.learner.lastName}, ${r.learner.firstName} ${r.learner.middleName ?? ""}`;
          row[6] = r.learner.sex === "MALE" ? "M" : "F";
          row[7] = toDateOnly(r.learner.birthdate);
          row[13] = r.learner.ipGroupName ?? "";
          row[14] = r.learner.religion ?? "";
          return row;
        };

        males.forEach((m) => allCsvRows.push(mapToRow(m)));
        const maleTotalRow = Array(46).fill("");
        maleTotalRow[0] = String(males.length);
        maleTotalRow[2] = "<=== TOTAL MALE";
        allCsvRows.push(maleTotalRow);
        
        females.forEach((f) => allCsvRows.push(mapToRow(f)));
        const femaleTotalRow = Array(46).fill("");
        femaleTotalRow[0] = String(females.length);
        femaleTotalRow[2] = "<=== TOTAL FEMALE";
        allCsvRows.push(femaleTotalRow);
        
        const combinedTotalRow = Array(46).fill("");
        combinedTotalRow[0] = String(males.length + females.length);
        combinedTotalRow[2] = "<=== COMBINED";
        allCsvRows.push(combinedTotalRow);

        // Separator
        allCsvRows.push([]);
        allCsvRows.push([]);
      }

      const csvBody = allCsvRows
        .map((row) => row.map(csvEscape).join(","))
        .join("\r\n");

      const safeLabel = (applicantType || "ALL").replace(/[^a-zA-Z0-9_-]+/g, "-");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="SF1-${safeLabel}.csv"`,
      );

      res.status(200).send(`\uFEFF${csvBody}`);
    } catch (error) {
      next(error);
    }
  }

  async function exportLisMasterCsv(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const schoolYearIdRaw = req.query.schoolYearId
        ? Number(req.query.schoolYearId)
        : null;

      if (schoolYearIdRaw !== null && !Number.isInteger(schoolYearIdRaw)) {
        throw new AppError(400, "schoolYearId must be a valid integer.");
      }

      let targetSchoolYearId = schoolYearIdRaw;
      if (targetSchoolYearId === null) {
        const settings = await prisma.schoolSetting.findFirst({
          select: { activeSchoolYearId: true },
        });

        if (!settings?.activeSchoolYearId) {
          throw new AppError(400, "No active School Year configured.");
        }

        targetSchoolYearId = settings.activeSchoolYearId;
      }

      const records = await prisma.enrollmentApplication.findMany({
        where: {
          schoolYearId: targetSchoolYearId,
          status: "ENROLLED",
          enrollmentRecord: { isNot: null },
        },
        include: {
          learner: true,
          schoolYear: { select: { yearLabel: true } },
          gradeLevel: { select: { name: true, displayOrder: true } },
          enrollmentRecord: {
            include: {
              section: { select: { name: true } },
            },
          },
        },
      });

      const sortedRecords = records.sort((a, b) => {
        const gradeA = a.gradeLevel?.displayOrder ?? 999;
        const gradeB = b.gradeLevel?.displayOrder ?? 999;
        if (gradeA !== gradeB) return gradeA - gradeB;

        const lastNameCompare = a.learner.lastName.localeCompare(
          b.learner.lastName,
          "en",
          { sensitivity: "base" },
        );
        if (lastNameCompare !== 0) return lastNameCompare;

        return a.learner.firstName.localeCompare(b.learner.firstName, "en", {
          sensitivity: "base",
        });
      });

      const headers = [
        "LRN",
        "LAST_NAME",
        "FIRST_NAME",
        "MIDDLE_NAME",
        "EXTENSION_NAME",
        "SEX",
        "BIRTHDATE",
        "GRADE_LEVEL",
        "SECTION",
        "PROGRAM_TYPE",
        "LEARNER_TYPE",
        "SCHOOL_YEAR",
        "ENROLLED_AT",
        "STATUS",
      ];

      const rows = sortedRecords.map((record) => [
        record.learner.lrn,
        record.learner.lastName,
        record.learner.firstName,
        record.learner.middleName,
        record.learner.extensionName,
        record.learner.sex,
        toDateOnly(record.learner.birthdate),
        record.gradeLevel?.name ?? "",
        record.enrollmentRecord?.section?.name ?? "",
        record.applicantType,
        record.learnerType,
        record.schoolYear?.yearLabel ?? "",
        toDateOnly(record.enrollmentRecord?.enrolledAt),
        record.status,
      ]);

      const csvBody = [headers, ...rows]
        .map((row) => row.map(csvEscape).join(","))
        .join("\r\n");

      const schoolYearLabel =
        sortedRecords[0]?.schoolYear?.yearLabel ?? String(targetSchoolYearId);
      const safeLabel = schoolYearLabel.replace(/[^a-zA-Z0-9_-]+/g, "-");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="lis-master-${safeLabel}.csv"`,
      );

      res.status(200).send(`\uFEFF${csvBody}`);
    } catch (error) {
      next(error);
    }
  }

  // — Show detailed application info —
  async function showDetailed(req: Request, res: Response, next: NextFunction) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant } = await findApplicantOrThrow(applicantId);

      const canStartReview =
        req.user?.role === "HEAD_REGISTRAR" ||
        req.user?.role === "SYSTEM_ADMIN";

      const isSubmittedStatus =
        applicant.status === "SUBMITTED_BEERF" ||
        applicant.status === "SUBMITTED_BEEF";

      if (isSubmittedStatus && canStartReview) {
        await prisma.enrollmentApplication.update({
          where: { id: applicant.id },
          data: { status: "UNDER_REVIEW" },
        });

        await auditLog({
          userId: req.user!.userId,
          actionType: "APPLICATION_REVIEWED",
          description: `Started reviewing enrollment application for ${applicant.learner.firstName} ${applicant.learner.lastName}`,
          subjectType: "EnrollmentApplication",
          recordId: applicant.id,
          req,
        });
      }

      const application = await getDetailedApplicationOrThrow(applicantId, {
        includeAuditLogs: true,
      });
      res.json(application);
    } catch (error) {
      next(error);
    }
  }

  // — Batch Process Registration —
  async function batchProcess(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids, targetStatus } = req.body as {
        ids: number[];
        targetStatus: ApplicationStatus;
      };

      if (targetStatus === "ENROLLED") {
        throw new AppError(
          422,
          "Batch transition to ENROLLED is not allowed. Use the official enrollment endpoint per applicant after section assignment and document validation.",
        );
      }

      // Fetch from EnrollmentApplication table only
      const enrollmentApps = await prisma.enrollmentApplication.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          status: true,
          applicantType: true,
          learner: { select: { firstName: true, lastName: true } },
          trackingNumber: true,
        },
      });

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

      const validApplicants: Array<{
        id: number;
        previousStatus: string;
        name: string;
        trackingNumber: string;
      }> = [];

      for (const id of ids) {
        const applicant = enrollmentApps.find((a) => a.id === id);
        if (!applicant) {
          failed.push({
            id,
            name: "Unknown",
            trackingNumber: "",
            reason: "Applicant not found",
          });
          continue;
        }

        const allowedTransitions = resolveAllowedTransitionsForApplicant({
          status: applicant.status,
          applicantType: applicant.applicantType,
        });

        if (!allowedTransitions.includes(targetStatus)) {
          failed.push({
            id: applicant.id,
            name: `${applicant.learner.lastName}, ${applicant.learner.firstName}`,
            trackingNumber: applicant.trackingNumber ?? "",
            reason: `Cannot transition from "${applicant.status}" to "${targetStatus}"`,
          });
          continue;
        }

        validApplicants.push({
          id: applicant.id,
          previousStatus: applicant.status,
          name: `${applicant.learner.lastName}, ${applicant.learner.firstName}`,
          trackingNumber: applicant.trackingNumber ?? "",
        });
      }

      // Execute all valid transitions
      if (validApplicants.length > 0) {
        await prisma.$transaction(async (tx) => {
          for (const app of validApplicants) {
            await tx.enrollmentApplication.update({
              where: { id: app.id },
              data: { status: targetStatus },
            });
          }
        });

        // Record successes and audit logs
        for (const app of validApplicants) {
          succeeded.push({
            id: app.id,
            name: app.name,
            trackingNumber: app.trackingNumber,
            previousStatus: app.previousStatus,
          });

          auditLog({
            userId: req.user!.userId,
            actionType: "STATUS_CHANGED",
            description: `Batch: ${app.name} (#${app.id}) status changed from ${app.previousStatus} to ${targetStatus}`,
            subjectType: "EnrollmentApplication",
            recordId: app.id,
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

  return {
    exportLisMasterCsv,
    exportSf1Csv,
    getTimeline,
    navigate,
    getSectionsForAssignment,
    update,
    setProfileLock,
    showDetailed,
    batchProcess,
  };
}

const operationsController = createEarlyRegistrationOperationsController();

export const exportLisMasterCsv = operationsController.exportLisMasterCsv;
export const exportSf1Csv = operationsController.exportSf1Csv;
export const getTimeline = operationsController.getTimeline;
export const navigate = operationsController.navigate;
export const getSectionsForAssignment =
  operationsController.getSectionsForAssignment;
export const update = operationsController.update;
export const setProfileLock = operationsController.setProfileLock;
export const showDetailed = operationsController.showDetailed;
export const batchProcess = operationsController.batchProcess;
