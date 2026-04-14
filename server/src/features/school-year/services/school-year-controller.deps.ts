import { prisma } from "../../../lib/prisma.js";
import { auditLog } from "../../audit-logs/audit-logs.service.js";
import {
  deriveNextSchoolYear,
  deriveSchoolYearScheduleFromOpeningDate,
  normalizeDateToUtcNoon,
} from "../school-year.service.js";

export interface SchoolYearControllerDeps {
  prisma: typeof prisma;
  auditLog: typeof auditLog;
  deriveNextSchoolYear: typeof deriveNextSchoolYear;
  deriveSchoolYearScheduleFromOpeningDate: typeof deriveSchoolYearScheduleFromOpeningDate;
  normalizeDateToUtcNoon: typeof normalizeDateToUtcNoon;
}

export const createSchoolYearControllerDeps = (
  overrides: Partial<SchoolYearControllerDeps> = {},
): SchoolYearControllerDeps => ({
  prisma,
  auditLog,
  deriveNextSchoolYear,
  deriveSchoolYearScheduleFromOpeningDate,
  normalizeDateToUtcNoon,
  ...overrides,
});
