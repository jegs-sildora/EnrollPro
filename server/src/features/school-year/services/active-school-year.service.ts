import { prisma } from "../../../lib/prisma.js"

type ActiveYearClient = Pick<typeof prisma, "schoolSetting" | "schoolYear">

export interface ActiveSchoolYearState {
  settingId: number
  schoolYearId: number
  yearLabel: string
}

export type ActiveSchoolYearResolution =
  | { state: "UNINITIALIZED" }
  | { state: "VALID"; active: ActiveSchoolYearState }
  | { state: "INVALID"; code: "ACTIVE_SCHOOL_YEAR_CONFLICT"; message: string }

export async function resolveActiveSchoolYearState(
  client: ActiveYearClient = prisma,
): Promise<ActiveSchoolYearResolution> {
  const [settings, activeYears, totalYears] = await Promise.all([
    client.schoolSetting.findMany({
      take: 2,
      orderBy: { id: "asc" },
      select: { id: true, activeSchoolYearId: true },
    }),
    client.schoolYear.findMany({
      where: { status: "ACTIVE" },
      take: 2,
      orderBy: { id: "asc" },
      select: { id: true, yearLabel: true },
    }),
    client.schoolYear.count(),
  ])

  if (totalYears === 0 && activeYears.length === 0) {
    return { state: "UNINITIALIZED" }
  }

  if (settings.length !== 1) {
    return {
      state: "INVALID",
      code: "ACTIVE_SCHOOL_YEAR_CONFLICT",
      message: "Exactly one school settings record is required before school-year operations can continue.",
    }
  }

  const setting = settings[0]!
  if (setting.activeSchoolYearId === null || activeYears.length !== 1) {
    return {
      state: "INVALID",
      code: "ACTIVE_SCHOOL_YEAR_CONFLICT",
      message: "The configured active school year does not match exactly one active school-year record.",
    }
  }

  const activeYear = activeYears[0]!
  if (setting.activeSchoolYearId !== activeYear.id) {
    return {
      state: "INVALID",
      code: "ACTIVE_SCHOOL_YEAR_CONFLICT",
      message: "The active school-year pointer conflicts with the active school-year record.",
    }
  }

  return {
    state: "VALID",
    active: {
      settingId: setting.id,
      schoolYearId: activeYear.id,
      yearLabel: activeYear.yearLabel,
    },
  }
}
