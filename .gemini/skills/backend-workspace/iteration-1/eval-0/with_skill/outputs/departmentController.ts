import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { auditLog } from '../services/auditLogger.js';

export async function createDepartment(req: Request, res: Response): Promise<void> {
  const { name, code, description } = req.body;

  const existing = await prisma.department.findUnique({ where: { code } });
  if (existing) {
    res.status(400).json({ message: 'Department with this code already exists' });
    return;
  }

  const department = await prisma.department.create({
    data: { name, code, description },
  });

  await auditLog({
    userId: req.user?.userId,
    actionType: 'CREATE_DEPARTMENT',
    description: `Created department: ${name} (${code})`,
    subjectType: 'Department',
    recordId: department.id,
    req,
  });

  res.status(201).json(department);
}

export async function listDepartments(req: Request, res: Response): Promise<void> {
  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
  });
  res.json(departments);
}
