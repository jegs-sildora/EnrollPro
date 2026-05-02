import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { normalizeDateToUtcNoon } from "../school-year/school-year.service.js";
import {
  SCP_DEFAULT_PIPELINES,
  getSteSteps,
  type ScpType,
} from "@enrollpro/shared";
import { Prisma } from "../../generated/prisma/index.js";

// ─── Helpers ──────────────────────────────────────────────

function normalizePositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : null;
}

function extractMaxSlotsFromRankingFormula(rankingFormula: unknown): number | null {
  if (!rankingFormula || typeof rankingFormula !== "object" || Array.isArray(rankingFormula)) return null;
  return normalizePositiveInteger((rankingFormula as Record<string, unknown>).maxSlots);
}

function mergeMaxSlotsIntoRankingFormula(rankingFormula: unknown, maxSlots: unknown): Record<string, unknown> | null {
  const baseRankingFormula = rankingFormula && typeof rankingFormula === "object" && !Array.isArray(rankingFormula)
    ? { ...(rankingFormula as Record<string, unknown>) }
    : {};
  const normalizedMaxSlots = normalizePositiveInteger(maxSlots);
  if (normalizedMaxSlots == null) delete baseRankingFormula.maxSlots;
  else baseRankingFormula.maxSlots = normalizedMaxSlots;
  return Object.keys(baseRankingFormula).length > 0 ? baseRankingFormula : null;
}

/**
 * Standard transformation of ScpProgramConfig with its relations 
 * into the shape the frontend expects.
 */
async function transformScpConfigs(configs: any[]) {
  return configs.map((cfg) => ({
    id: cfg.id,
    scpType: cfg.scpType,
    isOffered: cfg.isOffered,
    isTwoPhase: cfg.isTwoPhase ?? false,
    maxSlots: extractMaxSlotsFromRankingFormula(cfg.rankingFormula),
    cutoffScore: cfg.cutoffScore,
    notes: cfg.notes,
    gradeRequirements: cfg.gradeRequirements,
    rankingFormula: cfg.rankingFormula,
    artFields: cfg.options.filter((o: any) => o.optionType === "ART_FIELD").map((o: any) => o.value),
    languages: cfg.options.filter((o: any) => o.optionType === "LANGUAGE").map((o: any) => o.value),
    sportsList: cfg.options.filter((o: any) => o.optionType === "SPORT").map((o: any) => o.value),
    steps: cfg.steps.map((step: any) => ({
      id: step.id,
      stepOrder: step.stepOrder,
      kind: step.kind,
      label: step.label,
      description: step.description,
      isRequired: step.isRequired,
      scheduledDate: step.scheduledDate,
      scheduledTime: step.scheduledTime,
      venue: step.venue,
      notes: step.notes,
      cutoffScore: step.cutoffScore,
      // Map relational rubric back to JSON array for UI
      rubric: (step.rubricCategories || []).map((cat: any) => ({
        id: String(cat.id),
        name: cat.name,
        criteria: (cat.criteria || []).map((crit: any) => ({
          id: String(crit.id),
          name: crit.name,
          description: crit.description,
          maxPts: crit.maxPts,
        })),
      })),
    })),
  }));
}

const SCP_FETCH_INCLUDE = {
  options: true,
  steps: {
    orderBy: { stepOrder: "asc" as const },
    include: {
      rubricCategories: {
        orderBy: { displayOrder: "asc" as const },
        include: {
          criteria: { orderBy: { displayOrder: "asc" as const } },
        },
      },
    },
  },
};

// ─── Grade Levels ─────────────────────────────────────────

export async function listGradeLevels(req: Request, res: Response): Promise<void> {
  const ayId = parseInt(req.params.ayId as string);
  const gradeLevels = await prisma.gradeLevel.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      sections: {
        where: { schoolYearId: ayId },
        include: { _count: { select: { enrollmentRecords: true } } },
      },
    },
  });
  res.json({ gradeLevels });
}

export async function createGradeLevel(req: Request, res: Response): Promise<void> {
  const { name, displayOrder } = req.body;
  if (!name) {
    res.status(400).json({ message: "Name is required" });
    return;
  }
  const count = await prisma.gradeLevel.count();
  const gl = await prisma.gradeLevel.create({
    data: { name, displayOrder: displayOrder ?? count + 1 },
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

export async function updateGradeLevel(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  const { name, displayOrder } = req.body;
  const gl = await prisma.gradeLevel.findUnique({ where: { id } });
  if (!gl) {
    res.status(404).json({ message: "Grade level not found" });
    return;
  }
  const updated = await prisma.gradeLevel.update({
    where: { id },
    data: { ...(name ? { name } : {}), ...(displayOrder !== undefined ? { displayOrder } : {}) },
  });
  res.json({ gradeLevel: updated });
}

export async function deleteGradeLevel(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  const gl = await prisma.gradeLevel.findUnique({
    where: { id },
    include: { _count: { select: { sections: true, enrollmentApplications: true } } },
  });
  if (!gl) {
    res.status(404).json({ message: "Grade level not found" });
    return;
  }
  if (gl._count.enrollmentApplications > 0) {
    res.status(400).json({ message: "Cannot delete a grade level with existing applicants" });
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

export async function listScpConfigs(req: Request, res: Response): Promise<void> {
  const ayId = parseInt(req.params.ayId as string);
  const scpProgramConfigs = await prisma.scpProgramConfig.findMany({
    where: { schoolYearId: ayId },
    include: SCP_FETCH_INCLUDE,
  });
  const transformed = await transformScpConfigs(scpProgramConfigs);
  res.json({ scpProgramConfigs: transformed });
}

export async function updateScpConfigs(req: Request, res: Response): Promise<void> {
  const ayId = parseInt(req.params.ayId as string);
  const { scpProgramConfigs } = req.body;

  if (!Array.isArray(scpProgramConfigs)) {
    res.status(400).json({ message: "scpProgramConfigs must be an array" });
    return;
  }

  try {
    const finalConfigs = await prisma.$transaction(async (tx) => {
      for (const config of scpProgramConfigs) {
        const {
          id, scpType, isOffered, isTwoPhase, maxSlots, cutoffScore,
          notes, gradeRequirements, rankingFormula, artFields,
          languages, sportsList, steps,
        } = config;

        const scpData: Record<string, any> = {
          isOffered: isOffered ?? false,
          isTwoPhase: isTwoPhase ?? false,
          cutoffScore: cutoffScore ?? null,
        };

        if (Object.prototype.hasOwnProperty.call(config, "notes")) scpData.notes = notes ?? null;
        if (Object.prototype.hasOwnProperty.call(config, "gradeRequirements"))
          scpData.gradeRequirements = gradeRequirements ?? null;
        if (Object.prototype.hasOwnProperty.call(config, "rankingFormula") || Object.prototype.hasOwnProperty.call(config, "maxSlots")) {
          scpData.rankingFormula = mergeMaxSlotsIntoRankingFormula(rankingFormula, maxSlots);
        }

        let scpProgramConfig;
        if (id) {
          scpProgramConfig = await tx.scpProgramConfig.update({ where: { id }, data: scpData });
          await tx.scpProgramOption.deleteMany({ where: { scpProgramConfigId: id } });
          await tx.scpProgramStep.deleteMany({ where: { scpProgramConfigId: id } });
        } else {
          scpProgramConfig = await tx.scpProgramConfig.create({
            data: { schoolYearId: ayId, scpType, ...scpData },
          });
        }

        const optionData = [
          ...(artFields ?? []).map((v: string) => ({ scpProgramConfigId: scpProgramConfig.id, optionType: "ART_FIELD" as const, value: v })),
          ...(languages ?? []).map((v: string) => ({ scpProgramConfigId: scpProgramConfig.id, optionType: "LANGUAGE" as const, value: v })),
          ...(sportsList ?? []).map((v: string) => ({ scpProgramConfigId: scpProgramConfig.id, optionType: "SPORT" as const, value: v })),
        ];
        if (optionData.length > 0) await tx.scpProgramOption.createMany({ data: optionData });

        const pipeline = scpType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING"
          ? getSteSteps(isTwoPhase ?? false)
          : (SCP_DEFAULT_PIPELINES[scpType as ScpType] ?? []);

        if (isOffered && pipeline.length > 0) {
          const clientStepMap = new Map<string, any>();
          (steps || []).forEach((s: any) => {
            clientStepMap.set(`order-${s.stepOrder}`, s);
            if (s.kind) clientStepMap.set(`kind-${s.kind}`, s);
          });

          for (const pipelineStep of pipeline) {
            const clientStep = clientStepMap.get(`order-${pipelineStep.stepOrder}`) || clientStepMap.get(`kind-${pipelineStep.kind}`);
            
            // USE ATOMIC NESTED CREATE FOR GUARANTEED RELATIONAL INTEGRITY
            const rubricData = clientStep?.rubric;
            const hasRubric = Array.isArray(rubricData) && rubricData.length > 0;

            await tx.scpProgramStep.create({
              data: {
                scpProgramConfigId: scpProgramConfig.id,
                stepOrder: pipelineStep.stepOrder,
                kind: pipelineStep.kind as any,
                label: pipelineStep.label,
                description: pipelineStep.description,
                isRequired: pipelineStep.isRequired,
                scheduledDate: clientStep?.scheduledDate ? normalizeDateToUtcNoon(new Date(clientStep.scheduledDate)) : null,
                scheduledTime: clientStep?.scheduledTime ?? null,
                venue: clientStep?.venue ?? null,
                notes: clientStep?.notes ?? null,
                cutoffScore: clientStep?.cutoffScore ?? null,
                rubric: rubricData || null, // Keep JSON for safety
                rubricCategories: hasRubric ? {
                  create: rubricData.map((cat: any, i: number) => ({
                    name: cat.name || "Unnamed Category",
                    displayOrder: i,
                    criteria: {
                      create: (cat.criteria || []).map((crit: any, j: number) => ({
                        name: crit.name || "Unnamed Criterion",
                        description: crit.description || null,
                        maxPts: Number(crit.maxPts) || 0,
                        displayOrder: j
                      }))
                    }
                  }))
                } : undefined
              },
            });
          }
        }
      }

      return tx.scpProgramConfig.findMany({
        where: { schoolYearId: ayId },
        include: SCP_FETCH_INCLUDE,
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "SCP_CONFIG_UPDATED",
      description: `Updated SCP configurations for school year ${ayId}`,
      subjectType: "SchoolYear",
      recordId: ayId,
      req,
    });

    const transformed = await transformScpConfigs(finalConfigs);
    res.json({ scpProgramConfigs: transformed });
  } catch (error: any) {
    console.error("Update SCP Configs Error:", error);
    res.status(500).json({ message: "Failed to update SCP configs", error: error.message });
  }
}
