import { prisma } from '../../lib/prisma.js';

export async function auditLog({
	userId,
	actionType,
	description,
	subjectType,
	recordId,
	req,
}: {
	userId?: number | null;
	actionType: string;
	description: string;
	subjectType?: string | null;
	recordId?: number | null;
	req: { ip?: string; headers: Record<string, string | string[] | undefined> };
}) {
	await prisma.auditLog.create({
		data: {
			userId: userId ?? null,
			actionType,
			description,
			subjectType: subjectType ?? null,
			recordId: recordId ?? null,
			ipAddress: req.ip ?? '0.0.0.0',
			userAgent: (req.headers['user-agent'] as string) ?? null,
		},
	});
}
