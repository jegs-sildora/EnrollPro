import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { normalizeDateToUtcNoon } from "../school-year/school-year.service.js";
import {
  SCP_DEFAULT_PIPELINES,
  getSteSteps,
  type ScpType,
} from "@enrollpro/shared";

function normalizePositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : null;
}

function extractMaxSlotsFromRankingFormula(
  rankingFormula: unknown,
): number | null {
  if (
    !rankingFormula ||
    typeof rankingFormula !== "object" ||
    Array.isArray(rankingFormula)
  ) {
    return null;
  }

  return normalizePositiveInteger(
    (rankingFormula as Record<string, unknown>).maxSlots,
  );
}

function mergeMaxSlotsIntoRankingFormula(
  rankingFormula: unknown,
  maxSlots: unknown,
): Record<string, unknown> | null {
  const baseRankingFormula =
    rankingFormula &&
    typeof rankingFormula === "object" &&
    !Array.isArray(rankingFormula)
      ? { ...(rankingFormula as Record<string, unknown>) }
      : {};

  const normalizedMaxSlots = normalizePositiveInteger(maxSlots);
  if (normalizedMaxSlots == null) {
    delete baseRankingFormula.maxSlots;
  } else {
    baseRankingFormula.maxSlots = normalizedMaxSlots;
  }

  return Object.keys(baseRankingFormula).length > 0 ? baseRankingFormula : null;
}

// ─── Grade Levels ─────────────────────────────────────────

export async function listGradeLevels(
  req: Request,
  res: Response,
): Promise<void> {
  const ayId = parseInt(req.params.ayId as string);
  const gradeLevels = await prisma.gradeLevel.findMany({
    where: { schoolYearId: ayId },
    orderBy: { displayOrder: "asc" },
    include: {
      sections: {
        include: { _count: { select: { enrollmentRecords: true } } },
      },
    },
  });
  res.json({ gradeLevels });
}

export async function createGradeLevel(
  req: Request,
  res: Response,
): Promise<void> {
  const ayId = parseInt(req.params.ayId as string);
  const { name, displayOrder } = req.body;

  if (!name) {
    res.status(400).json({ message: "Name is required" });
    return;
  }

  const count = await prisma.gradeLevel.count({
    where: { schoolYearId: ayId },
  });

  const gl = await prisma.gradeLevel.create({
    data: {
      name,
      displayOrder: displayOrder ?? count + 1,
      schoolYearId: ayId,
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "GRADE_LEVEL_CREATED",
    description: `Created grade level "${name}"`,
    subjectType: "GradeLevel",
    recordId: gl.id,
    req,
  });

  res.status(201).json({ gradeLevel: gl });
}

export async function updateGradeLevel(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(req.params.id as string);
  const { name, displayOrder } = req.body;

  const gl = await prisma.gradeLevel.findUnique({ where: { id } });
  if (!gl) {
    res.status(404).json({ message: "Grade level not found" });
    return;
  }

  const updated = await prisma.gradeLevel.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(displayOrder !== undefined ? { displayOrder } : {}),
    },
  });

  res.json({ gradeLevel: updated });
}

export async function deleteGradeLevel(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(req.params.id as string);

  const gl = await prisma.gradeLevel.findUnique({
    where: { id },
    include: {
      _count: { select: { sections: true, enrollmentApplications: true } },
    },
  });

  if (!gl) {
    res.status(404).json({ message: "Grade level not found" });
    return;
  }

  if (gl._count.enrollmentApplications > 0) {
    res.status(400).json({
      message: "Cannot delete a grade level with existing applicants",
    });
    return;
  }

  await prisma.gradeLevel.delete({ where: { id } });

  await auditLog({
    userId: req.user!.userId,
    actionType: "GRADE_LEVEL_DELETED",
    description: `Deleted grade level "${gl.name}"`,
    subjectType: "GradeLevel",
    recordId: id,
    req,
  });

  res.json({ message: "Grade level deleted" });
}

// ─── SCP Configs ──────────────────────────────────────────

export async function listScpConfigs(
  req: Request,
  res: Response,
): Promise<void> {
  const ayId = parseInt(req.params.ayId as string);
  const scpProgramConfigs = await prisma.scpProgramConfig.findMany({
    where: { schoolYearId: ayId },
    include: {
      options: true,
      steps: { orderBy: { stepOrder: "asc" } },
    },
  });

  // Transform options back to the flat array shape the client expects
  const transformed = scpProgramConfigs.map((cfg) => ({
    ...cfg,
    isTwoPhase: cfg.isTwoPhase ?? false,
    maxSlots: extractMaxSlotsFromRankingFormula(cfg.rankingFormula),
    gradeRequirements: cfg.gradeRequirements ?? null,
    rankingFormula: cfg.rankingFormula ?? null,
    artFields: cfg.options
      .filter((o) => o.optionType === "ART_FIELD")
      .map((o) => o.value),
    languages: cfg.options
      .filter((o) => o.optionType === "LANGUAGE")
      .map((o) => o.value),
    sportsList: cfg.options
      .filter((o) => o.optionType === "SPORT")
      .map((o) => o.value),
    options: undefined,
  }));

  res.json({ scpProgramConfigs: transformed });
}

export async function updateScpConfigs(
  req: Request,
  res: Response,
): Promise<void> {
  const ayId = parseInt(req.params.ayId as string);
  const { scpProgramConfigs } = req.body;

  if (!Array.isArray(scpProgramConfigs)) {
    res.status(400).json({ message: "scpProgramConfigs must be an array" });
    return;
  }

  try {
    const updatedConfigs = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const config of scpProgramConfigs) {
        const {
          id,
          scpType,
          isOffered,
          isTwoPhase,
          maxSlots,
          cutoffScore,
          notes,
          gradeRequirements,
          rankingFormula,
          artFields,
          languages,
          sportsList,
          steps,
        } = config;

        const scpData: Record<string, unknown> = {
          isOffered: isOffered ?? false,
          isTwoPhase: isTwoPhase ?? false,
          cutoffScore: cutoffScore ?? null,
        };

        if (Object.prototype.hasOwnProperty.call(config, "notes")) {
          scpData.notes = notes ?? null;
        }
        if (Object.prototype.hasOwnProperty.call(config, "gradeRequirements")) {
          scpData.gradeRequirements = gradeRequirements ?? null;
        }
        if (
          Object.prototype.hasOwnProperty.call(config, "rankingFormula") ||
          Object.prototype.hasOwnProperty.call(config, "maxSlots")
        ) {
          scpData.rankingFormula = mergeMaxSlotsIntoRankingFormula(
            rankingFormula,
            maxSlots,
          );
        }

        let scpProgramConfig;
        if (id) {
          scpProgramConfig = await tx.scpProgramConfig.update({
            where: { id },
            data: scpData,
          });
          // Delete existing options for this config and re-create
          await tx.scpProgramOption.deleteMany({
            where: { scpProgramConfigId: id },
          });
          // Delete existing steps and re-create
          await tx.scpProgramStep.deleteMany({
            where: { scpProgramConfigId: id },
          });
        } else {
          scpProgramConfig = await tx.scpProgramConfig.create({
            data: { schoolYearId: ayId, scpType, ...scpData },
          });
        }

        // Build option records
        const optionData: any[] = [];
        for (const v of artFields ?? []) {
          optionData.push({
            scpProgramConfigId: scpProgramConfig.id,
            optionType: "ART_FIELD",
            value: v,
          });
        }
        for (const v of languages ?? []) {
          optionData.push({
            scpProgramConfigId: scpProgramConfig.id,
            optionType: "LANGUAGE",
            value: v,
          });
        }
        for (const v of sportsList ?? []) {
          optionData.push({
            scpProgramConfigId: scpProgramConfig.id,
            optionType: "SPORT",
            value: v,
          });
        }
        if (optionData.length > 0) {
          await tx.scpProgramOption.createMany({ data: optionData });
        }

        // Build assessment step records from DepEd pipeline (immutable)
        // Only scheduledDate, scheduledTime, venue, and notes come from the client
        // For STE, select the 1-phase or 2-phase pipeline based on the toggle
        const pipeline =
          scpType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING"
            ? getSteSteps(isTwoPhase ?? false)
            : (SCP_DEFAULT_PIPELINES[scpType as ScpType] ?? []);

        if (isOffered && pipeline.length > 0) {
          // Build a lookup map for client-provided schedule overrides keyed by stepOrder
          const clientSteps = Array.isArray(steps) ? steps : [];
          const scheduleMap = new Map<
            number,
            {
              scheduledDate?: string;
              scheduledTime?: string;
              venue?: string;
              notes?: string;
              cutoffScore?: number;
            }
          >();
          for (const s of clientSteps) {
            if (s.stepOrder) {
              scheduleMap.set(s.stepOrder, s);
            }
          }

          const stepData = pipeline.map((pipelineStep) => {
            const override = scheduleMap.get(pipelineStep.stepOrder);
            return {
              scpProgramConfigId: scpProgramConfig.id,
              stepOrder: pipelineStep.stepOrder,
              kind: pipelineStep.kind as any,
              label: pipelineStep.label,
              description: pipelineStep.description,
              isRequired: pipelineStep.isRequired,
              scheduledDate: override?.scheduledDate
                ? normalizeDateToUtcNoon(new Date(override.scheduledDate))
                : null,
              scheduledTime: override?.scheduledTime ?? null,
              venue: override?.venue ?? null,
              notes: override?.notes ?? null,
              cutoffScore: override?.cutoffScore ?? null,
            };
          });
          await tx.scpProgramStep.createMany({ data: stepData });
        }

        results.push(scpProgramConfig);
      }

      return results;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "SCP_CONFIG_UPDATED",
      description: `Updated SCP configurations for school year ${ayId}`,
      subjectType: "SchoolYear",
      recordId: ayId,
      req,
    });

    res.json({ scpProgramConfigs: updatedConfigs });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Failed to update SCP configs", error: error.message });
  }
}
