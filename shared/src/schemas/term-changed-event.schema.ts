import { z } from "zod"

import { IntegrationTermIdentityEnum } from "./integration-term.schema.js"

export const termChangedEventTermSchema = z.object({
  term: IntegrationTermIdentityEnum,
  termIndex: z.number().int().min(1).max(4),
  label: z.string().trim().min(1),
})

export const termChangedEventV2Schema = z.object({
  event: z.literal("TERM_CHANGED"),
  eventId: z.uuid(),
  source: z.literal("enrollpro"),
  producedBy: z.enum(["ep-scheduler", "ep-mock-clock"]),
  schoolId: z.string().trim().min(1),
  schoolYearId: z.number().int().positive(),
  from: termChangedEventTermSchema,
  to: termChangedEventTermSchema,
  effectiveDate: z.iso.date(),
  timestamp: z.iso.datetime({ offset: true }),
  from_term: z.string().trim().min(1),
  to_term: z.string().trim().min(1),
}).superRefine((event, context) => {
  if (event.from.termIndex >= event.to.termIndex) {
    context.addIssue({
      code: "custom",
      path: ["to", "termIndex"],
      message: "A term change must advance to a later term.",
    })
  }

  if (event.from_term !== event.from.label) {
    context.addIssue({
      code: "custom",
      path: ["from_term"],
      message: "from_term must match from.label.",
    })
  }

  if (event.to_term !== event.to.label) {
    context.addIssue({
      code: "custom",
      path: ["to_term"],
      message: "to_term must match to.label.",
    })
  }
})

export type TermChangedEventV2 = z.infer<typeof termChangedEventV2Schema>
