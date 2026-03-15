import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export interface AuthPayload {
  userId: number;
  role: string;
  mustChangePassword?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET!) as AuthPayload;
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { isActive: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ message: 'Account is inactive. Contact your system administrator.' });
      return;
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
