import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { extractPalette, extractAccentColor, contrastForeground } from '../services/logoColorService.js';
import { auditLog } from '../services/auditLogger.js';
import { getEnrollmentPhase } from '../services/enrollmentGateService.js';

async function getOrCreateSettings() {
  let settings = await prisma.schoolSettings.findFirst({
    include: { activeAcademicYear: true }
  });
  if (!settings) {
    settings = await prisma.schoolSettings.create({ 
      data: {},
      include: { activeAcademicYear: true }
    });
  }
  return settings;
}

export async function getPublicSettings(req: Request, res: Response): Promise<void> {
  const settings = await getOrCreateSettings();
  
  const enrollmentPhase = settings.activeAcademicYear 
    ? getEnrollmentPhase(settings.activeAcademicYear)
    : 'CLOSED';

  res.json({
    schoolName: settings.schoolName,
    logoUrl: settings.logoUrl,
    colorScheme: settings.colorScheme,
    selectedAccentHsl: settings.selectedAccentHsl,
    activeAcademicYearId: settings.activeAcademicYearId,
    enrollmentPhase,
  });
}

export async function updateIdentity(req: Request, res: Response): Promise<void> {
  const { schoolName } = req.body;
  const settings = await getOrCreateSettings();

  const updated = await prisma.schoolSettings.update({
    where: { id: settings.id },
    data: { schoolName },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: 'SETTINGS_UPDATED',
    description: `Admin updated school name to "${schoolName}"`,
    req,
  });

  res.json(updated);
}

export async function uploadLogo(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' });
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
  const accentHsl = palette.find((c) => {
    const parts = c.hsl.split(' ');
    const s = parseInt(parts[1]);
    const l = parseInt(parts[2]);
    return s >= 20 && l >= 15 && l <= 85;
  })?.hsl ?? '221 83% 53%';

  const colorScheme = {
    accent_hsl: accentHsl,
    palette,
    extracted_at: new Date().toISOString(),
  } as unknown as Prisma.InputJsonValue;

  const updated = await prisma.schoolSettings.update({
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
    actionType: 'SETTINGS_UPDATED',
    description: 'Admin uploaded school logo and accent color extracted',
    req,
  });

  res.json({
    logoUrl: updated.logoUrl,
    colorScheme: updated.colorScheme,
    selectedAccentHsl: updated.selectedAccentHsl,
  });
}

export async function selectAccentColor(req: Request, res: Response): Promise<void> {
  const { hsl } = req.body;
  if (!hsl || typeof hsl !== 'string') {
    res.status(400).json({ message: 'hsl is required' });
    return;
  }
  const accentHsl = hsl;

  const settings = await getOrCreateSettings();

  // Validate: must be from the palette
  const palette = (settings.colorScheme as { palette?: { hsl: string }[] } | null)?.palette;
  if (palette && !palette.some((c: { hsl: string }) => c.hsl === accentHsl)) {
    res.status(400).json({ message: 'Selected color is not in the extracted palette' });
    return;
  }

  // Compute contrast foreground
  const parts = accentHsl.split(/\s+/);
  const h = parseInt(parts[0]);
  const s = parseInt(parts[1]);
  const l = parseInt(parts[2]);
  const foreground = contrastForeground(h, s, l);

  // Update colorScheme.accent_hsl too
  const colorSchemeData = (settings.colorScheme as Record<string, unknown>) ?? {};
  const updatedColorScheme = {
    ...colorSchemeData,
    accent_hsl: accentHsl,
    accent_foreground: foreground,
  };

  const updated = await prisma.schoolSettings.update({
    where: { id: settings.id },
    data: {
      selectedAccentHsl: accentHsl,
      colorScheme: updatedColorScheme,
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: 'SETTINGS_UPDATED',
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

  const updated = await prisma.schoolSettings.update({
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
    actionType: 'SETTINGS_UPDATED',
    description: 'Admin removed school logo — accent color reset to default blue',
    req,
  });

  res.json({
    logoUrl: updated.logoUrl,
    colorScheme: updated.colorScheme,
    selectedAccentHsl: updated.selectedAccentHsl,
  });
}

export async function getScpConfig(req: Request, res: Response): Promise<void> {
  const settings = await prisma.schoolSettings.findFirst({
    select: { activeAcademicYearId: true }
  });

  if (!settings?.activeAcademicYearId) {
    res.json({ scpConfigs: [] });
    return;
  }

  const scpConfigs = await prisma.scpConfig.findMany({
    where: { academicYearId: settings.activeAcademicYearId, isOffered: true },
  });

  res.json({ scpConfigs });
}

export async function getShsConfig(req: Request, res: Response): Promise<void> {
  const settings = await prisma.schoolSettings.findFirst({
    select: { activeAcademicYearId: true }
  });

  if (!settings?.activeAcademicYearId) {
    res.json({ grade11Mode: 'STRENGTHENED', grade12Mode: 'OLD_STRAND', strands: [] });
    return;
  }

  // Get all strands/clusters for the active academic year
  const strands = await prisma.strand.findMany({
    where: { academicYearId: settings.activeAcademicYearId },
    include: {
      _count: false
    }
  });

  res.json({
    grade11Mode: 'STRENGTHENED',
    grade12Mode: 'OLD_STRAND',
    strands
  });
}

