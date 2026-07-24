import { Request, Response } from "express";
import { type Prisma } from "../../generated/prisma/index.js";
import { prisma } from "../../lib/prisma.js";

const parseQueryString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parsePositiveInt = (value: unknown): number | undefined => {
  const normalized = parseQueryString(value);
  if (!normalized) {
    return undefined;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const parseManilaDateStart = (value: unknown): Date | undefined => {
  const normalized = parseQueryString(value);
  if (!normalized) return undefined;
  
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [_, y, m, d] = match;
    return new Date(`${y}-${m}-${d}T00:00:00+08:00`);
  }
  
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const parseManilaDateEnd = (value: unknown): Date | undefined => {
  const normalized = parseQueryString(value);
  if (!normalized) return undefined;
  
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [_, y, m, d] = match;
    const start = new Date(`${y}-${m}-${d}T00:00:00+08:00`);
    return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  }
  
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

/**
 * Forensic Helper: Resolves numeric recordIds into human-readable strings
 */
async function resolveSubjectNames<
  T extends { subjectType: string | null; recordId: number | null },
>(logs: T[]): Promise<Array<T & { resolvedSubject: string | null }>> {
  const subjectGroups: Record<string, Set<number>> = {};
  logs.forEach((log) => {
    if (log.subjectType && log.recordId) {
      if (!subjectGroups[log.subjectType]) subjectGroups[log.subjectType] = new Set();
      subjectGroups[log.subjectType].add(log.recordId);
    }
  });

  const nameMap: Record<string, Record<number, string>> = {};

  for (const type of Object.keys(subjectGroups)) {
    const ids = Array.from(subjectGroups[type]);
    nameMap[type] = {};

    try {
      if (type === "Learner") {
        const records = await prisma.learner.findMany({
          where: { id: { in: ids } },
          select: { id: true, firstName: true, lastName: true },
        });
        records.forEach((r) => (nameMap[type][r.id] = `${r.lastName}, ${r.firstName}`));
      } else if (type === "Teacher") {
        const records = await prisma.teacher.findMany({
          where: { id: { in: ids } },
          select: { id: true, firstName: true, lastName: true },
        });
        records.forEach((r) => (nameMap[type][r.id] = `${r.lastName}, ${r.firstName}`));
      } else if (type === "Section") {
        const records = await prisma.section.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, gradeLevel: { select: { name: true } } },
        });
        records.forEach((r) => (nameMap[type][r.id] = `${r.gradeLevel.name} - ${r.name}`));
      } else if (type === "User") {
        const records = await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, firstName: true, lastName: true },
        });
        records.forEach((r) => (nameMap[type][r.id] = `${r.lastName}, ${r.firstName}`));
      } else if (type === "SchoolYear") {
        const records = await prisma.schoolYear.findMany({
          where: { id: { in: ids } },
          select: { id: true, yearLabel: true },
        });
        records.forEach((r) => (nameMap[type][r.id] = r.yearLabel));
      } else if (type === "EnrollmentApplication") {
        const records = await prisma.enrollmentApplication.findMany({
          where: { id: { in: ids } },
          select: { id: true, learner: { select: { firstName: true, lastName: true } } },
        });
        records.forEach((record) => {
          nameMap[type][record.id] =
            `${record.learner.lastName}, ${record.learner.firstName}`;
        });
      }
    } catch (e) {
      console.error(`Failed to resolve subject names for ${type}`, e);
    }
  }

  return logs.map((log) => ({
    ...log,
    resolvedSubject: log.subjectType && log.recordId ? nameMap[log.subjectType]?.[log.recordId] : null,
  }));
}

async function listAuditLogs(
  req: Request,
  res: Response,
  forcedUserId?: number,
) {
  try {
    const page = parsePositiveInt(req.query.page) ?? 1;
    const limit = Math.min(parsePositiveInt(req.query.limit) ?? 20, 1000000);
    const skip = (page - 1) * limit;

    const actionType = parseQueryString(req.query.actionType);
    const userId = forcedUserId ?? parsePositiveInt(req.query.userId);
    const dateFrom = parseManilaDateStart(req.query.dateFrom);
    const dateTo = parseManilaDateEnd(req.query.dateTo);

    const where: Prisma.AuditLogWhereInput = {};
    if (actionType) {
      where.actionType = actionType;
    }
    if (userId) {
      where.userId = userId;
    }
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }

    // Forensic Metadata: Critical alerts are those involving deletions, locks, or system changes
    const CRITICAL_ACTION_PATTERNS = ["DELETE", "LOCK", "REMOVE", "SYNC_FAILED", "CONFIG_UPDATE", "EXPORT"];

    const [rawLogs, total, criticalCount, activeActors] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              roles: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.count({
        where: {
          ...where,
          OR: CRITICAL_ACTION_PATTERNS.map((pattern) => ({ actionType: { contains: pattern } })),
        },
      }),
      prisma.auditLog.groupBy({
        by: ["userId"],
        where,
        _count: { userId: true },
      }),
    ]);

    const logs = await resolveSubjectNames(rawLogs);

    res.json({
      logs,
      total,
      meta: {
        criticalCount,
        activeActors: activeActors.length,
      },
      page,
      limit,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch audit logs";
    res.status(500).json({ message });
  }
}

export async function index(req: Request, res: Response) {
  return listAuditLogs(req, res);
}

export async function mine(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return listAuditLogs(req, res, userId);
}

export async function getFilters(req: Request, res: Response) {
  try {
    const [actionTypes, actors] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ["actionType"],
        orderBy: { actionType: "asc" },
      }),
      prisma.user.findMany({
        where: { auditLogs: { some: {} } },
        select: { id: true, firstName: true, lastName: true, roles: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);

    res.json({
      actionTypes: actionTypes.map((a) => a.actionType),
      actors: actors.map((a) => ({
        id: a.id,
        name: `${a.lastName}, ${a.firstName}`,
        roles: a.roles,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch filter metadata" });
  }
}

export async function getMyFilters(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const actionTypes = await prisma.auditLog.groupBy({
      by: ["actionType"],
      where: { userId },
      orderBy: { actionType: "asc" },
    });

    res.json({
      actionTypes: actionTypes.map((action) => action.actionType),
      actors: [],
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch activity filters" });
  }
}

export async function exportCsv(req: Request, res: Response) {
  try {
    if (!req.user?.roles?.includes("SYSTEM_ADMIN")) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const actionType = parseQueryString(req.query.actionType);
    const userId = parsePositiveInt(req.query.userId);
    const dateFrom = parseManilaDateStart(req.query.dateFrom);
    const dateTo = parseManilaDateEnd(req.query.dateTo);

    const where: Prisma.AuditLogWhereInput = {};
    if (actionType) {
      where.actionType = actionType;
    }
    if (userId) {
      where.userId = userId;
    }
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }

    const rawLogs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            roles: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const logs = await resolveSubjectNames(rawLogs);

    const csv = [
      "Timestamp,User,Role,Action Type,Subject,Description,IP Address,User Agent",
      ...logs.map((log) => {
        const userName = log.user ? `"${log.user.lastName}, ${log.user.firstName}"` : '"System/Guest"';
        const subject = log.resolvedSubject ? `"${log.subjectType}: ${log.resolvedSubject}"` : `"${log.subjectType || ""}${log.recordId ? ` #${log.recordId}` : ""}"`;
        return [
          log.createdAt.toISOString(),
          userName,
          log.user?.roles?.join("/") || "",
          log.actionType,
          subject,
          `"${log.description}"`,
          log.ipAddress,
          `"${log.userAgent || ""}"`,
        ].join(",");
      }),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=audit-log-${new Date().toISOString().split("T")[0]}.csv`,
    );
    res.send(csv);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to export audit logs";
    res.status(500).json({ message });
  }
}

