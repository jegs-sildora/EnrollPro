  async function specialEnrollment(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const data = req.body;
      const {
        firstName,
        lastName,
        learnerType,
        applicantType = "REGULAR",
        gradeLevelId,
      } = data;
      const processOutcome =
        data.processOutcome === "ENCODE_ONLY"
          ? "ENCODE_ONLY"
          : "ENCODE_AND_VERIFY";
      const requestedEnrollmentId = Number.parseInt(
        String(data.enrollmentApplicationId ?? ""),
        10,
      );

      const normalizedLrn =
        typeof data.lrn === "string" && data.lrn.trim().length > 0
          ? data.lrn.trim()
          : null;
      const hasNoLrn = data.hasNoLrn === true;

      if (!hasNoLrn && (!normalizedLrn || !LRN_REGEX.test(normalizedLrn))) {
        throw new AppError(400, "LRN must be exactly 12 digits.");
      }

      if (hasNoLrn && normalizedLrn) {
        throw new AppError(
          422,
          "Clear the LRN field when enrolling a learner without LRN.",
        );
      }

      const parsedGradeLevelId = Number.parseInt(String(gradeLevelId), 10);
      if (!Number.isInteger(parsedGradeLevelId) || parsedGradeLevelId <= 0) {
        throw new AppError(400, "Grade level is required.");
      }

      const gradeLevel = await prisma.gradeLevel.findUnique({
        where: { id: parsedGradeLevelId },
        select: { id: true, name: true },
      });
      if (!gradeLevel) {
        throw new AppError(404, "Grade level not found.");
      }

      if (hasNoLrn) {
        const gradeMatch = gradeLevel.name.match(/\d+/);
        const gradeNumber = gradeMatch
          ? Number.parseInt(gradeMatch[0], 10)
          : null;
        const isIncomingGrade7 =
          learnerType === "NEW_ENROLLEE" && gradeNumber === 7;
        const isTransferee = learnerType === "TRANSFEREE";

        if (!isIncomingGrade7 && !isTransferee) {
          throw new AppError(
            422,
            "Only incoming Grade 7 and transferee learners can enroll without LRN.",
          );
        }
      }

      const parsedBirthdate = new Date(data.birthdate);
      if (Number.isNaN(parsedBirthdate.getTime())) {
        throw new AppError(400, "Invalid birthdate format.");
      }

      const normalizeOptional = (value: unknown): string | null => {
        if (typeof value !== "string") {
          return null;
        }

        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
      };

      const motherData = data.mother
        ? {
            relationship: "MOTHER" as const,
            firstName: data.mother.firstName.trim(),
            lastName: data.mother.lastName.trim(),
            middleName: normalizeOptional(data.mother.middleName),
            contactNumber: normalizeOptional(data.mother.contactNumber),
          }
        : null;
      const fatherData = data.father
        ? {
            relationship: "FATHER" as const,
            firstName: data.father.firstName.trim(),
            lastName: data.father.lastName.trim(),
            middleName: normalizeOptional(data.father.middleName),
            contactNumber: normalizeOptional(data.father.contactNumber),
          }
        : null;
      const guardianData = data.guardian
        ? {
            relationship: "GUARDIAN" as const,
            firstName: data.guardian.firstName.trim(),
            lastName: data.guardian.lastName.trim(),
            middleName: normalizeOptional(data.guardian.middleName),
            contactNumber: normalizeOptional(data.guardian.contactNumber),
          }
        : null;

      if (!motherData && !fatherData && !guardianData) {
        throw new AppError(
          422,
          "Provide at least one complete mother, father, or guardian identity.",
        );
      }

      const addressData: Prisma.ApplicationAddressCreateManyInput[] = [];
      if (data.currentAddress) {
        addressData.push({
          addressType: "CURRENT",
          houseNoStreet: normalizeOptional(data.currentAddress.houseNoStreet),
          sitio: normalizeOptional(data.currentAddress.sitio),
          barangay: data.currentAddress.barangay,
          cityMunicipality: data.currentAddress.cityMunicipality,
          province: data.currentAddress.province,
        });
      }

      const familyData: Prisma.ApplicationFamilyMemberCreateManyInput[] = [];
      if (motherData) familyData.push(motherData);
      if (fatherData) familyData.push(fatherData);
      if (guardianData) familyData.push(guardianData);

      // 1. Create or Find Learner
      let learner = await prisma.learner.findFirst({
        where: normalizedLrn
          ? { lrn: normalizedLrn }
          : { firstName, lastName, birthdate: parsedBirthdate },
      });
      console.log(
        `[specialEnrollment] Learner found by ${normalizedLrn ? "LRN" : "Name"}:`,
        learner?.id || "NOT FOUND",
      );

      if (!learner) {
        learner = await prisma.learner.create({
          data: {
            lrn: normalizedLrn,
            firstName,
            lastName,
            middleName: data.middleName,
            extensionName: data.extensionName,
            birthdate: parsedBirthdate,
            sex: data.sex,
            placeOfBirth: normalizeOptional(data.placeOfBirth),
            isPendingLrnCreation: hasNoLrn || !normalizedLrn,
          },
        });
        console.log(`[specialEnrollment] Created new learner:`, learner.id);
      } else {
        learner = await prisma.learner.update({
          where: { id: learner.id },
          data: {
            lrn: normalizedLrn ?? learner.lrn,
            firstName,
            lastName,
            middleName: data.middleName,
            extensionName: data.extensionName,
            birthdate: parsedBirthdate,
            sex: data.sex,
            placeOfBirth: normalizeOptional(data.placeOfBirth),
            isPendingLrnCreation: hasNoLrn || !normalizedLrn,
          },
        });
        console.log(
          `[specialEnrollment] Updated existing learner:`,
          learner.id,
        );
      }

      // 2. Get active school year
      const settings = await prisma.schoolSetting.findFirst({
        include: { activeSchoolYear: true },
      });
      if (!settings?.activeSchoolYear) {
        throw new AppError(422, "No active school year found.");
      }
      const activeSchoolYear = settings.activeSchoolYear;
      console.log(
        `[specialEnrollment] Active School Year ID:`,
        activeSchoolYear.id,
      );

      const existingEnrollment = await prisma.enrollmentApplication.findFirst({
        where: {
          learnerId: learner.id,
          schoolYearId: activeSchoolYear.id,
          status: { notIn: ["REJECTED", "WITHDRAWN"] },
        },
        select: {
          id: true,
          status: true,
          trackingNumber: true,
        },
      });
      console.log(
        `[specialEnrollment] Existing Enrollment:`,
        existingEnrollment,
      );

      const updatableStatuses = new Set([
        "PENDING_BEEF",
        "AWAITING_VERIFICATION",
        "SUBMITTED_BEEF",
      ]);

      let targetEnrollment = existingEnrollment;

      if (
        Number.isInteger(requestedEnrollmentId) &&
        requestedEnrollmentId > 0
      ) {
        console.log(
          `[specialEnrollment] Requested Enrollment ID:`,
          requestedEnrollmentId,
        );
        const requestedEnrollment =
          await prisma.enrollmentApplication.findFirst({
            where: {
              id: requestedEnrollmentId,
              learnerId: learner.id,
              schoolYearId: settings.activeSchoolYearId || undefined,
              status: { notIn: ["REJECTED", "WITHDRAWN"] },
            },
            select: {
              id: true,
              status: true,
              trackingNumber: true,
            },
          });

        if (requestedEnrollment) {
          console.log(
            `[specialEnrollment] Found requested enrollment:`,
            requestedEnrollment,
          );
          targetEnrollment = requestedEnrollment;
        } else {
          console.warn(
            `[specialEnrollment] Requested enrollment ID ${requestedEnrollmentId} not found for learner ${learner.id} in active SY ${settings.activeSchoolYearId}. Falling back to default logic.`,
          );
        }
      }

      console.log(
        `[specialEnrollment] Resolved Target Enrollment:`,
        targetEnrollment,
      );
      if (targetEnrollment && !updatableStatuses.has(targetEnrollment.status)) {
        console.warn(
          `[specialEnrollment] Target enrollment status ${targetEnrollment.status} is NOT updatable.`,
        );
        throw new AppError(
          409,
          `An active enrollment already exists for this learner (Tracking: ${targetEnrollment.trackingNumber ?? `#${targetEnrollment.id}`}, Status: ${targetEnrollment.status}).`,
        );
      }

      const shouldTemporarilyEnroll =
        (data.isMissingSf9 && !data.hasSf9CertificationLetter) ||
        data.hasUnsettledPrivateAccount ||
        false;
      const resolvedStatus =
        processOutcome === "ENCODE_ONLY"
          ? "AWAITING_VERIFICATION"
          : shouldTemporarilyEnroll
            ? "TEMPORARILY_ENROLLED"
            : applicantType === "LATE_ENROLLEE"
              ? "VERIFIED" // Late enrollees skip Phil-IRI — inline-slot handles direct enrollment
              : "SUBMITTED_BEEF"; // Regular ENCODE_AND_VERIFY → Phil-IRI assessment queue

      console.log(`[specialEnrollment] Resolved Status:`, resolvedStatus);
      console.log(
        `[specialEnrollment] Target Enrollment Action:`,
        targetEnrollment ? "UPDATE" : "CREATE",
      );

      let persistedApplication;
      try {
        persistedApplication = targetEnrollment
          ? await prisma.enrollmentApplication.update({
              where: { id: targetEnrollment.id },
              data: {
                gradeLevelId: gradeLevel.id,
                applicantType: applicantType as any,
                learnerType: learnerType as any,
                status: resolvedStatus,
                intakeMethod: "BEEF_FULL",
                admissionChannel: "F2F",
                guardianRelationship: normalizeOptional(
                  data.guardianRelationship,
                ),
                hasNoMother: !motherData,
                hasNoFather: !fatherData,
                encodedById: req.user!.userId,
                isPrivacyConsentGiven: true,
                isTemporarilyEnrolled: shouldTemporarilyEnroll,
                isMissingSf9: data.isMissingSf9 || false,
                hasSf9CertificationLetter:
                  data.hasSf9CertificationLetter || false,
                hasUnsettledPrivateAccount:
                  data.hasUnsettledPrivateAccount || false,
                originatingSchoolName: normalizeOptional(
                  data.originatingSchoolName,
                ),
              },
              include: { learner: true },
            })
          : await prisma.enrollmentApplication.create({
              data: {
                learnerId: learner.id,
                schoolYearId: settings.activeSchoolYearId!,
                gradeLevelId: gradeLevel.id,
                applicantType: applicantType as any,
                learnerType: learnerType as any,
                status: resolvedStatus,
                intakeMethod: "BEEF_FULL",
                admissionChannel: "F2F",
                guardianRelationship: normalizeOptional(
                  data.guardianRelationship,
                ),
                hasNoMother: !motherData,
                hasNoFather: !fatherData,
                encodedById: req.user!.userId,
                isPrivacyConsentGiven: true,
                isTemporarilyEnrolled: shouldTemporarilyEnroll,
                isMissingSf9: data.isMissingSf9 || false,
                hasSf9CertificationLetter:
                  data.hasSf9CertificationLetter || false,
                hasUnsettledPrivateAccount:
                  data.hasUnsettledPrivateAccount || false,
                originatingSchoolName: normalizeOptional(
                  data.originatingSchoolName,
                ),
              },
              include: { learner: true },
            });
        console.log(
          `[specialEnrollment] Persisted Application ID:`,
          persistedApplication.id,
        );
      } catch (dbError) {
        console.error(
          `[specialEnrollment] FAILED to persist application:`,
          dbError,
        );
        throw dbError;
      }

      try {
        console.log(`[specialEnrollment] Updating Address and Family...`);
        await prisma.applicationAddress.deleteMany({
          where: { enrollmentId: persistedApplication.id },
        });
        if (addressData.length > 0) {
          await prisma.applicationAddress.createMany({
            data: addressData.map((item) => ({
              ...item,
              enrollmentId: persistedApplication.id,
            })),
          });
        }

        await prisma.applicationFamilyMember.deleteMany({
          where: { enrollmentId: persistedApplication.id },
        });
        if (familyData.length > 0) {
          await prisma.applicationFamilyMember.createMany({
            data: familyData.map((item) => ({
              ...item,
              enrollmentId: persistedApplication.id,
            })),
          });
        }
      } catch (relError) {
        console.error(
          `[specialEnrollment] FAILED to update address/family:`,
          relError,
        );
        throw relError;
      }

      console.log(`[specialEnrollment] Checking Previous School...`);
      const hasPreviousSchoolPayload =
        data.lastSchoolName ||
        data.originSchoolName ||
        typeof data.checklist?.finalGeneralAverage === "number" ||
        typeof data.generalAverage === "number";

      console.log(
        `[specialEnrollment] hasPreviousSchoolPayload: ${hasPreviousSchoolPayload}`,
      );

      if (hasPreviousSchoolPayload) {
        try {
          console.log(
            `[specialEnrollment] Upserting previous school for App ID: ${persistedApplication.id}`,
          );
          await prisma.enrollmentPreviousSchool.upsert({
            where: { applicationId: persistedApplication.id },
            update: {
              schoolName:
                normalizeOptional(
                  data.lastSchoolName || data.originSchoolName,
                ) || "UNKNOWN SCHOOL",
              schoolDepedId: normalizeOptional(data.lastSchoolId),
              gradeCompleted: normalizeOptional(data.lastGradeCompleted),
              schoolYearAttended: normalizeOptional(
                data.schoolYearLastAttended,
              ),
              schoolAddress: normalizeOptional(data.lastSchoolAddress),
              schoolType: normalizeOptional(data.lastSchoolType),
              generalAverage:
                typeof data.generalAverage === "number"
                  ? data.generalAverage
                  : typeof data.checklist?.finalGeneralAverage === "number"
                    ? data.checklist.finalGeneralAverage
                    : null,
            },
            create: {
              applicationId: persistedApplication.id,
              schoolName:
                normalizeOptional(
                  data.lastSchoolName || data.originSchoolName,
                ) || "UNKNOWN SCHOOL",
              schoolDepedId: normalizeOptional(data.lastSchoolId),
              gradeCompleted: normalizeOptional(data.lastGradeCompleted),
              schoolYearAttended: normalizeOptional(
                data.schoolYearLastAttended,
              ),
              schoolAddress: normalizeOptional(data.lastSchoolAddress),
              schoolType: normalizeOptional(data.lastSchoolType),
              generalAverage:
                typeof data.generalAverage === "number"
                  ? data.generalAverage
                  : typeof data.checklist?.finalGeneralAverage === "number"
                    ? data.checklist.finalGeneralAverage
                    : null,
            },
          });
          console.log(`[specialEnrollment] Previous school upsert SUCCESS`);
        } catch (prevSchoolError) {
          console.error(
            `[specialEnrollment] FAILED to update previous school:`,
            prevSchoolError,
          );
          throw prevSchoolError;
        }
      }

      console.log(
        `[specialEnrollment] Finalizing Tracking Number and Checklist...`,
      );
      const trackingNumber =
        targetEnrollment?.trackingNumber ??
        generateTrackingNumber({
          prefix: getTrackingPrefix(persistedApplication.applicantType),
          schoolYear: activeSchoolYear.yearLabel,
          id: persistedApplication.id,
        });

      const updated = await prisma.enrollmentApplication.update({
        where: { id: persistedApplication.id },
        data: { trackingNumber },
        include: { learner: true, gradeLevel: true },
      });

      // Ensure Learner has a corresponding User record (Single Source of Truth)
      const { ensureLearnerUserAccount } = await import("../../learner/learner.service.js");
      await prisma.$transaction(async (tx) => {
        await ensureLearnerUserAccount(tx, updated.learner);
      });

      await prisma.applicationChecklist.upsert({
        where: { enrollmentId: updated.id },
        update: {
          academicStatus:
            data.checklist?.academicStatus || data.academicStatus || "PROMOTED",
          isSf9Submitted: data.checklist?.isSf9Submitted ?? false,
          isPsaBirthCertPresented:
            data.checklist?.isPsaBirthCertPresented ?? false,
          isOriginalPsaBcCollected:
            data.checklist?.isOriginalPsaBcCollected ??
            data.checklist?.isPsaBirthCertPresented ??
            false,
        },
        create: {
          enrollmentId: updated.id,
          academicStatus:
            data.checklist?.academicStatus || data.academicStatus || "PROMOTED",
          isSf9Submitted: data.checklist?.isSf9Submitted ?? false,
          isPsaBirthCertPresented:
            data.checklist?.isPsaBirthCertPresented ?? false,
          isOriginalPsaBcCollected:
            data.checklist?.isOriginalPsaBcCollected ??
            data.checklist?.isPsaBirthCertPresented ??
            false,
        },
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_SUBMITTED",
        description:
          processOutcome === "ENCODE_ONLY"
            ? `Registrar encoded BEEF for ${updated.learner.firstName} ${updated.learner.lastName} (#${updated.id}) and routed to AWAITING_VERIFICATION.`
            : `Registrar encoded and verified BEEF for ${updated.learner.firstName} ${updated.learner.lastName} (#${updated.id}).`,
        subjectType: "EnrollmentApplication",
        recordId: updated.id,
        req,
      });

      res.status(201).json(updated);
    } catch (error) {
      console.error("[DEBUG_ERROR] specialEnrollment error:", error);
      next(error);
    }
  }