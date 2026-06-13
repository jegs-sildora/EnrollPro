import type { Request, Response, NextFunction } from 'express';

export const authorize = (...roles: string[]) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		if (!req.user || !req.user.roles?.some((role: string) => roles.includes(role))) {
			res.status(403).json({ message: 'Forbidden' });
			return;
		}
		next();
	};
};
