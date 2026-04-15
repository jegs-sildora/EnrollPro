import { prisma as defaultPrisma } from "../../../lib/prisma.js";
import type { ApplicantType } from "../../../generated/prisma/index.js";

interface RankingWeights {
  weights: Record<string, number>;
}

export interface RankingResult {
  applicationId: number;
  firstName: string;
  lastName: string;
  lrn: string | null;
  compositeScore: number;
  breakdown: Record<string, number>;
}

/**
 * Compute a weighted composite ranking score for a single SCP enrollment application.
 * Uses `ScpProgramConfig.rankingFormula` weights × assessment scores + generalAverage.
 */
export async function computeRanking(
  applicationId: number,
  rankingFormula: RankingWeights,
  prisma: typeof defaultPrisma = defaultPrisma,
): Promise<{ compositeScore: number; breakdown: Record<string, number> }> {
  const { weights } = rankingFormula;

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

  return { compositeScore: Math.round(compositeScore * 100) / 100, breakdown };
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

  if (!scpConfig?.rankingFormula) {
    return [];
  }

  const formula = scpConfig.rankingFormula as unknown as RankingWeights;

  // Fetch applications with completed assessments or later status
  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId,
      applicantType: scpType,
      status: {
        in: [
          "ASSESSMENT_TAKEN",
          "PASSED",
          "ELIGIBLE",
          "PRE_REGISTERED",
          "ENROLLED",
          "TEMPORARILY_ENROLLED",
        ],
      },
    },
    include: { learner: true },
  });

  const results: RankingResult[] = [];
  for (const application of applications) {
    const { compositeScore, breakdown } = await computeRanking(
      application.id,
      formula,
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
