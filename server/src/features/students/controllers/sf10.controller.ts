import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../lib/AppError.js";
import { auditLog } from "../../audit-logs/audit-logs.service.js";
import { sf10RequestCreateSchema, sf10RequestUpdateSchema } from "@enrollpro/shared/schemas";

export async function getSf10Requests(req: Request, res: Response, next: NextFunction) {
  try {
    const { learnerId } = req.params;
    const requests = await prisma.sf10Request.findMany({
      where: { learnerId: Number(learnerId) },
      orderBy: { requestDate: "desc" },
    });
    res.json(requests);
  } catch (error) {
    next(error);
  }
}

export async function createSf10Request(req: Request, res: Response, next: NextFunction) {
  try {
    const { learnerId } = req.params;
    const validated = sf10RequestCreateSchema.parse(req.body);

    const learner = await prisma.learner.findUnique({
      where: { id: Number(learnerId) },
    });

    if (!learner) {
      throw new AppError(404, "Learner not found.");
    }

    const request = await prisma.sf10Request.create({
      data: {
        learnerId: Number(learnerId),
        requestingSchoolName: validated.requestingSchoolName,
        requestingSchoolDepedId: validated.requestingSchoolDepedId,
        requestDate: validated.requestDate ? new Date(validated.requestDate) : new Date(),
        notes: validated.notes,
        status: "PENDING",
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "SF10_REQUEST_CREATED",
      description: `Logged new SF10 request from ${validated.requestingSchoolName} for learner ${learner.lastName}, ${learner.firstName}`,
      subjectType: "Learner",
      recordId: Number(learnerId),
      req,
    });

    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
}

export async function updateSf10Request(req: Request, res: Response, next: NextFunction) {
  try {
    const { requestId } = req.params;
    const validated = sf10RequestUpdateSchema.parse(req.body);

    const existing = await prisma.sf10Request.findUnique({
      where: { id: Number(requestId) },
      include: { learner: true },
    });

    if (!existing) {
      throw new AppError(404, "SF10 request not found.");
    }

    const updated = await prisma.sf10Request.update({
      where: { id: Number(requestId) },
      data: {
        status: validated.status,
        sentDate: validated.sentDate ? new Date(validated.sentDate) : (validated.status === "SENT" ? new Date() : null),
        notes: validated.notes,
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "SF10_REQUEST_UPDATED",
      description: `Updated SF10 request status to ${validated.status} for learner ${existing.learner.lastName}, ${existing.learner.firstName}`,
      subjectType: "Learner",
      recordId: existing.learnerId,
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function deleteSf10Request(req: Request, res: Response, next: NextFunction) {
  try {
    const { requestId } = req.params;

    const existing = await prisma.sf10Request.findUnique({
      where: { id: Number(requestId) },
    });

    if (!existing) {
      throw new AppError(404, "SF10 request not found.");
    }

    await prisma.sf10Request.delete({
      where: { id: Number(requestId) },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "SF10_REQUEST_DELETED",
      description: `Deleted SF10 request for learner ID ${existing.learnerId}`,
      subjectType: "Learner",
      recordId: existing.learnerId,
      req,
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
