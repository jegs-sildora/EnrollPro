import axios from "axios"
import { z } from "zod"
import type { ApplicantType } from "../../generated/prisma/index.js"
import { AppError } from "../../lib/AppError.js"

const atlasSubjectSchema = z.object({
  id: z.number().int().positive(),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  outputLabel: z.string().trim().min(1).nullable().optional(),
  displayCode: z.string().trim().min(1).nullable().optional(),
  rotationFamily: z.string().trim().min(1).nullable().optional(),
  gradeLevels: z.array(z.number().int()),
  programScopes: z.array(z.string()),
  isActive: z.boolean(),
})

const atlasSubjectResponseSchema = z.object({
  subjects: z.array(atlasSubjectSchema),
})

export interface AtlasSubjectCatalogItem {
  code: string
  displayCode: string
  name: string
}

function toAtlasProgramScope(programType: ApplicantType): string {
  switch (programType) {
    case "SCIENCE_TECHNOLOGY_AND_ENGINEERING":
      return "STE"
    case "SPECIAL_PROGRAM_IN_THE_ARTS":
      return "SPA"
    case "SPECIAL_PROGRAM_IN_SPORTS":
      return "SPS"
    default:
      return "REGULAR"
  }
}

export function normalizeAtlasSubjectCatalog(
  value: unknown,
  gradeLevel: number,
  programType: ApplicantType,
): AtlasSubjectCatalogItem[] {
  const parsed = atlasSubjectResponseSchema.safeParse(value)
  if (!parsed.success) {
    throw new AppError(502, "ATLAS returned an invalid subject catalog response.")
  }

  const programScope = toAtlasProgramScope(programType)
  const subjects: AtlasSubjectCatalogItem[] = []

  for (const subject of parsed.data.subjects) {
    if (
      !subject.isActive ||
      !subject.gradeLevels.includes(gradeLevel) ||
      !subject.programScopes.includes(programScope)
    ) {
      continue
    }

    const code = subject.code.trim().toUpperCase()
    if (code === "HG" || code.startsWith("HG_")) continue

    subjects.push({
      code,
      displayCode: (
        subject.displayCode ?? subject.outputLabel ?? subject.code
      ).trim(),
      name: subject.name,
    })
  }

  return subjects.sort((left, right) => left.name.localeCompare(right.name))
}

export function getPreviousJhsGradeNumber(incomingGrade: number): number {
  if (!Number.isInteger(incomingGrade) || incomingGrade < 7 || incomingGrade > 10) {
    throw new AppError(400, "Select a valid Grade 7 to Grade 10 level.")
  }
  if (incomingGrade === 7) {
    throw new AppError(
      422,
      "ATLAS has no Grade 6 subject offerings. Grade 7 transferee back subjects require registrar review.",
    )
  }
  return incomingGrade - 1
}

export async function fetchAtlasSubjectCatalog({
  schoolId,
  gradeLevel,
  programType,
}: {
  schoolId: string
  gradeLevel: number
  programType: ApplicantType
}): Promise<AtlasSubjectCatalogItem[]> {
  const baseUrl = process.env.ATLAS_API_BASE_URL?.trim()
  if (!baseUrl) {
    throw new AppError(503, "ATLAS subject catalog is not configured.")
  }

  try {
    const response = await axios.get<unknown>(`${baseUrl}/api/v1/subjects`, {
      params: { schoolId },
      timeout: 15_000,
    })
    return normalizeAtlasSubjectCatalog(response.data, gradeLevel, programType)
  } catch (error: unknown) {
    if (error instanceof AppError) throw error
    throw new AppError(503, "ATLAS subject catalog is currently unavailable.")
  }
}
