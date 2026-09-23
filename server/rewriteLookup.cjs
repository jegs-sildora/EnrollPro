const fs = require('fs');
let code = fs.readFileSync('src/features/admission/admission.controller.ts', 'utf8');

const newCode = `
export async function getLearnerProfile(req: Request, res: Response) {
  try {
    const lrn = String(req.params.lrn ?? "").trim();
    if (!/^\\d{12}$/.test(lrn)) {
      res.status(400).json({ message: "Invalid LRN format. Must be exactly 12 digits." });
      return;
    }

    const setting = await prisma.schoolSetting.findFirst({
      where: { activeSchoolYearId: { not: null } },
      select: { activeSchoolYearId: true },
    });

    if (!setting?.activeSchoolYearId) {
      res.status(400).json({ message: "No active school year configured." });
      return;
    }

    const learner = await prisma.learner.findUnique({
      where: { lrn },
      include: {
        enrollmentApplications: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            scpProfile: true,
            addresses: true,
            familyMembers: true,
            previousSchool: true,
          },
        },
        scpAdmissions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            addresses: true,
            familyMembers: true,
            previousSchool: true,
          }
        }
      },
    });

    if (!learner) {
      res.status(404).json({ message: "Learner not found." });
      return;
    }

    const application = learner.enrollmentApplications[0];
    const admission = learner.scpAdmissions[0];
    
    // Choose the most recent source for demographic data
    let demographicSource: typeof application | typeof admission | null = null;
    if (application && admission) {
      demographicSource = application.createdAt > admission.createdAt ? application : admission;
    } else {
      demographicSource = application || admission;
    }

    const isActiveYearApp = application?.schoolYearId === setting.activeSchoolYearId;
    const isScp = isActiveYearApp && application?.applicantType !== "REGULAR";

    // Only return QUALIFIED SCP program to enforce locking, otherwise default to what they had
    let scpAdmissionStatus = null;
    if (admission?.schoolYearId === setting.activeSchoolYearId) {
      scpAdmissionStatus = admission.assessmentResult;
    } else if (isScp && application?.scpProfile) {
      scpAdmissionStatus = application.scpProfile.assessmentResult;
    }

    let scpProgram = null;
    if (scpAdmissionStatus === "QUALIFIED" && admission) {
      scpProgram = admission.program;
    } else if (isScp) {
      scpProgram = application.applicantType;
    }

    res.json({
      // Core Learner Demographics
      id: learner.id,
      firstName: learner.firstName,
      lastName: learner.lastName,
      middleName: learner.middleName,
      extensionName: learner.extensionName,
      birthdate: learner.birthdate,
      sex: learner.sex,
      placeOfBirth: learner.placeOfBirth,
      religion: learner.religion,
      motherTongue: learner.motherTongue,
      isIpCommunity: learner.isIpCommunity,
      ipGroupName: learner.ipGroupName,
      isLearnerWithDisability: learner.isLearnerWithDisability,
      disabilityTypes: learner.disabilityTypes,
      is4PsBeneficiary: learner.is4PsBeneficiary,
      householdId4Ps: learner.householdId4Ps,
      hasPwdId: learner.hasPwdId,
      isBalikAral: learner.isBalikAral,
      lastGradeLevel: learner.lastGradeLevel,
      lastYearEnrolled: learner.lastYearEnrolled,
      psaBirthCertNumber: learner.psaBirthCertNumber,
      specialNeedsCategory: learner.specialNeedsCategory,
      studentPhoto: learner.studentPhoto,

      // Previous Application Data (for auto-filling addresses, family, previous school)
      addresses: demographicSource?.addresses || [],
      familyMembers: demographicSource?.familyMembers || [],
      previousSchool: demographicSource?.previousSchool || null,

      // SCP Status
      scpAdmissionStatus,
      scpProgram,
    });
  } catch (error) {
    console.error("Failed to fetch learner profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
`;

const startIdx = code.indexOf('export async function getLearnerProfile');
const endIdx = code.indexOf('export async function submitAdmission');
code = code.substring(0, startIdx) + newCode + '\n' + code.substring(endIdx);

fs.writeFileSync('src/features/admission/admission.controller.ts', code);
