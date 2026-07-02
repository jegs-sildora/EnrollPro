import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";

export async function getPublicConfig(
  _req: Request,
  res: Response,
): Promise<void> {
  const setting = await prisma.schoolSetting.findFirst({
    include: { activeSchoolYear: true },
  });

  if (!setting) {
    res.json({
      schoolName: "EnrollPro",
      schoolAcronym: "EP",
      logoUrl: null,
      depedSchoolId: null,
      region: null,
      division: null,
      globalDefaultPassword: "DepEd2026!",
    });
    return;
  }

  const schoolName = setting.schoolName || "EnrollPro";
  const acronym = schoolName
    .replace(/\b(?:de|del|dela|of|the|and|ng|mga|at)\b/gi, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 4) || "EP";

  res.json({
    schoolName,
    schoolAcronym: acronym,
    logoUrl: setting.logoUrl,
    depedSchoolId: setting.depedSchoolId,
    region: setting.region,
    division: setting.division,
    globalDefaultPassword: setting.globalDefaultPassword,
  });
}

function parseStartYearFromLabel(label: string): number | null {
  const parsed = Number.parseInt(label.split("-")[0] ?? "", 10);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function getRolloverReadiness(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const schoolSetting = await prisma.schoolSetting.findFirst({
      select: { activeSchoolYearId: true, systemPhase: true },
    });

    if (!schoolSetting?.activeSchoolYearId) {
      throw new AppError(400, "No active school year found.");
    }

    const phase = schoolSetting.systemPhase;
    
    // Bypass heavy queries if not in EOSY phase
    if (phase === "BOSY_ENROLLMENT" || phase === "OFFICIAL_ENROLLMENT") {
      res.json({ isEosyPhase: false, blockers: [] });
      return;
    }

    const activeSyId = schoolSetting.activeSchoolYearId;

    // We are in EOSY phase - run full diagnostic queries
    const activeYear = await prisma.schoolYear.findUnique({
      where: { id: activeSyId },
      include: {
        sections: {
          select: { isEosyFinalized: true },
        },
      },
    });

    if (!activeYear) {
      throw new AppError(400, "Active school year record not found.");
    }

    if (activeYear.isEosyFinalized) {
      res.json({ isEosyPhase: true, blockers: [] });
      return;
    }

    const blockers: string[] = [];

    const pendingSectionsCount = activeYear.sections.filter(s => !s.isEosyFinalized).length;
    if (pendingSectionsCount > 0) {
      blockers.push(`${pendingSectionsCount} Sections pending School Form 5 (SF5) submission.`);
    }

    const pendingLearnerCount = await prisma.enrollmentRecord.count({
      where: {
        schoolYearId: activeSyId,
        eosyStatus: null,
      },
    });

    if (pendingLearnerCount > 0) {
      blockers.push(`${pendingLearnerCount} Learners require End-of-School-Year (EOSY) Class grades.`);
    }

    res.json({ isEosyPhase: true, blockers });
  } catch (error) {
    next(error);
  }
}

export async function executeSystemRollover(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const schoolSetting = await prisma.schoolSetting.findFirst();

    if (!schoolSetting?.activeSchoolYearId) {
      throw new AppError(400, "No active school year found.");
    }

    const activeSyId = schoolSetting.activeSchoolYearId;

    const activeYear = await prisma.schoolYear.findUnique({
      where: { id: activeSyId },
      include: {
        sections: {
          select: { isEosyFinalized: true, name: true },
        },
      },
    });

    if (!activeYear) {
      throw new AppError(400, "Active school year record not found.");
    }

    // TASK 1: The Roll-over Validation Guard
    const pendingSections = activeYear.sections.filter(s => !s.isEosyFinalized);
    if (pendingSections.length > 0) {
      throw new AppError(
        400,
        `Cannot finalize school. EOSY data for ${pendingSections.length} sections are still pending.`,
      );
    }

    const newStartYear = parseStartYearFromLabel(activeYear.yearLabel);
    if (!newStartYear) {
      throw new AppError(400, "Invalid current school year label format.");
    }
    const nextStartYear = newStartYear + 1;
    const nextYearLabel = `${nextStartYear}-${nextStartYear + 1}`;

    const existingNextYear = await prisma.schoolYear.findUnique({
      where: { yearLabel: nextYearLabel },
    });

    if (existingNextYear && existingNextYear.status !== "DRAFT") {
      throw new AppError(400, "The next school year is already initialized.");
    }

    // Fetch all records before doing massive changes
    const currentRecords = await prisma.enrollmentRecord.findMany({
      where: { schoolYearId: activeSyId },
      include: {
        enrolledBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        section: {
          include: {
            advisers: { where: { status: "ACTIVE" }, take: 1 },
            gradeLevel: true,
          },
        },
        enrollmentApplication: {
          select: {
            applicantType: true,
            isPrivacyConsentGiven: true,
            guardianRelationship: true,
            hasNoMother: true,
            hasNoFather: true,
            encodedById: true,
            contactNumber: true,
            guardianName: true,
            addresses: true,
            familyMembers: true,
          },
        },
      },
    });

    const targetGradeLevels = await prisma.gradeLevel.findMany({
      select: { id: true, displayOrder: true },
    });
    const targetGradeLevelByDisplayOrder = new Map<number, { id: number }>();
    for (const gl of targetGradeLevels) {
      targetGradeLevelByDisplayOrder.set(gl.displayOrder, { id: gl.id });
    }

    await prisma.$transaction(async (tx) => {
      // TASK 2: The Archiving Ledger
      if (currentRecords.length > 0) {
        const historyData = currentRecords.map(record => ({
          learnerId: record.learnerId,
          schoolYearId: record.schoolYearId,
          gradeLevelId: record.section.gradeLevelId,
          sectionId: record.sectionId,
          adviserId: record.section.advisers[0]?.teacherId ?? null,
          genAve: record.finalAverage !== null ? Number(record.finalAverage) : null,
          eosyStatus: record.eosyStatus,
          learnerProfileSnapshot: record.enrollmentApplication ? {
            ...JSON.parse(JSON.stringify(record.enrollmentApplication)),
            enrolledBy: record.enrolledBy
          } : null,
        }));
        await tx.enrollmentHistory.createMany({
          data: historyData,
        });

        // Clear active operational data
        await tx.enrollmentRecord.deleteMany({
          where: { schoolYearId: activeSyId },
        });
        await tx.enrollmentApplication.deleteMany({
          where: { schoolYearId: activeSyId },
        });
      }

      // TASK 4: Global Increment
      const nextSy = existingNextYear
        ? await tx.schoolYear.update({
            where: { id: existingNextYear.id },
            data: { status: "ACTIVE", clonedFromId: activeSyId },
          })
        : await tx.schoolYear.create({
            data: {
              yearLabel: nextYearLabel,
              status: "ACTIVE",
              clonedFromId: activeSyId,
            },
          });

      // Change old SY to ARCHIVED and save settings snapshot
      await tx.schoolYear.update({
        where: { id: activeSyId },
        data: { 
          status: "ARCHIVED",
          settingsSnapshot: {
            steEnabled: schoolSetting.steEnabled,
            spaEnabled: schoolSetting.spaEnabled,
            spsEnabled: schoolSetting.spsEnabled,
            enableHomogeneousSections: schoolSetting.enableHomogeneousSections,
            homogeneousSectionCount: schoolSetting.homogeneousSectionCount,
            heterogeneousRoundRobin: schoolSetting.heterogeneousRoundRobin,
          }
        },
      });

      // Update System Setting
      await tx.schoolSetting.updateMany({
        data: {
          activeSchoolYearId: nextSy.id,
          systemPhase: "OFFICIAL_ENROLLMENT",
        },
      });

      // Wipe the adviser_id from all homeroom sections for the old academic year
      await tx.sectionAdviser.updateMany({
        where: { schoolYearId: activeSyId, status: "ACTIVE" },
        data: { status: "REVOKED", effectiveTo: new Date() },
      });

      // TASK 3: Learner Progression & Pool Injection
      for (const record of currentRecords) {
        const learnerId = record.learnerId;
        const eosyStatus = record.eosyStatus ?? "PROMOTED";
        const sourceDisplayOrder = record.section.gradeLevel.displayOrder;
        
        let targetDisplayOrder = sourceDisplayOrder;
        if (eosyStatus === "PROMOTED") {
          targetDisplayOrder += 1;
        }

        const targetGradeLevel = targetGradeLevelByDisplayOrder.get(targetDisplayOrder);

        if (!targetGradeLevel) {
          if (eosyStatus === "PROMOTED") {
            await tx.learner.update({
              where: { id: learnerId },
              data: { status: "JHS_COMPLETER" },
            });
          }
          continue;
        }

        const academicStatus = eosyStatus === "PROMOTED" ? "PROMOTED" : "RETAINED";
        
        const ave = record.finalAverage !== null ? Number(record.finalAverage) : null;
        const isScpDemoted = ave !== null &&
          (record.section.programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ||
           record.section.programType === "SPECIAL_PROGRAM_IN_THE_ARTS" ||
           record.section.programType === "SPECIAL_PROGRAM_IN_SPORTS") &&
          ave >= 75 && ave < 85;

        const applicantType = isScpDemoted && eosyStatus === "PROMOTED"
          ? "REGULAR"
          : record.enrollmentApplication.applicantType;
        
        const newApp = await tx.enrollmentApplication.create({
          data: {
            learnerId,
            schoolYearId: nextSy.id,
            gradeLevelId: targetGradeLevel.id,
            applicantType,
            learnerType: "CONTINUING",
            status: "READY_FOR_SECTIONING",
            admissionChannel: "F2F",
            isPrivacyConsentGiven: record.enrollmentApplication.isPrivacyConsentGiven,
            guardianRelationship: record.enrollmentApplication.guardianRelationship,
            hasNoMother: record.enrollmentApplication.hasNoMother,
            hasNoFather: record.enrollmentApplication.hasNoFather,
            encodedById: req.user?.userId ?? null,
            academicStatus,
            isRemedialRequired: eosyStatus === "CONDITIONALLY_PROMOTED",
            contactNumber: record.enrollmentApplication.contactNumber,
            guardianName: record.enrollmentApplication.guardianName,
            addresses: record.enrollmentApplication.addresses?.length > 0 ? {
              createMany: {
                data: record.enrollmentApplication.addresses.map((a: any) => {
                  const { id, enrollmentApplicationId, enrollmentId, createdAt, updatedAt, ...rest } = a;
                  return rest;
                })
              }
            } : undefined,
            familyMembers: record.enrollmentApplication.familyMembers?.length > 0 ? {
              createMany: {
                data: record.enrollmentApplication.familyMembers.map((fm: any) => {
                  const { id, enrollmentApplicationId, enrollmentId, createdAt, updatedAt, ...rest } = fm;
                  return rest;
                })
              }
            } : undefined,
          },
        });

        const trackingNumber = `REG-${nextStartYear}-${String(newApp.id).padStart(5, "0")}`;
        await tx.enrollmentApplication.update({
          where: { id: newApp.id },
          data: { trackingNumber },
        });

        await tx.learner.update({
          where: { id: learnerId },
          data: { promotionStatus: eosyStatus },
        });
      }

      await auditLog({
        userId: req.user!.userId,
        actionType: "SYSTEM_ROLLOVER_EXECUTED",
        description: `Finalized EOSY data for ${activeYear.yearLabel} and opened ${nextYearLabel}. Copied to ledger and cleared active tables.`,
        subjectType: "SchoolYear",
        recordId: nextSy.id,
        req,
      });
    }, {
      timeout: 30000,
      maxWait: 5000,
    });

    res.json({ message: "EOSY finalized successfully." });
  } catch (error) {
    next(error);
  }
}
