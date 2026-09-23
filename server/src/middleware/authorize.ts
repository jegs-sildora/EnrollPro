import type { Request, Response, NextFunction } from 'express';

export const authorize = (...roles: string[]) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		if (!req.user) {
			res.status(403).json({ message: 'Forbidden' });
			return;
		}

		const expandedRoles = roles.flatMap(role => 
			role === "GRADE_LEVEL_COORDINATOR" 
				? ["GRADE_LEVEL_COORDINATOR", "GRADE 7 COORDINATOR", "GRADE 8 COORDINATOR", "GRADE 9 COORDINATOR", "GRADE 10 COORDINATOR", "GRADE LEVEL CHAIRMAN"] 
				: [role]
		);

		const hasRole = req.user.roles?.some((role: string) => expandedRoles.includes(role));
		const hasAncillaryRole = req.user.ancillaryRoles?.some((role: string) => expandedRoles.includes(role));

		if (!hasRole && !hasAncillaryRole) {
			res.status(403).json({ message: 'Forbidden' });
			return;
		}
		next();
	};
};
