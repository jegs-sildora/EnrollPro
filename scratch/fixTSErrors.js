const fs = require('fs');

// 1. Audit Logs
let auditLogs = fs.readFileSync('client/src/features/audit-logs/pages/Index.tsx', 'utf8');
auditLogs = auditLogs.replace(/type AuditUser = {\n  id: number;\n  name: string;\n  role: string;\n};/g, 'type AuditUser = {\n  id: number;\n  name: string;\n  roles: string[];\n};');
auditLogs = auditLogs.replace(/actor\.roles\?\.\[0\]/g, 'actor.roles?.[0]');
// Wait, I messed up the regex for formatUserRole(actor.role) maybe it became actor.roles?.[0]
fs.writeFileSync('client/src/features/audit-logs/pages/Index.tsx', auditLogs);

// 2. Login.tsx
let login = fs.readFileSync('client/src/features/auth/pages/Login.tsx', 'utf8');
login = login.replace(/role: string;/g, 'roles: string[];');
login = login.replace(/role: AuthRole;/g, 'roles: AuthRole[];');
fs.writeFileSync('client/src/features/auth/pages/Login.tsx', login);

// 3. ActionButtons.tsx
let actionBtn = fs.readFileSync('client/src/features/enrollment/components/ActionButtons.tsx', 'utf8');
actionBtn = actionBtn.replace(/userRoles === "SYSTEM_ADMIN"/g, 'userRoles?.includes("SYSTEM_ADMIN")');
actionBtn = actionBtn.replace(/const userRoles = useAuthStore\(\(state\) => state\.user\?\.roles\);/g, 'const userRoles = useAuthStore((state) => state.user?.roles);');
fs.writeFileSync('client/src/features/enrollment/components/ActionButtons.tsx', actionBtn);

// 4. DocumentManagement.tsx
let docMgt = fs.readFileSync('client/src/features/enrollment/components/DocumentManagement.tsx', 'utf8');
docMgt = docMgt.replace(/role: string;/g, 'roles: string[];');
fs.writeFileSync('client/src/features/enrollment/components/DocumentManagement.tsx', docMgt);

// 5. useHistoricalReadOnly.ts
let historical = fs.readFileSync('client/src/shared/hooks/useHistoricalReadOnly.ts', 'utf8');
historical = historical.replace(/const isSuperAdmin = user\?\.roles\?\.includes\("SYSTEM_ADMIN"\);/g, 'const isSuperAdmin = user?.roles?.includes("SYSTEM_ADMIN") ?? false;');
fs.writeFileSync('client/src/shared/hooks/useHistoricalReadOnly.ts', historical);
