export class AppError extends Error {
	readonly statusCode: number;

	constructor(statusCode: number, message: string) {
		super(message);
		this.statusCode = statusCode;
		Object.setPrototypeOf(this, AppError.prototype);
	}
}
