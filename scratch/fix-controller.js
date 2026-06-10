const fs = require('fs');

const file = 'server/src/features/enrollment/enrollment.controller.ts';
let code = fs.readFileSync(file, 'utf8');

// remove the UTF-16 junk at the end
code = code.replace(/e\0x\0p\0o\0r\0t.*/s, "");
code = code.replace(/export async function directEncodeWalkIn.*/s, "");

const implementation = `

export async function directEncodeWalkIn(req: Request, res: Response) {
  try {
    const payload = req.body;
    const {
      lrn, firstName, lastName, middleName, birthdate, sex,
      gradeLevelId, assignedProgram,
      previousSchoolName, previousGenAve,
      guardianName, guardianContact,
      hasSf9, hasPsa
    } = payload;

    if (!gradeLevelId || !firstName || !lastName || !birthdate || !sex) {
      return res.status(400).json({ message: "Missing required basic fields." });
    }

    const { schoolYearId } = (req as any).currentSchoolYear;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Upsert Learner
      let learner;
      if (lrn) {
        learner = await tx.learner.findUnique({ where: { lrn } });
      }

      if (learner) {
        learner = await tx.learner.update({
          where: { id: learner.id },
          data: {
            firstName,
            lastName,
            middleName: middleName || null,
            birthdate: new Date(birthdate),
            sex: sex,
          }
        });
      } else {
        learner = await tx.learner.create({
          data: {
            lrn: lrn || null,
            firstName,
            lastName,
            middleName: middleName || null,
            birthdate: new Date(birthdate),
            sex: sex,
            isIpCommunity: false,
            isLearnerWithDisability: false,
            is4PsBeneficiary: false,
            hasPwdId: false,
          }
        });
      }

      // 2. Create Application
      const applicationStatus = (hasSf9 && hasPsa) ? "OFFICIALLY_ENROLLED" : "TEMPORARILY_ENROLLED";

      const application = await tx.enrollmentApplication.create({
        data: {
          learnerId: learner.id,
          schoolYearId,
          gradeLevelId,
          applicantType: "REGULAR",
          assignedProgram: assignedProgram || null,
          admissionChannel: "WALK_IN",
          trackingNumber: null, // intentionally null for direct encode
          isTemporarilyEnrolled: applicationStatus === "TEMPORARILY_ENROLLED",
          encodedById: (req as any).user?.userId,
          status: applicationStatus,
          // create previous school if provided
          previousSchools: previousSchoolName ? {
            create: {
              schoolName: previousSchoolName,
              generalAverage: previousGenAve ? parseFloat(previousGenAve) : null,
            }
          } : undefined,
          // create family member
          familyMembers: {
            create: {
              relationship: "GUARDIAN",
              firstName: guardianName,
              lastName: "", // Assuming single field from frontend form for simplicity
              contactNumber: guardianContact,
            }
          }
        }
      });

      // 3. Create Enrollment Record to dump them into Unassigned Pool
      await tx.enrollmentRecord.create({
        data: {
          applicationId: application.id,
          schoolYearId,
          sectionId: null, // UNASSIGNED POOL
        }
      });

      return application;
    });

    return res.status(201).json({ message: "Walk-in application directly encoded", application: result });
  } catch (error) {
    console.error("Error in directEncodeWalkIn:", error);
    return res.status(500).json({ message: "Failed to process walk-in encoding", error: error instanceof Error ? error.message : "Unknown error" });
  }
}
`;

fs.writeFileSync(file, code + implementation, 'utf8');
