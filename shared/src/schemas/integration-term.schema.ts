import { z } from "zod"
import { TermFormatEnum } from "../constants/index.js"

export const IntegrationTermIdentityEnum = z.enum(["T1", "T2", "T3", "T4"])

export const integrationTermLabelsSchema = z.object({
  T1: z.string().min(1),
  T2: z.string().min(1),
  T3: z.string().min(1),
  T4: z.string().min(1).optional(),
})

export const integrationTermEntrySchema = z.object({
  identity: IntegrationTermIdentityEnum,
  displayLabel: z.string().min(1),
  order: z.number().int().min(1).max(4),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
})

export const integrationSchoolYearTermContractSchema = z.object({
  data: z.object({
    id: z.number().int().positive(),
    yearLabel: z.string().min(1),
    termFormat: TermFormatEnum,
    terms: z.array(integrationTermEntrySchema).min(3).max(4),
  }).superRefine((value, context) => {
    const expectedCount = value.termFormat === "TRIMESTER" ? 3 : 4
    if (value.terms.length !== expectedCount) {
      context.addIssue({
        code: "custom",
        path: ["terms"],
        message: `${value.termFormat} requires exactly ${expectedCount} ordered terms.`,
      })
      return
    }

    value.terms.forEach((term, index) => {
      const expectedIdentity = `T${index + 1}`
      if (term.identity !== expectedIdentity || term.order !== index + 1) {
        context.addIssue({
          code: "custom",
          path: ["terms", index],
          message: `Term ${index + 1} must use identity ${expectedIdentity} and order ${index + 1}.`,
        })
      }
    })
  }),
})

export const integrationActiveTermContractSchema = z.object({
  data: z.object({
    schoolYearId: z.number().int().positive(),
    activeTerm: IntegrationTermIdentityEnum,
    activeTermLabel: z.string().min(1),
    termFormat: TermFormatEnum,
  }),
})

export type IntegrationTermIdentity = z.infer<typeof IntegrationTermIdentityEnum>
export type IntegrationTermLabels = z.infer<typeof integrationTermLabelsSchema>
export type IntegrationTermEntry = z.infer<typeof integrationTermEntrySchema>
export type IntegrationSchoolYearTermContract = z.infer<
  typeof integrationSchoolYearTermContractSchema
>
export type IntegrationActiveTermContract = z.infer<
  typeof integrationActiveTermContractSchema
>
