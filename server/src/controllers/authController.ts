import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { auditLog } from '../services/auditLogger.js';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({ message: 'Your account has been deactivated. Contact the system administrator.' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role, mustChangePassword: user.mustChangePassword },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' }
  );

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await auditLog({
    userId: user.id,
    actionType: 'USER_LOGIN',
    description: `User ${user.email} logged in from ${req.ip}`,
    req,
  });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword },
  });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, name: true, email: true, role: true, mustChangePassword: true },
  });

  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  res.json({ user });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { newPassword } = req.body;
  const userId = req.user!.userId;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    res.status(400).json({ message: 'New password cannot be the same as your current password.' });
    return;
  }

  const hashed = await bcrypt.hash(newPassword, 12);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { password: hashed, mustChangePassword: false, updatedAt: new Date() },
    select: { id: true, name: true, email: true, role: true, mustChangePassword: true },
  });

  const token = jwt.sign(
    { userId: updated.id, role: updated.role, mustChangePassword: false },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' }
  );

  res.json({ token, user: updated });
}
