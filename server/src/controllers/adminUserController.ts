import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { auditLog } from '../services/auditLogger.js';

export async function index(req: Request, res: Response) {
  try {
    const { role, isActive, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(String(page)) - 1) * parseInt(String(limit));

    const where: any = { role: { not: 'SYSTEM_ADMIN' } };
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = String(isActive) === 'true';

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(String(limit)),
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page: parseInt(String(page)), limit: parseInt(String(limit)) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function store(req: Request, res: Response) {
  try {
    const { name, email, password, role, mustChangePassword = true } = req.body;

    if (role === 'SYSTEM_ADMIN') {
      return res.status(403).json({ message: 'The SYSTEM_ADMIN role cannot be assigned through the API. Use the seed script.' });
    }

    const hashed = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role,
        mustChangePassword,
        createdById: req.user!.userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: 'ADMIN_USER_CREATED',
      description: `Admin created account: ${name} (${role})`,
      subjectType: 'User',
      subjectId: user.id,
      req,
    });

    res.status(201).json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const { name, email, role } = req.body;
    const userId = parseInt(String(req.params.id));

    if (role === 'SYSTEM_ADMIN') {
      return res.status(403).json({ message: 'The SYSTEM_ADMIN role cannot be assigned through the API.' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name, email, role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: 'ADMIN_USER_UPDATED',
      description: `Admin updated account: ${name}`,
      subjectType: 'User',
      subjectId: userId,
      req,
    });

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function deactivate(req: Request, res: Response) {
  try {
    const userId = parseInt(String(req.params.id));

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: { id: true, name: true, role: true },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: 'ADMIN_USER_DEACTIVATED',
      description: `Admin deactivated account: ${user.name} (${user.role})`,
      subjectType: 'User',
      subjectId: userId,
      req,
    });

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function reactivate(req: Request, res: Response) {
  try {
    const userId = parseInt(String(req.params.id));

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
      select: { id: true, name: true, role: true },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: 'ADMIN_USER_REACTIVATED',
      description: `Admin reactivated account: ${user.name} (${user.role})`,
      subjectType: 'User',
      subjectId: userId,
      req,
    });

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { newPassword, mustChangePassword = true } = req.body;
    const userId = parseInt(String(req.params.id));

    const hashed = await bcrypt.hash(newPassword, 12);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { password: hashed, mustChangePassword },
      select: { id: true, name: true },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: 'ADMIN_PASSWORD_RESET',
      description: `Admin reset password for: ${user.name}`,
      subjectType: 'User',
      subjectId: userId,
      req,
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
