const fs = require('fs');
const path = require('path');

const filePath = path.join(
  'c:', 'Users', 'localhost', 'Documents', 'Enrollpro',
  'server', 'src', 'features', 'students', 'controllers', 'students.profile.controller.ts'
);

let content = fs.readFileSync(filePath, 'utf8');

// Add systemPhase and historical checks to updateStudent
content = content.replace(
  /const applicant = await deps\.prisma\.enrollmentApplication\.findUnique\(\{\s+where: \{ id: parsedId \},\s+include: \{ learner: true \},\s+\}\);/,
  `const applicant = await deps.prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        include: { learner: true, schoolYear: true },
      });

      const setting = await deps.prisma.schoolSetting.findFirst();
      if (setting?.systemPhase === "EOSY_CLOSING") {
        return res.status(403).json({ message: "Cannot edit core demographics during EOSY Closing phase." });
      }
      
      if (applicant && applicant.schoolYear && applicant.schoolYear.status !== "ACTIVE" && applicant.schoolYear.status !== "ENROLLMENT_OPEN") {
        return res.status(403).json({ message: "Cannot edit historical records." });
      }`
);

// Add the new endpoints
const newMethods = `
  const updateLrn = async (req: Request, res: Response) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) return res.status(400).json({ message: "Invalid student id" });

      const setting = await deps.prisma.schoolSetting.findFirst();
      if (setting?.systemPhase === "EOSY_CLOSING") {
        return res.status(403).json({ message: "Cannot modify LRN during EOSY Closing phase." });
      }

      const applicant = await deps.prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        include: { learner: true, schoolYear: true },
      });

      if (!applicant) return res.status(404).json({ message: "Student not found" });

      if (applicant.schoolYear && applicant.schoolYear.status !== "ACTIVE" && applicant.schoolYear.status !== "ENROLLMENT_OPEN") {
        return res.status(403).json({ message: "Cannot edit historical records." });
      }

      const { lrn } = req.body;

      const updated = await deps.prisma.learner.update({
        where: { id: applicant.learnerId },
        data: { lrn },
      });

      await deps.prisma.auditLog.create({
        data: {
          userId,
          actionType: "LRN_UPDATED",
          description: \`Updated LRN for \${updated.firstName} \${updated.lastName} to \${lrn}\`,
          subjectType: "Learner",
          recordId: updated.id,
          ipAddress: req.ip || "unknown",
          userAgent: req.headers["user-agent"] || null,
        },
      });

      res.json({ message: "LRN updated successfully", learner: updated });
    } catch (error) {
      console.error("Error updating LRN:", error);
      res.status(500).json({ message: "Failed to update LRN" });
    }
  };

  const markDropout = async (req: Request, res: Response) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) return res.status(400).json({ message: "Invalid student id" });

      const setting = await deps.prisma.schoolSetting.findFirst();
      if (setting?.systemPhase === "EOSY_CLOSING") {
        return res.status(403).json({ message: "Cannot modify dropout status during EOSY Closing phase." });
      }

      const applicant = await deps.prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        include: { enrollmentRecord: true, learner: true, schoolYear: true },
      });

      if (!applicant) return res.status(404).json({ message: "Student not found" });

      if (applicant.schoolYear && applicant.schoolYear.status !== "ACTIVE" && applicant.schoolYear.status !== "ENROLLMENT_OPEN") {
        return res.status(403).json({ message: "Cannot modify historical records." });
      }

      const { dropOutDate, reasonCode, reasonNote } = req.body;
      const record = applicant.enrollmentRecord;

      await deps.prisma.$transaction(async (tx) => {
        if (record) {
          await tx.enrollmentRecord.update({
            where: { id: record.id },
            data: { 
              eosyStatus: "DROPPED_OUT", 
              dropOutReason: reasonCode, 
              dropOutDate: dropOutDate ? new Date(dropOutDate) : null 
            },
          });
        }
        await tx.learner.update({
          where: { id: applicant.learnerId },
          data: { status: "DROPPED" },
        });
        await tx.enrollmentApplication.update({
          where: { id: parsedId },
          data: { status: "DROPPED" },
        });
      });

      await deps.prisma.auditLog.create({
        data: {
          userId,
          actionType: "STUDENT_DROPPED_OUT",
          description: \`Marked \${applicant.learner.firstName} \${applicant.learner.lastName} as DROPPED_OUT\`,
          subjectType: "EnrollmentApplication",
          recordId: parsedId,
          ipAddress: req.ip || "unknown",
          userAgent: req.headers["user-agent"] || null,
        },
      });

      res.json({ message: "Student marked as dropped out successfully" });
    } catch (error) {
      console.error("Error marking dropout:", error);
      res.status(500).json({ message: "Failed to mark dropout" });
    }
  };

  const markTransferredOut = async (req: Request, res: Response) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) return res.status(400).json({ message: "Invalid student id" });

      const setting = await deps.prisma.schoolSetting.findFirst();
      if (setting?.systemPhase === "EOSY_CLOSING") {
        return res.status(403).json({ message: "Cannot modify transfer status during EOSY Closing phase." });
      }

      const applicant = await deps.prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        include: { enrollmentRecord: true, learner: true, schoolYear: true },
      });

      if (!applicant) return res.status(404).json({ message: "Student not found" });

      if (applicant.schoolYear && applicant.schoolYear.status !== "ACTIVE" && applicant.schoolYear.status !== "ENROLLMENT_OPEN") {
        return res.status(403).json({ message: "Cannot modify historical records." });
      }

      const { transferDate, destinationSchool, reasonNote } = req.body;
      const record = applicant.enrollmentRecord;

      await deps.prisma.$transaction(async (tx) => {
        if (record) {
          await tx.enrollmentRecord.update({
            where: { id: record.id },
            data: { 
              eosyStatus: "TRANSFERRED_OUT", 
              transferOutDate: transferDate ? new Date(transferDate) : null 
            },
          });
        }
        await tx.learner.update({
          where: { id: applicant.learnerId },
          data: { status: "TRANSFERRED_OUT" },
        });
        await tx.enrollmentApplication.update({
          where: { id: parsedId },
          data: { status: "TRANSFERRED_OUT" },
        });
      });

      await deps.prisma.auditLog.create({
        data: {
          userId,
          actionType: "STUDENT_TRANSFERRED_OUT",
          description: \`Marked \${applicant.learner.firstName} \${applicant.learner.lastName} as TRANSFERRED_OUT\`,
          subjectType: "EnrollmentApplication",
          recordId: parsedId,
          ipAddress: req.ip || "unknown",
          userAgent: req.headers["user-agent"] || null,
        },
      });

      res.json({ message: "Student marked as transferred out successfully" });
    } catch (error) {
      console.error("Error marking transfer out:", error);
      res.status(500).json({ message: "Failed to mark transfer out" });
    }
  };
`;

content = content.replace(
  /return \{\s+updateStudent,\s+resetPortalPin,\s+clearDeficiency,\s+verifyPsa,\s+\};/,
  newMethods + "\n  return {\n    updateStudent,\n    resetPortalPin,\n    clearDeficiency,\n    verifyPsa,\n    updateLrn,\n    markDropout,\n    markTransferredOut,\n  };"
);

content = content.replace(
  /export const \{ updateStudent, resetPortalPin, clearDeficiency, verifyPsa \} =/,
  "export const { updateStudent, resetPortalPin, clearDeficiency, verifyPsa, updateLrn, markDropout, markTransferredOut } ="
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated students.profile.controller.ts");
