import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

function readTypedValidationCode(issue: unknown): string | null {
	if (typeof issue !== 'object' || issue === null || !('params' in issue)) {
		return null;
	}

	const params = issue.params;
	if (typeof params !== 'object' || params === null || !('errorCode' in params)) {
		return null;
	}

	return typeof params.errorCode === 'string' && params.errorCode.length > 0
		? params.errorCode
		: null;
}

export function validate(schema: ZodSchema) {
	return (req: Request, res: Response, next: NextFunction): void => {
		const result = schema.safeParse(req.body);
		if (!result.success) {
			console.error("[Validation Error]", JSON.stringify(result.error.issues, null, 2));
			const errors: Record<string, string[]> = {};
			let typedCode: string | null = null;
			for (const issue of result.error.issues) {
				const key = issue.path.join('.') || '_root';
				if (!errors[key]) errors[key] = [];
				errors[key].push(issue.message);
				typedCode ??= readTypedValidationCode(issue);
			}
			res.status(400).json({
				...(typedCode ? { code: typedCode } : {}),
				message: 'Validation failed',
				errors,
			});
			return;
		}
		req.body = result.data;
		next();
	};
}
