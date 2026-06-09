import { AsyncLocalStorage } from 'node:async_hooks';

export interface AuditContextStore {
  userId?: number | null;
  ipAddress: string;
  userAgent?: string | null;
  actionType?: string;
  subjectType?: string | null;
}

export const auditContext = new AsyncLocalStorage<AuditContextStore>();

export function getAuditContext() {
  return auditContext.getStore();
}
