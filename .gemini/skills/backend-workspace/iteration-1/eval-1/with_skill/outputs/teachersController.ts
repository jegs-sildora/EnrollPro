import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { auditLog } from '../services/auditLogger.js';

export async function index(req: Request, res: Response) {
  try {
    const teachers = await prisma.teacher.findMany({
      orderBy: { lastName: 'asc' },
      include: {
        _count: { select: { sections: true } }
      }
    });
    res.json({ teachers });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function show(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id));
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        sections: {
          include: {
            gradeLevel: true,
            _count: { select: { enrollments: true } }
          }
        }
      }
    });

    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    res.json({ teacher });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function store(req: Request, res: Response) {
  try {
    const { firstName, lastName, middleName, email, employeeId, contactNumber, specialization, subjects } = req.body;

    const teacher = await prisma.teacher.create({
      data: {
        firstName,
        lastName,
        middleName: middleName || null,
        email: email || null,
        employeeId: employeeId || null,
        contactNumber: contactNumber || null,
        specialization: specialization || null,
        subjects: subjects || [],
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: 'TEACHER_CREATED',
      description: `Created teacher profile: ${lastName}, ${firstName}`,
      subjectType: 'Teacher',
      recordId: teacher.id,
      req,
    });

    res.status(201).json({ teacher });
  } catch (error: any) {
    if (error.code === 'P2002' && error.meta?.target?.includes('employeeId')) {
      return res.status(400).json({ message: 'Employee ID already exists' });
    }
    res.status(500).json({ message: error.message });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id));
    const { firstName, lastName, middleName, email, employeeId, contactNumber, specialization, subjects } = req.body;

    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const teacher = await prisma.teacher.update({
      where: { id },
      data: {
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(middleName !== undefined ? { middleName: middleName || null } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
        ...(employeeId !== undefined ? { employeeId: employeeId || null } : {}),
        ...(contactNumber !== undefined ? { contactNumber: contactNumber || null } : {}),
        ...(specialization !== undefined ? { specialization: specialization || null } : {}),
        ...(subjects !== undefined ? { subjects } : {}),
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: 'TEACHER_UPDATED',
      description: `Updated teacher profile: ${teacher.lastName}, ${teacher.firstName}`,
      subjectType: 'Teacher',
      recordId: id,
      req,
    });

    res.json({ teacher });
  } catch (error: any) {
    if (error.code === 'P2002' && error.meta?.target?.includes('employeeId')) {
      return res.status(400).json({ message: 'Employee ID already exists' });
    }
    res.status(500).json({ message: error.message });
  }
}

export async function deactivate(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id));

    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const teacher = await prisma.teacher.update({
      where: { id },
      data: { isActive: false },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: 'TEACHER_DEACTIVATED',
      description: `Deactivated teacher: ${teacher.lastName}, ${teacher.firstName}`,
      subjectType: 'Teacher',
      recordId: id,
      req,
    });

    res.json({ teacher });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function reactivate(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id));

    const teacher = await prisma.teacher.update({
      where: { id },
      data: { isActive: true },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: 'TEACHER_REACTIVATED',
      description: `Reactivated teacher: ${teacher.lastName}, ${teacher.firstName}`,
      subjectType: 'Teacher',
      recordId: id,
      req,
    });

    res.json({ teacher });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
