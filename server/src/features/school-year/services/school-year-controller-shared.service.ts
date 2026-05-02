import { SchoolYearControllerDeps } from "./school-year-controller.deps.js";

const MANILA_TIME_ZONE = "Asia/Manila";

const DEFAULT_GRADES = [
  { name: "Grade 7", displayOrder: 7 },
  { name: "Grade 8", displayOrder: 8 },
  { name: "Grade 9", displayOrder: 9 },
  { name: "Grade 10", displayOrder: 10 },
];

export async function ensureDefaultGradeLevels(
  deps: SchoolYearControllerDeps,
): Promise<void> {
  for (const grade of DEFAULT_GRADES) {
    await deps.prisma.gradeLevel.upsert({
      where: { name: grade.name },
      update: { displayOrder: grade.displayOrder },
      create: {
        name: grade.name,
        displayOrder: grade.displayOrder,
      },
    });
  }
}

export function parseDateInput(value: unknown): Date | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getCurrentManilaYear(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
  }).formatToParts(new Date());

  return Number(
    parts.find((part) => part.type === "year")?.value ??
      new Date().getFullYear(),
  );
}

export async function setActiveSchoolYear(
  deps: SchoolYearControllerDeps,
  schoolYearId: number,
): Promise<void> {
  const settings = await deps.prisma.schoolSetting.findFirst();
  if (settings) {
    await deps.prisma.schoolSetting.update({
      where: { id: settings.id },
      data: { activeSchoolYearId: schoolYearId },
    });
  }
}

export async function clearActiveSchoolYearIfMatches(
  deps: SchoolYearControllerDeps,
  schoolYearId: number,
): Promise<void> {
  const settings = await deps.prisma.schoolSetting.findFirst();
  if (settings && settings.activeSchoolYearId === schoolYearId) {
    await deps.prisma.schoolSetting.update({
      where: { id: settings.id },
      data: { activeSchoolYearId: null },
    });
  }
}

export async function cloneSchoolYearStructure(
  deps: SchoolYearControllerDeps,
  cloneFromId: number,
  targetSchoolYearId: number,
): Promise<void> {
  const source = await deps.prisma.schoolYear.findUnique({
    where: { id: cloneFromId },
    include: {
      sections: true,
      scpProgramConfigs: {
        include: { options: true, steps: { orderBy: { stepOrder: "asc" } } },
      },
    },
  });

  if (!source) {
    return;
  }

  for (const section of source.sections) {
    await deps.prisma.section.create({
      data: {
        name: section.name,
        displayName: section.displayName,
        sortOrder: section.sortOrder,
        maxCapacity: section.maxCapacity,
        gradeLevelId: section.gradeLevelId,
        schoolYearId: targetSchoolYearId,
        programType: section.programType,
        isHomogeneous: section.isHomogeneous,
        isSnake: section.isSnake,
      },
    });
  }

  for (const scpProgram of source.scpProgramConfigs) {
    const newScpProgram = await deps.prisma.scpProgramConfig.create({
      data: {
        schoolYearId: targetSchoolYearId,
        scpType: scpProgram.scpType,
        isOffered: scpProgram.isOffered,
        isTwoPhase: scpProgram.isTwoPhase,
        cutoffScore: scpProgram.cutoffScore,
        gradeRequirements:
          scpProgram.gradeRequirements === null
            ? undefined
            : scpProgram.gradeRequirements,
        rankingFormula:
          scpProgram.rankingFormula === null
            ? undefined
            : scpProgram.rankingFormula,
        notes: scpProgram.notes,
      },
    });

    if (scpProgram.options.length > 0) {
      await deps.prisma.scpProgramOption.createMany({
        data: scpProgram.options.map((option) => ({
          scpProgramConfigId: newScpProgram.id,
          optionType: option.optionType,
          value: option.value,
        })),
      });
    }

    if (scpProgram.steps.length > 0) {
      await deps.prisma.scpProgramStep.createMany({
        data: scpProgram.steps.map((step) => ({
          scpProgramConfigId: newScpProgram.id,
          stepOrder: step.stepOrder,
          kind: step.kind,
          label: step.label,
          description: step.description,
          isRequired: step.isRequired,
        })),
      });
    }
  }
}
