import { prisma } from '../../lib/prisma.js';

export async function auditLog({
	userId,
	actionType,
	description,
	subjectType,
	recordId,
	oldValue,
	newValue,
	metadata,
	req,
}: {
	userId?: number | null;
	actionType: string;
	description: string;
	subjectType?: string | null;
	recordId?: number | null;
	oldValue?: string | null;
	newValue?: string | null;
	metadata?: any;
	req: { ip?: string; headers: Record<string, string | string[] | undefined> };
}) {
	await prisma.auditLog.create({
		data: {
			userId: userId ?? null,
			actionType,
			description,
			subjectType: subjectType ?? null,
			recordId: recordId ?? null,
			oldValue: oldValue ?? null,
			newValue: newValue ?? null,
			metadata: metadata ?? undefined,
			ipAddress: req.ip ?? '0.0.0.0',
			userAgent: (req.headers['user-agent'] as string) ?? null,
		},
	});
}
