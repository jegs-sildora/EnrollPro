import { prisma } from "../../../lib/prisma.js";
import { generatePortalPin } from "../../learner/portal-pin.service.js";
import { normalizeDateToUtcNoon } from "../../school-year/school-year.service.js";
import { searchStudents } from "../students.service.js";

export interface StudentsControllerDeps {
  prisma: typeof prisma;
  generatePortalPin: typeof generatePortalPin;
  searchStudents: typeof searchStudents;
  normalizeDateToUtcNoon: typeof normalizeDateToUtcNoon;
}

export const createStudentsControllerDeps = (
  overrides: Partial<StudentsControllerDeps> = {},
): StudentsControllerDeps => ({
  prisma,
  generatePortalPin,
  searchStudents,
  normalizeDateToUtcNoon,
  ...overrides,
});
