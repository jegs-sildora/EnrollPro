import type { Request, Response } from "express";
import type { Sf7ImportCommitInput } from "@enrollpro/shared";
import path from "path";
import { fileURLToPath } from "url";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { broadcastDomainInvalidation } from "../../lib/realtime-events.js";
import {
  commitSf7Import,
  previewSf7Import,
  syncSf7FromAtlas,
} from "./sf7.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SF7_TEMPLATE_FILE =
  "School Form 7 (SF7) School Personnel Assignment List and Basic Profile.xlsx";

function parseSchoolYearId(req: Request): number | null {
  const raw =
    typeof req.query.schoolYearId === "string"
      ? req.query.schoolYearId
      : typeof req.body?.schoolYearId === "number"
        ? String(req.body.schoolYearId)
        : req.schoolYearId
          ? String(req.schoolYearId)
          : null;
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function downloadTemplate(_req: Request, res: Response): Promise<void> {
  const templatePath = path.resolve(__dirname, "../../../templates", SF7_TEMPLATE_FILE);

  res.download(templatePath, SF7_TEMPLATE_FILE, (error: Error | null) => {
    if (error && !res.headersSent) {
      res.status(404).json({
        message: "SF7 template file was not found on the server.",
      });
    }
  });
}

export async function previewImport(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file?.buffer) {
      res.status(400).json({ message: "Upload one SF7 Excel file." });
      return;
    }

    const preview = await previewSf7Import(req.file.buffer, {
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
    });
    res.json(preview);
  } catch (error: unknown) {
    res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Could not parse the SF7 Excel file.",
    });
  }
}

export async function commitImport(req: Request, res: Response): Promise<void> {
  try {
    const result = await commitSf7Import(req.body as Sf7ImportCommitInput);

    await auditLog({
      userId: req.user!.userId,
      actionType: "SF7_IMPORT_COMMITTED",
      description: `Committed SF7 personnel import. Updated ${result.updatedCount} record(s), skipped ${result.skippedCount}.`,
      subjectType: "Teacher",
      recordId: req.user!.userId,
      req,
    });

    broadcastDomainInvalidation({
      topics: ["teachers:list", "teachers:detail", "integration:hub"],
      schoolYearId: req.schoolYearId,
      teacherIds: result.updatedTeacherIds,
    });

    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Could not commit the SF7 import.",
    });
  }
}

export async function syncAtlas(req: Request, res: Response): Promise<void> {
  const schoolYearId = parseSchoolYearId(req);
  if (!schoolYearId) {
    res.status(400).json({ message: "School year is required." });
    return;
  }

  try {
    const result = await syncSf7FromAtlas(schoolYearId);
    const syncedTeacherIds = result.results
      .filter((item) => item.status === "SYNCED")
      .map((item) => item.teacherId);

    await auditLog({
      userId: req.user!.userId,
      actionType: "SF7_ATLAS_SYNC",
      description: `Synced SF7 schedules from ATLAS. Synced ${result.syncedCount}, skipped ${result.skippedCount}, failed ${result.failedCount}.`,
      subjectType: "Teacher",
      recordId: req.user!.userId,
      req,
    });

    broadcastDomainInvalidation({
      topics: ["teachers:list", "teachers:detail", "integration:hub"],
      schoolYearId,
      teacherIds: syncedTeacherIds,
    });

    res.json(result);
  } catch (error: unknown) {
    res.status(503).json({
      message:
        error instanceof Error
          ? error.message
          : "Could not reach ATLAS through the Tailscale network.",
    });
  }
}
