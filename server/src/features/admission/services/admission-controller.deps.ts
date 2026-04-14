import { prisma } from "../../../lib/prisma.js";
import { saveBase64Image } from "../../../lib/fileUploader.js";
import { auditLog } from "../../audit-logs/audit-logs.service.js";
import { isEnrollmentOpen } from "../../settings/enrollment-gate.service.js";
import { normalizeDateToUtcNoon } from "../../school-year/school-year.service.js";
import { getRequiredDocuments } from "../../enrollment/enrollment-requirement.service.js";

export interface AdmissionControllerDeps {
  prisma: typeof prisma;
  saveBase64Image: typeof saveBase64Image;
  auditLog: typeof auditLog;
  isEnrollmentOpen: typeof isEnrollmentOpen;
  normalizeDateToUtcNoon: typeof normalizeDateToUtcNoon;
  getRequiredDocuments: typeof getRequiredDocuments;
}

export function createAdmissionControllerDeps(
  overrides: Partial<AdmissionControllerDeps> = {},
): AdmissionControllerDeps {
  return {
    prisma,
    saveBase64Image,
    auditLog,
    isEnrollmentOpen,
    normalizeDateToUtcNoon,
    getRequiredDocuments,
    ...overrides,
  };
}
