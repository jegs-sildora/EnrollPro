import type { Request, Response, NextFunction } from 'express';

export const authorize = (...roles: string[]) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		if (!req.user) {
			res.status(403).json({ message: 'Forbidden' });
			return;
		}

		const hasRole = req.user.roles?.some((role: string) => roles.includes(role));
		const hasAncillaryRole = req.user.ancillaryRoles?.some((role: string) => roles.includes(role));

		if (!hasRole && !hasAncillaryRole) {
			res.status(403).json({ message: 'Forbidden' });
			return;
		}
		next();
	};
};
