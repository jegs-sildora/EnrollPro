import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { auditLog } from '../services/auditLogger.js';

export async function index(req: Request, res: Response) {
  try {
    const { role, isActive, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(String(page)) - 1) * parseInt(String(limit));

    const where: any = {};
    if (role) {
      where.role = role;
    }
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

    // Allow creating another SYSTEM_ADMIN if needed, or keep it restricted? 
    // Usually, only one super admin is seeded, but let's allow it if requested by a super admin.
    // However, the prompt just said "add the admin user account so admin can manage his/her account".

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

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    // Protect SYSTEM_ADMIN role transitions if necessary
    // If updating a SYSTEM_ADMIN, don't allow changing their role unless there's another one?
    // For now, let's just allow updates.

    const user = await prisma.user.update({
      where: { id: userId },
      data: { 
        name, 
        email, 
        ...(role ? { role } : {}) 
      },
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

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    if (targetUser.role === 'SYSTEM_ADMIN') {
      return res.status(400).json({ message: 'SYSTEM_ADMIN accounts cannot be deactivated to prevent system lockout.' });
    }

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
