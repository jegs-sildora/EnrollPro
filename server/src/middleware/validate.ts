import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
	return (req: Request, res: Response, next: NextFunction): void => {
		const result = schema.safeParse(req.body);
		if (!result.success) {
			const errors: Record<string, string[]> = {};
			for (const issue of result.error.issues) {
				const key = issue.path.join('.') || '_root';
				if (!errors[key]) errors[key] = [];
				errors[key].push(issue.message);
			}
			res.status(400).json({ message: 'Validation failed', errors });
			return;
		}
		req.body = result.data;
		next();
	};
}
