import { prisma as defaultPrisma } from "../../../lib/prisma.js";
import type { ApplicantType } from "../../../generated/prisma/index.js";

interface RankingWeights {
  weights: Record<string, number>;
}

interface RankingFormulaComponent {
  key: string;
  weight: number;
}

const DEFAULT_RANKING_WEIGHTS: Record<string, number> = {
  QUALIFYING_EXAMINATION: 0.6,
  INTERVIEW: 0.2,
  GRADE_AVERAGE: 0.2,
};

const LEGACY_RANKING_KEY_MAP: Record<string, string> = {
  QUALIFYINGEXAM: "QUALIFYING_EXAMINATION",
  QUALIFYINGEXAMINATION: "QUALIFYING_EXAMINATION",
  EXAM: "QUALIFYING_EXAMINATION",
  INTERVIEW: "INTERVIEW",
  PREVIOUSGENAVE: "GRADE_AVERAGE",
  GENERALAVERAGE: "GRADE_AVERAGE",
  GRADEAVERAGE: "GRADE_AVERAGE",
};

function normalizeFormulaKey(key: string): string {
  const compactKey = key.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return LEGACY_RANKING_KEY_MAP[compactKey] ?? key.trim().toUpperCase();
}

export interface RankingResult {
  applicationId: number;
  firstName: string;
  lastName: string;
  lrn: string | null;
  compositeScore: number;
  breakdown: Record<string, number>;
}

function resolveFormulaWeights(
  rankingFormula: unknown,
): Record<string, number> {
  if (!rankingFormula || typeof rankingFormula !== "object") {
    return {};
  }

  const formulaRecord = rankingFormula as Record<string, unknown>;

  // Backward-compatible support for legacy { weights: { EXAM: 0.5, ... } } shape.
  const legacyWeights = formulaRecord.weights;
  if (legacyWeights && typeof legacyWeights === "object" && !Array.isArray(legacyWeights)) {
    const parsed = Object.fromEntries(
      Object.entries(legacyWeights as Record<string, unknown>)
        .map(([key, value]) => [normalizeFormulaKey(key), Number(value)] as const)
        .filter(([, value]) => Number.isFinite(value) && value > 0),
    );
    if (Object.keys(parsed).length > 0) {
      return parsed;
    }
  }

  const parsedFromFlatRecord = Object.fromEntries(
    Object.entries(formulaRecord)
      .filter(([key]) => key !== "components" && key !== "weights" && key !== "maxSlots")
      .map(([key, value]) => [normalizeFormulaKey(key), Number(value)] as const)
      .filter(([, value]) => Number.isFinite(value) && value > 0),
  );

  if (Object.keys(parsedFromFlatRecord).length > 0) {
    return parsedFromFlatRecord;
  }

  // Current shape: { components: [{ key, weight, label? }, ...] }.
  const components = formulaRecord.components;
  if (!Array.isArray(components)) {
    return {};
  }

  const parsedFromComponents: RankingFormulaComponent[] = [];
  for (const component of components) {
    if (!component || typeof component !== "object" || Array.isArray(component)) {
      continue;
    }

    const row = component as Record<string, unknown>;
    const key = normalizeFormulaKey(String(row.key ?? ""));
    const weight = Number(row.weight ?? NaN);

    if (!key || !Number.isFinite(weight) || weight <= 0) {
      continue;
    }

    parsedFromComponents.push({ key, weight });
  }

  if (parsedFromComponents.length === 0) {
    return {};
  }

  const totalWeight = parsedFromComponents.reduce(
    (sum, component) => sum + component.weight,
    0,
  );
  const useFractionalWeights = totalWeight <= 1.0001;

  return Object.fromEntries(
    parsedFromComponents.map((component) => [
      component.key,
      useFractionalWeights ? component.weight : component.weight / 100,
    ]),
  );
}

/**
 * Compute a weighted composite ranking score for a single SCP enrollment application.
 * Uses `ScpProgramConfig.rankingFormula` weights × assessment scores + generalAverage.
 */
export async function computeRanking(
  applicationId: number,
  rankingFormula: RankingWeights | Record<string, number>,
  prisma: typeof defaultPrisma = defaultPrisma,
): Promise<{ compositeScore: number; breakdown: Record<string, number> }> {
  const weights =
    "weights" in rankingFormula
      ? resolveFormulaWeights(rankingFormula)
      : rankingFormula;

  if (Object.keys(weights).length === 0) {
    return { compositeScore: 0, breakdown: {} };
  }

  const application = await prisma.enrollmentApplication.findUnique({
    where: { id: applicationId },
    include: {
      earlyRegistration: {
        include: { assessments: true },
      },
      previousSchool: true,
    },
  });

  if (!application) {
    return { compositeScore: 0, breakdown: {} };
  }

  const assessments = application.earlyRegistration?.assessments ?? [];
  const previousSchool = application.previousSchool;

  const breakdown: Record<string, number> = {};
  let compositeScore = 0;

  // Assessment-based weights (EXAM, INTERVIEW, etc.)
  for (const [key, weight] of Object.entries(weights)) {
    if (key === "GRADE_AVERAGE") {
      const avg = previousSchool?.generalAverage ?? 0;
      const weighted = avg * weight;
      breakdown[key] = weighted;
      compositeScore += weighted;
    } else {
      // Match assessment type to weight key
      const assessment = assessments.find(
        (a) =>
          a.type === key || a.type.replace(/_/g, "") === key.replace(/_/g, ""),
      );
      const score = assessment?.score ?? 0;
      const weighted = score * weight;
      breakdown[key] = weighted;
      compositeScore += weighted;
    }
  }

  return { compositeScore: Math.round(compositeScore * 10000) / 10000, breakdown };
}

/**
 * Fetch and rank all SCP enrollment applications of a given type for a school year.
 */
export async function getSCPRankings(
  schoolYearId: number,
  scpType: ApplicantType,
  prisma: typeof defaultPrisma = defaultPrisma,
): Promise<RankingResult[]> {
  const scpConfig = await prisma.scpProgramConfig.findFirst({
    where: { schoolYearId, scpType, isOffered: true },
    select: { rankingFormula: true },
  });

  const formulaWeights = scpConfig?.rankingFormula
    ? resolveFormulaWeights(scpConfig.rankingFormula)
    : { ...DEFAULT_RANKING_WEIGHTS };

  if (Object.keys(formulaWeights).length === 0) {
    Object.assign(formulaWeights, DEFAULT_RANKING_WEIGHTS);
  }

  // Selection Board should include PASSED learners, even when only one status surface
  // has been updated (legacy early-registration + enrollment synchronization lag).
  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId,
      OR: [
        {
          applicantType: scpType,
          status: "PASSED",
        },
        {
          earlyRegistration: {
            is: {
              schoolYearId,
              applicantType: scpType,
              status: "PASSED",
            },
          },
        },
      ],
    },
    include: { learner: true },
  });

  const results: RankingResult[] = [];
  for (const application of applications) {
    const { compositeScore, breakdown } = await computeRanking(
      application.id,
      formulaWeights,
      prisma,
    );
    results.push({
      applicationId: application.id,
      firstName: application.learner.firstName,
      lastName: application.learner.lastName,
      lrn: application.learner.lrn,
      compositeScore,
      breakdown,
    });
  }

  results.sort((a, b) => b.compositeScore - a.compositeScore);
  return results;
}
