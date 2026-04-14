import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
	err: Error & { statusCode?: number },
	req: Request,
	res: Response,
	_next: NextFunction,
): void {
	console.error('[Error Details]', err);
	const status = err.statusCode ?? 500;
	res.status(status).json({ message: err.message || 'Internal Server Error' });
}
