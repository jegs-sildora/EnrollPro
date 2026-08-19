import { prisma } from "../../../lib/prisma.js";


const MANILA_TIME_ZONE = "Asia/Manila";

const DEFAULT_GRADES = [
  { name: "Grade 7", displayOrder: 7 },
  { name: "Grade 8", displayOrder: 8 },
  { name: "Grade 9", displayOrder: 9 },
  { name: "Grade 10", displayOrder: 10 },
];

export async function ensureDefaultGradeLevels(
  
): Promise<void> {
  for (const grade of DEFAULT_GRADES) {
    await prisma.gradeLevel.upsert({
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
  settingId: number,
  schoolYearId: number,
): Promise<void> {
  await prisma.schoolSetting.update({
    where: { id: settingId },
    data: { activeSchoolYearId: schoolYearId },
  });
}
