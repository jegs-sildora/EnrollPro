import { Prisma } from '../../generated/prisma/index.js';
import { prisma } from '../../lib/prisma.js';
import { broadcastDomainInvalidation } from '../../lib/realtime-events.js';

function normalizeAuditMetadata(
	metadata: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
	if (metadata === undefined) return undefined;
	if (metadata === null) return Prisma.JsonNull;
	return JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue;
}

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
	metadata?: unknown;
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
			metadata: normalizeAuditMetadata(metadata),
			ipAddress: req.ip ?? '0.0.0.0',
			userAgent: (req.headers['user-agent'] as string) ?? null,
		},
	});

	broadcastDomainInvalidation({
		topics: ["audit-logs:list"],
	});
}
