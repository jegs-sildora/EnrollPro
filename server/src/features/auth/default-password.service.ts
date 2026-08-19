import { prisma } from "../../lib/prisma.js"

export const FALLBACK_DEFAULT_PASSWORD = "DepEd2026!"

export async function isConfiguredDefaultPassword(
  candidate: string,
): Promise<boolean> {
  const settings = await prisma.schoolSetting.findMany({
    take: 2,
    orderBy: { id: "asc" },
    select: { globalDefaultPassword: true },
  })

  const configuredDefault = settings.length === 1
    ? settings[0]!.globalDefaultPassword
    : FALLBACK_DEFAULT_PASSWORD

  return candidate === FALLBACK_DEFAULT_PASSWORD || candidate === configuredDefault
}
