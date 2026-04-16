import type { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { Prisma } from "../../generated/prisma/index.js";
import { prisma } from "../../lib/prisma.js";
import {
  extractPalette,
  extractAccentColor,
  contrastForeground,
} from "./logo-color.service.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { getEnrollmentPhase } from "./enrollment-gate.service.js";

async function getOrCreateSettings() {
  let settings = await prisma.schoolSetting.findFirst({
    include: { activeSchoolYear: true },
  });
  if (!settings) {
    settings = await prisma.schoolSetting.create({
      data: { schoolName: "My School" },
      include: { activeSchoolYear: true },
    });
  }
  return settings;
}

export async function getPublicSettings(
  req: Request,
  res: Response,
): Promise<void> {
  const settings = await getOrCreateSettings();

  const enrollmentPhase = settings.activeSchoolYear
    ? getEnrollmentPhase(settings.activeSchoolYear)
    : "CLOSED";

  res.json({
    schoolName: settings.schoolName,
    logoUrl: settings.logoUrl,
    colorScheme: settings.colorScheme,
    selectedAccentHsl: settings.selectedAccentHsl,
    activeSchoolYearId: settings.activeSchoolYearId,
    activeSchoolYearLabel: settings.activeSchoolYear?.yearLabel ?? null,
    enrollmentPhase,
  });
}

export async function updateIdentity(
  req: Request,
  res: Response,
): Promise<void> {
  const { schoolName } = req.body;
  const settings = await getOrCreateSettings();

  const updated = await prisma.schoolSetting.update({
    where: { id: settings.id },
    data: { schoolName },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SETTINGS_UPDATED",
    description: `Admin updated school name to "${schoolName}"`,
    req,
  });

  res.json(updated);
}

export async function uploadLogo(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ message: "No file uploaded" });
    return;
  }

  const settings = await getOrCreateSettings();

  // Remove old logo file if it exists
  if (settings.logoPath) {
    try {
      fs.unlinkSync(settings.logoPath);
    } catch {
      // ignore if file doesn't exist
    }
  }

  const absolutePath = path.resolve(req.file.path);
  const logoUrl = `/uploads/${req.file.filename}`;

  // Extract full palette
  const palette = await extractPalette(absolutePath);
  const accentHsl =
    palette.find((c) => {
      const parts = c.hsl.split(" ");
      const s = parseInt(parts[1]);
      const l = parseInt(parts[2]);
      return s >= 20 && l >= 15 && l <= 85;
    })?.hsl ?? "221 83% 53%";

  const colorScheme = {
    palette,
    extracted_at: new Date().toISOString(),
  } as unknown as Prisma.InputJsonValue;

  const updated = await prisma.schoolSetting.update({
    where: { id: settings.id },
    data: {
      logoPath: absolutePath,
      logoUrl,
      colorScheme,
      selectedAccentHsl: accentHsl,
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SETTINGS_UPDATED",
    description: "Admin uploaded school logo and accent color extracted",
    req,
  });

  res.json({
    logoUrl: updated.logoUrl,
    colorScheme: updated.colorScheme,
    selectedAccentHsl: updated.selectedAccentHsl,
  });
}

export async function selectAccentColor(
  req: Request,
  res: Response,
): Promise<void> {
  const { hsl } = req.body;
  if (!hsl || typeof hsl !== "string") {
    res.status(400).json({ message: "hsl is required" });
    return;
  }
  const accentHsl = hsl;

  const settings = await getOrCreateSettings();

  // Validate: must be from the palette
  const palette = (
    settings.colorScheme as { palette?: { hsl: string }[] } | null
  )?.palette;
  if (palette && !palette.some((c: { hsl: string }) => c.hsl === accentHsl)) {
    res
      .status(400)
      .json({ message: "Selected color is not in the extracted palette" });
    return;
  }

  // Compute contrast foreground
  const parts = accentHsl.split(/\s+/);
  const h = parseInt(parts[0]);
  const s = parseInt(parts[1]);
  const l = parseInt(parts[2]);
  const foreground = contrastForeground(h, s, l);

  // Update colorScheme foreground
  const colorSchemeData =
    (settings.colorScheme as Record<string, unknown>) ?? {};
  const updatedColorScheme = {
    ...colorSchemeData,
    accent_foreground: foreground,
  };
  // Remove legacy accent_hsl from JSON (selectedAccentHsl column is canonical)
  delete (updatedColorScheme as Record<string, unknown>).accent_hsl;

  const updated = await prisma.schoolSetting.update({
    where: { id: settings.id },
    data: {
      selectedAccentHsl: accentHsl,
      colorScheme: updatedColorScheme,
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SETTINGS_UPDATED",
    description: `Admin selected accent color: ${accentHsl}`,
    req,
  });

  res.json({
    selectedAccentHsl: updated.selectedAccentHsl,
    colorScheme: updated.colorScheme,
  });
}

export async function removeLogo(req: Request, res: Response): Promise<void> {
  const settings = await getOrCreateSettings();

  if (settings.logoPath) {
    try {
      fs.unlinkSync(settings.logoPath);
    } catch {
      // ignore
    }
  }

  const updated = await prisma.schoolSetting.update({
    where: { id: settings.id },
    data: {
      logoPath: null,
      logoUrl: null,
      colorScheme: Prisma.JsonNull,
      selectedAccentHsl: null,
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SETTINGS_UPDATED",
    description:
      "Admin removed school logo — accent color reset to default blue",
    req,
  });

  res.json({
    logoUrl: updated.logoUrl,
    colorScheme: updated.colorScheme,
    selectedAccentHsl: updated.selectedAccentHsl,
  });
}

export async function getScpConfig(req: Request, res: Response): Promise<void> {
  const settings = await prisma.schoolSetting.findFirst({
    select: { activeSchoolYearId: true },
  });

  if (!settings?.activeSchoolYearId) {
    res.json({ scpProgramConfigs: [] });
    return;
  }

  const scpProgramConfigs = await prisma.scpProgramConfig.findMany({
    where: { schoolYearId: settings.activeSchoolYearId, isOffered: true },
    select: {
      id: true,
      schoolYearId: true,
      scpType: true,
      isOffered: true,
      isTwoPhase: true,
      cutoffScore: true,
      gradeRequirements: true,
      rankingFormula: true,
      notes: true,
    },
    orderBy: { scpType: "asc" },
  });

  res.json({ scpProgramConfigs });
}
