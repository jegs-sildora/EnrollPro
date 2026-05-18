import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import type { TLECategory, TLETrackType } from "../../generated/prisma/index.js";

const ALLOWED_TLE_CATEGORIES = new Set([
  "HOME_ECONOMICS",
  "ICT",
  "INDUSTRIAL_ARTS",
  "AGRI_FISHERY_ARTS",
]);

const ALLOWED_TRACK_TYPES = new Set(["EXPLORATORY", "SPECIALIZATION"]);

export async function listTLEPrograms(
  _req: Request,
  res: Response,
): Promise<void> {
  const programs = await prisma.tLEProgram.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  res.json({ programs });
}

export async function createTLEProgram(
  req: Request,
  res: Response,
): Promise<void> {
  const { name, programCode, category, trackType, isActive } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ message: "name is required" });
    return;
  }
  if (!category) {
    res.status(400).json({ message: "category is required" });
    return;
  }
  if (!ALLOWED_TLE_CATEGORIES.has(String(category))) {
    res.status(400).json({ message: "category is invalid" });
    return;
  }
  if (!ALLOWED_TRACK_TYPES.has(String(trackType))) {
    res.status(400).json({ message: "trackType is invalid" });
    return;
  }
  if (
    !programCode ||
    typeof programCode !== "string" ||
    !programCode.trim() ||
    programCode.trim().length > 10
  ) {
    res.status(400).json({ message: "programCode is required (max 10 chars)" });
    return;
  }

  const existing = await prisma.tLEProgram.findUnique({
    where: { name: name.trim() },
  });
  if (existing) {
    res
      .status(409)
      .json({ message: "A TLE program with that name already exists" });
    return;
  }

  const program = await prisma.tLEProgram.create({
    data: {
      name: name.trim(),
      category: category as TLECategory,
      trackType: trackType as TLETrackType,
      isActive: isActive !== false,
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "TLE_PROGRAM_CREATED",
    description: `Created TLE program: ${program.name}`,
    subjectType: "TLEProgram",
    recordId: program.id,
    req,
  });

  res.status(201).json({ program });
}

export async function updateTLEProgram(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(String(req.params.id));
  const { name, category, trackType, isActive } = req.body;

  const existing = await prisma.tLEProgram.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: "TLE program not found" });
    return;
  }

  if (name !== undefined && name.trim() !== existing.name) {
    const nameConflict = await prisma.tLEProgram.findUnique({
      where: { name: name.trim() },
    });
    if (nameConflict) {
      res
        .status(409)
        .json({ message: "A TLE program with that name already exists" });
      return;
    }
  }
  if (
    category !== undefined &&
    !ALLOWED_TLE_CATEGORIES.has(String(category))
  ) {
    res.status(400).json({ message: "category is invalid" });
    return;
  }
  if (
    trackType !== undefined &&
    !ALLOWED_TRACK_TYPES.has(String(trackType))
  ) {
    res.status(400).json({ message: "trackType is invalid" });
    return;
  }
  const program = await prisma.tLEProgram.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(category !== undefined ? { category: category as TLECategory } : {}),
      ...(trackType !== undefined
        ? { trackType: trackType as TLETrackType }
        : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "TLE_PROGRAM_UPDATED",
    description: `Updated TLE program: ${program.name}`,
    subjectType: "TLEProgram",
    recordId: program.id,
    req,
  });

  res.json({ program });
}

export async function deactivateTLEProgram(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(String(req.params.id));

  const existing = await prisma.tLEProgram.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: "TLE program not found" });
    return;
  }

  const activeUsage = await prisma.enrollmentApplication.count({
    where: {
      tleProgramId: id,
      status: {
        in: [
          "ENROLLED",
          "TEMPORARILY_ENROLLED",
          "PENDING_CONFIRMATION",
          "READY_FOR_SECTIONING",
          "OFFICIALLY_ENROLLED",
        ],
      },
    },
  });
  if (activeUsage > 0) {
    res.status(409).json({
      message: `Cannot deactivate: ${activeUsage} active application(s) reference this TLE program`,
    });
    return;
  }

  const program = await prisma.tLEProgram.update({
    where: { id },
    data: { isActive: false },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "TLE_PROGRAM_DEACTIVATED",
    description: `Deactivated TLE program: ${program.name}`,
    subjectType: "TLEProgram",
    recordId: program.id,
    req,
  });

  res.json({ program });
}
