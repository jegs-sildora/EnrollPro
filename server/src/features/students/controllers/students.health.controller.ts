import { Request, Response } from "express";
import {
  createStudentsControllerDeps,
  StudentsControllerDeps,
} from "../services/students-controller.deps.js";

const getRequestUserId = (req: Request): number | null => {
  const userId = (req as any).user?.userId;
  return typeof userId === "number" ? userId : null;
};

export const createStudentsHealthController = (
  deps: StudentsControllerDeps = createStudentsControllerDeps(),
) => {
  const getHealthRecords = async (req: Request, res: Response) => {
    try {
      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) {
        return res.status(400).json({ message: "Invalid student id" });
      }

      // Resolve learnerId from enrollment application
      const app = await deps.prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        select: { learnerId: true },
      });
      if (!app) {
        return res.status(404).json({ message: "Student not found" });
      }

      const records = await deps.prisma.healthRecord.findMany({
        where: { learnerId: app.learnerId },
        include: {
          schoolYear: {
            select: { yearLabel: true },
          },
          recordedBy: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: { assessmentDate: "desc" },
      });

      res.json({ records });
    } catch (error) {
      console.error("Error fetching health records:", error);
      res.status(500).json({ message: "Failed to fetch health records" });
    }
  };

  const addHealthRecord = async (req: Request, res: Response) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const {
        schoolYearId,
        assessmentPeriod,
        assessmentDate,
        weightKg,
        heightCm,
        notes,
      } = req.body;

      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      const parsedSchoolYearId = Number.parseInt(schoolYearId as string, 10);

      if (Number.isNaN(parsedId) || Number.isNaN(parsedSchoolYearId)) {
        return res
          .status(400)
          .json({ message: "Invalid student or school year id" });
      }

      // Resolve learnerId from enrollment application
      const app = await deps.prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        select: { learnerId: true },
      });
      if (!app) {
        return res.status(404).json({ message: "Student not found" });
      }

      const existingRecord = await deps.prisma.healthRecord.findFirst({
        where: {
          learnerId: app.learnerId,
          schoolYearId: parsedSchoolYearId,
          assessmentPeriod,
        },
        include: {
          schoolYear: true,
        },
      });

      if (existingRecord) {
        const periodLabel = assessmentPeriod === "BOSY" ? "BoSY" : "EoSY";
        const yearLabel = existingRecord.schoolYear.yearLabel;
        return res.status(422).json({
          message: `A ${periodLabel} record already exists for this learner for SY ${yearLabel}.`,
        });
      }

      const record = await deps.prisma.healthRecord.create({
        data: {
          learnerId: app.learnerId,
          schoolYearId: parsedSchoolYearId,
          assessmentPeriod,
          assessmentDate: deps.normalizeDateToUtcNoon(new Date(assessmentDate)),
          weightKg: parseFloat(weightKg as string),
          heightCm: parseFloat(heightCm as string),
          notes,
          recordedById: userId,
        },
        include: {
          schoolYear: true,
          learner: true,
          recordedBy: true,
        },
      });

      const userName = record.recordedBy
        ? `${record.recordedBy.firstName} ${record.recordedBy.lastName}`
        : "HEAD_REGISTRAR";
      const learnerName = `${record.learner.firstName} ${record.learner.lastName}`;
      const yearLabel = record.schoolYear.yearLabel;
      const periodLabel = assessmentPeriod === "BOSY" ? "BoSY" : "EoSY";

      await deps.prisma.auditLog.create({
        data: {
          userId,
          actionType: "HEALTH_RECORD_ADDED",
          description: `${userName} added ${periodLabel} health record for ${learnerName}, SY ${yearLabel} - Weight: ${record.weightKg}kg, Height: ${record.heightCm}cm`,
          subjectType: "HealthRecord",
          recordId: record.id,
          ipAddress: req.ip || "unknown",
          userAgent: req.headers["user-agent"] || null,
        },
      });

      res
        .status(201)
        .json({ message: "Health record added successfully", record });
    } catch (error) {
      console.error("Error adding health record:", error);
      res.status(500).json({ message: "Failed to add health record" });
    }
  };

  const updateHealthRecord = async (req: Request, res: Response) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsedRecordId = Number.parseInt(
        String(req.params.recId ?? ""),
        10,
      );
      if (Number.isNaN(parsedRecordId)) {
        return res.status(400).json({ message: "Invalid health record id" });
      }

      const { assessmentPeriod, assessmentDate, weightKg, heightCm, notes } =
        req.body;

      const record = await deps.prisma.healthRecord.update({
        where: { id: parsedRecordId },
        data: {
          assessmentPeriod,
          assessmentDate: assessmentDate
            ? deps.normalizeDateToUtcNoon(new Date(assessmentDate))
            : undefined,
          weightKg: weightKg ? parseFloat(weightKg as string) : undefined,
          heightCm: heightCm ? parseFloat(heightCm as string) : undefined,
          notes,
        },
        include: {
          learner: true,
        },
      });

      const user = await deps.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      const userName = user
        ? `${user.firstName} ${user.lastName}`
        : "HEAD_REGISTRAR";
      const learnerName = `${record.learner.firstName} ${record.learner.lastName}`;

      const changedFields = [];
      if (assessmentPeriod) changedFields.push("period");
      if (assessmentDate) changedFields.push("date");
      if (weightKg) changedFields.push("weight");
      if (heightCm) changedFields.push("height");
      if (notes !== undefined) changedFields.push("notes");
      const changedStr =
        changedFields.length > 0 ? changedFields.join(", ") : "details";

      await deps.prisma.auditLog.create({
        data: {
          userId,
          actionType: "HEALTH_RECORD_UPDATED",
          description: `${userName} updated health record #${record.id} for ${learnerName} - Changed: ${changedStr}`,
          subjectType: "HealthRecord",
          recordId: record.id,
          ipAddress: req.ip || "unknown",
          userAgent: req.headers["user-agent"] || null,
        },
      });

      res.json({ message: "Health record updated successfully", record });
    } catch (error) {
      console.error("Error updating health record:", error);
      res.status(500).json({ message: "Failed to update health record" });
    }
  };

  return {
    getHealthRecords,
    addHealthRecord,
    updateHealthRecord,
  };
};

const studentsHealthController = createStudentsHealthController();

export const { getHealthRecords, addHealthRecord, updateHealthRecord } =
  studentsHealthController;
