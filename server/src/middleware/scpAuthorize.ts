import type { Request, Response, NextFunction } from 'express';

export const authorizeScpProgram = (req: Request, res: Response, next: NextFunction): void => {
	if (!req.user || !req.user.roles) {
		res.status(403).json({ message: 'Forbidden' });
		return;
	}

	const roles = req.user.roles;
	const isGlobalAdmin = roles.some((r) => 
		['SYSTEM_ADMIN', 'PRINCIPAL', 'SCHOOL_REGISTRAR', 'HEAD_REGISTRAR'].includes(r)
	);

	if (isGlobalAdmin) {
		next();
		return;
	}

	// Try to extract program from query, body, or params.
	const requestedProgram = req.query.program || req.body.program || req.query.program_id || req.body.program_id;

	if (!requestedProgram) {
		res.status(403).json({ message: 'Forbidden: Missing program identification for role validation.' });
		return;
	}

	const ancillaryRoles = req.user.ancillaryRoles || [];
	let isAuthorized = false;

	if (requestedProgram === 'SCIENCE_TECHNOLOGY_AND_ENGINEERING' && (roles.includes('STE_COORDINATOR') || ancillaryRoles.includes('STE HEAD TEACHER'))) {
		isAuthorized = true;
	} else if (requestedProgram === 'SPECIAL_PROGRAM_IN_THE_ARTS' && (roles.includes('SPA_COORDINATOR') || ancillaryRoles.includes('SPA HEAD TEACHER'))) {
		isAuthorized = true;
	} else if (requestedProgram === 'SPECIAL_PROGRAM_IN_SPORTS' && (roles.includes('SPS_COORDINATOR') || ancillaryRoles.includes('SPS HEAD TEACHER'))) {
		isAuthorized = true;
	}

	if (!isAuthorized) {
		res.status(403).json({ message: 'Forbidden: You are not authorized to manage this program.' });
		return;
	}

	next();
};
