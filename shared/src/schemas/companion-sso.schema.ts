import { z } from "zod";

import { RoleEnum } from "../constants/index.js";

export const companionSystemSchema = z.enum([
  "ATLAS",
  "AIMS",
  "SMART",
  "MRF",
]);

export const companionSsoExchangeSchema = z.object({
  code: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/, "Authorization code is invalid"),
});

export const companionSsoCatalogItemSchema = z.object({
  system: companionSystemSchema,
  enabled: z.boolean(),
  eligible: z.boolean(),
  disabledReason: z.string().nullable(),
});

export const companionSsoCatalogResponseSchema = z.object({
  systems: z.array(companionSsoCatalogItemSchema),
});

export const companionSsoLaunchResponseSchema = z.object({
  launchUrl: z.string().url(),
  expiresAt: z.string().datetime({ offset: true }),
});

export const companionSsoExchangeResponseSchema = z.object({
  success: z.literal(true),
  companion: companionSystemSchema,
  identity: z.object({
    subject: z.string(),
    userId: z.number().int().positive(),
    employeeId: z.string().nullable(),
    lrn: z.string().nullable(),
    firstName: z.string(),
    middleName: z.string().nullable(),
    lastName: z.string(),
    roles: z.array(RoleEnum),
  }),
  activeSchoolYear: z.object({
    id: z.number().int().positive(),
    yearLabel: z.string(),
  }),
  authenticatedAt: z.string().datetime({ offset: true }),
});
