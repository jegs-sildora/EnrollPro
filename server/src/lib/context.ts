import { AsyncLocalStorage } from 'node:async_hooks';

export interface AuditContextStore {
  userId?: number | null;
  ipAddress: string;
  userAgent?: string | null;
  actionType?: string;
  subjectType?: string | null;
  suppressAutomaticAudit?: boolean;
}

export const auditContext = new AsyncLocalStorage<AuditContextStore>();

export function getAuditContext() {
  return auditContext.getStore();
}

export function runWithAutomaticAuditSuppressed<T>(
  callback: () => Promise<T>,
): Promise<T> {
  const current = auditContext.getStore();
  return auditContext.run(
    {
      ipAddress: current?.ipAddress ?? "0.0.0.0",
      userId: current?.userId,
      userAgent: current?.userAgent,
      actionType: current?.actionType,
      subjectType: current?.subjectType,
      suppressAutomaticAudit: true,
    },
    callback,
  );
}
