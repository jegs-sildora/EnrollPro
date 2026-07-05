import type { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { Prisma, SystemAcademicPhase } from "../../generated/prisma/index.js";
import { prisma } from "../../lib/prisma.js";
import {
  extractPalette,
  extractAccentColor,
  contrastForeground,
} from "./logo-color.service.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { getEnrollmentPhase, isRegularEnrollmentWindowOpen } from "./enrollment-gate.service.js";
import { activeLocks } from "../admin/historical-correction.controller.js";

async function getOrCreateSettings() {
  let settings = await prisma.schoolSetting.findFirst({
    include: { activeSchoolYear: true },
  });
  if (!settings) {
    settings = await prisma.schoolSetting.create({
      data: { schoolName: "EnrollPro" },
      include: { activeSchoolYear: true },
    });
  }
  return settings;
}

export async function getPublicSettings(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const settings = await getOrCreateSettings();

    // Determine the "True Active" SY: global setting or fallback to latest ACTIVE row
    let activeSy = settings.activeSchoolYear;
    if (!activeSy) {
      activeSy = await prisma.schoolYear.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });
    }

    // Determine the "Context SY" (what the user is currently viewing)
    // 1. If header context is provided, use it
    // 2. Otherwise use the "True Active" SY determined above
    let contextSy = activeSy;
    if (req.schoolYearId && req.schoolYearId !== activeSy?.id) {
      contextSy = await prisma.schoolYear.findUnique({
        where: { id: req.schoolYearId },
      });
    }

    const enrollmentPhase = contextSy
      ? getEnrollmentPhase(contextSy, settings.systemPhase)
      : "CLOSED";
    const isBosyEnrollmentOpen = contextSy
      ? isRegularEnrollmentWindowOpen(contextSy, settings.systemPhase)
      : false;

    const lock = contextSy ? activeLocks.get(contextSy.id) : null;
    const activeCorrection = lock && lock.expiresAt > Date.now() ? {
      userId: lock.userId,
      userName: lock.userName,
      expiresAt: lock.expiresAt,
    } : null;

    const effectiveSystemStatus = contextSy?.status ?? activeSy?.status ?? "ACTIVE";

    const isContextArchived = effectiveSystemStatus === "ARCHIVED" || contextSy?.status === "ARCHIVED";
    const snapshotSettings = isContextArchived && contextSy?.settingsSnapshot
      ? (contextSy.settingsSnapshot as any)
      : null;


    res.json({
      schoolName: settings.schoolName,
      depedSchoolId: settings.depedSchoolId,
      logoUrl: settings.logoUrl,
      colorScheme: settings.colorScheme,
      selectedAccentHsl: settings.selectedAccentHsl,
      activeSchoolYearId: activeSy?.id ?? null,
      viewingSchoolYearId: contextSy?.id ?? activeSy?.id ?? null,
      activeSchoolYearLabel: activeSy?.yearLabel ?? null,
      viewingSchoolYearLabel: contextSy?.yearLabel ?? activeSy?.yearLabel ?? null,
      activeSchoolYearStatus: activeSy?.status ?? null,
      systemStatus: effectiveSystemStatus,
      earlyRegOpenDate: null,
      earlyRegCloseDate: null,
      classOpeningDate: contextSy?.classOpeningDate ?? null,
      classEndDate: contextSy?.classEndDate ?? null,
      enrollOpenDate: contextSy?.enrollOpenDate ?? null,
      enrollCloseDate: contextSy?.enrollCloseDate ?? null,
      facebookPageUrl: settings.facebookPageUrl,
      depedEmail: settings.depedEmail,
      schoolWebsite: settings.schoolWebsite,
      region: settings.region,
      division: settings.division,
      schoolHeadName: settings.schoolHeadName,
      schoolHeadTitle: settings.schoolHeadTitle,
      steEnabled: snapshotSettings?.steEnabled ?? settings.steEnabled,
      spaEnabled: snapshotSettings?.spaEnabled ?? settings.spaEnabled,
      spsEnabled: snapshotSettings?.spsEnabled ?? settings.spsEnabled,
      enableHomogeneousSections: snapshotSettings?.enableHomogeneousSections ?? settings.enableHomogeneousSections,
      homogeneousSectionCount: snapshotSettings?.homogeneousSectionCount ?? settings.homogeneousSectionCount,
      heterogeneousRoundRobin: snapshotSettings?.heterogeneousRoundRobin ?? settings.heterogeneousRoundRobin,
      enrollmentPhase,
      isBosyEnrollmentOpen,
      systemPhase: effectiveSystemStatus === "ARCHIVED" ? "EOSY_CLOSING" : settings.systemPhase,
      globalDefaultPassword: settings.globalDefaultPassword,
      activeCorrection,
    });
  } catch (error) {
    console.error("[Settings Controller] Error in getPublicSettings:", error);
    // Let the global error handler handle it, or send a more specific response
    throw error;
  }
}

export async function updateIdentity(req: Request, res: Response): Promise<void> {
  const {
    schoolName,
    depedSchoolId,
    facebookPageUrl,
    depedEmail,
    schoolWebsite,
    region,
    division,
    schoolHeadName,
    schoolHeadTitle,
    globalDefaultPassword,
  } = req.body;

  const updated = await prisma.schoolSetting.updateMany({
    data: {
      schoolName,
      depedSchoolId,
      facebookPageUrl,
      depedEmail,
      schoolWebsite,
      region,
      division,
      schoolHeadName,
      schoolHeadTitle,
      ...(globalDefaultPassword !== undefined ? { globalDefaultPassword } : {}),
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SETTINGS_UPDATED",
    description: `Admin updated school identity, communication channels, and default password`,
    req,
  });

  res.json(updated);
}

export async function updateSystemPhase(req: Request, res: Response): Promise<void> {
  const { phase } = req.body;
  if (!["OFFICIAL_ENROLLMENT", "CLASSES_ONGOING", "EOSY_CLOSING"].includes(phase)) {
    res.status(400).json({ message: "Invalid system phase" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.schoolSetting.updateMany({
      data: { systemPhase: phase as SystemAcademicPhase },
    });

    if (phase === "EOSY_CLOSING") {
      await tx.enrollmentApplication.updateMany({
        where: { status: "PENDING_VERIFICATION" },
        data: { status: "ARCHIVED_NO_SHOW" },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        actionType: "PHASE_SHIFT",
        description: `Admin updated system academic phase to ${phase}`,
        ipAddress: req.ip || "0.0.0.0",
        userAgent: req.headers["user-agent"] || "unknown",
      },
    });
  });

  const updated = await prisma.schoolSetting.findFirst();

  res.json({ message: "System phase updated", updated });
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
  res.json({ scpProgramConfigs: [] });
}

export async function getActiveAcademicPrograms(
  _req: Request,
  res: Response,
): Promise<void> {
  const settings = await getOrCreateSettings();
  const programs: string[] = ["REGULAR"];

  if (settings.steEnabled) {
    programs.push("SCIENCE_TECHNOLOGY_AND_ENGINEERING");
  }
  if (settings.spaEnabled) {
    programs.push("SPECIAL_PROGRAM_IN_THE_ARTS");
  }
  if (settings.spsEnabled) {
    programs.push("SPECIAL_PROGRAM_IN_SPORTS");
  }

  res.json({ programs });
}

export async function updatePrograms(req: Request, res: Response): Promise<void> {
  const { steEnabled, spaEnabled, spsEnabled } = req.body;

  const settings = await getOrCreateSettings();

  const updated = await prisma.schoolSetting.update({
    where: { id: settings.id },
    data: {
      steEnabled,
      spaEnabled,
      spsEnabled,
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SETTINGS_UPDATED",
    description: `Admin updated active academic programs`,
    req,
  });

  res.json(updated);
}

export async function updateAlgorithm(req: Request, res: Response): Promise<void> {
  const { enableHomogeneousSections, homogeneousSectionCount, heterogeneousRoundRobin } = req.body;

  const settings = await getOrCreateSettings();

  const updated = await prisma.schoolSetting.update({
    where: { id: settings.id },
    data: {
      enableHomogeneousSections,
      homogeneousSectionCount,
      heterogeneousRoundRobin,
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SETTINGS_UPDATED",
    description: `Admin updated sectioning and algorithmic rules`,
    req,
  });

  res.json(updated);
}
