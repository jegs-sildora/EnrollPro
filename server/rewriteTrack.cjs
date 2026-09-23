const fs = require('fs');
let code = fs.readFileSync('src/features/admission/admission.controller.ts', 'utf8');

const newCode = `
export async function trackApplication(req: Request, res: Response) {
  try {
    const trackingNumber = String(req.params.trackingNumber ?? "").trim().toUpperCase();

    if (!/^[A-Z0-9-]{8,24}$/.test(trackingNumber)) {
      res.status(400).json({ message: "Enter a valid tracking number." });
      return;
    }

    if (trackingNumber.startsWith("ADM-")) {
      const admission = await prisma.scpAdmission.findUnique({
        where: { trackingNumber },
        select: {
          trackingNumber: true,
          program: true,
          createdAt: true,
          assessmentResult: true,
          requirementsStatus: true,
          writtenExamStatus: true,
          interviewStatus: true,
          learner: {
            select: { firstName: true, middleName: true, lastName: true },
          },
        },
      });

      if (!admission) {
        res.status(404).json({ message: "No application found for the provided Tracking Number." });
        return;
      }

      const { learner, ...appData } = admission;
      const applicantName = \`\${learner.firstName} \${learner.middleName ? learner.middleName + ' ' : ''}\${learner.lastName}\`;

      res.status(200).json({
        trackingNumber: appData.trackingNumber,
        applicantName,
        createdAt: appData.createdAt,
        program: appData.program,
        assessmentResult: appData.assessmentResult,
        requirementsStatus: appData.requirementsStatus,
        writtenExamStatus: appData.writtenExamStatus,
        interviewStatus: appData.interviewStatus,
        application_type: "ADMISSION",
      });
      return;
    }

    const application = await prisma.enrollmentApplication.findUnique({
      where: { trackingNumber },
      select: {
        trackingNumber: true,
        applicantType: true,
        status: true,
        createdAt: true,
        complianceStatus: true,
        learnerType: true,
        scpAdmission: {
          select: { 
            assessmentResult: true, 
            requirementsStatus: true,
            writtenExamStatus: true,
            interviewStatus: true
          },
        },
        learner: {
          select: { firstName: true, middleName: true, lastName: true },
        },
        gradeLevel: {
          select: { name: true },
        },
        enrollmentRecord: {
          select: {
            enrolledAt: true,
            section: { select: { name: true } },
          },
        },
      },
    });

    if (!application) {
      res.status(404).json({ message: "No application found for the provided Tracking Number." });
      return;
    }

    const { learner, enrollmentRecord, gradeLevel, scpAdmission, ...appData } = application;
    const applicantName = \`\${learner.firstName} \${learner.middleName ? learner.middleName + ' ' : ''}\${learner.lastName}\`;
    
    let application_type = "ENROLLMENT";
    if (appData.applicantType !== "REGULAR" && appData.learnerType !== "NEW_ENROLLEE" && appData.learnerType !== "TRANSFEREE") {
      // Actually it's just ENROLLMENT now because admission is separated!
      application_type = "ENROLLMENT";
    }

    res.status(200).json({
      trackingNumber: appData.trackingNumber,
      applicantName,
      createdAt: appData.createdAt,
      status: appData.status,
      complianceStatus: appData.complianceStatus,
      applicantType: appData.applicantType,
      gradeLevel: gradeLevel.name,
      scpAdmissionStatus: scpAdmission?.assessmentResult || null,
      scpProgram: scpAdmission ? appData.applicantType : null,
      section: enrollmentRecord?.section?.name || null,
      enrolledAt: enrollmentRecord?.enrolledAt || null,
      application_type,
    });
  } catch (error) {
    console.error("Failed to track application:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
`;

const startIdx = code.indexOf('export async function trackApplication');
const endIdx = code.indexOf('export async function validateLrn');
code = code.substring(0, startIdx) + newCode + '\n' + code.substring(endIdx);

fs.writeFileSync('src/features/admission/admission.controller.ts', code);
