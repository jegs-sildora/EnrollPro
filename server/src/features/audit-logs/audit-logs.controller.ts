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

const parseDateValue = (value: unknown): Date | undefined => {
  const normalized = parseQueryString(value);
  if (!normalized) {
    return undefined;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export async function index(req: Request, res: Response) {
  try {
    const page = parsePositiveInt(req.query.page) ?? 1;
    const limit = Math.min(parsePositiveInt(req.query.limit) ?? 20, 100);
    const skip = (page - 1) * limit;

    const actionType = parseQueryString(req.query.actionType);
    const userId = parsePositiveInt(req.query.userId);
    const dateFrom = parseDateValue(req.query.dateFrom);
    const dateTo = parseDateValue(req.query.dateTo);

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

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs,
      total,
      page,
      limit,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch audit logs";
    res.status(500).json({ message });
  }
}

export async function exportCsv(req: Request, res: Response) {
  try {
    if (req.user?.role !== "SYSTEM_ADMIN") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const actionType = parseQueryString(req.query.actionType);
    const userId = parsePositiveInt(req.query.userId);
    const dateFrom = parseDateValue(req.query.dateFrom);
    const dateTo = parseDateValue(req.query.dateTo);

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

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const csv = [
      "Timestamp,User,Role,Action Type,Description,IP Address,User Agent",
      ...logs.map((log) => {
        const userName = log.user
          ? `"${log.user.lastName}, ${log.user.firstName}"`
          : '"System/Guest"';
        return [
          log.createdAt.toISOString(),
          userName,
          log.user?.role || "",
          log.actionType,
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
    const message =
      error instanceof Error ? error.message : "Failed to export audit logs";
    res.status(500).json({ message });
  }
}
