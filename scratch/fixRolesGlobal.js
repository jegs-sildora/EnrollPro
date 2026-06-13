const fs = require('fs');
const path = require('path');

const directory = path.join(__dirname, '..', 'client', 'src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(directory);
let updatedCount = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Fix auth.slice.ts
    if (file.endsWith('auth.slice.ts')) {
        content = content.replace(/role: AuthRole;/, 'roles: AuthRole[];');
    }

    // Replace user?.role === "SYSTEM_ADMIN" -> user?.roles?.includes("SYSTEM_ADMIN")
    content = content.replace(/user\?\.role === "([^"]+)"/g, 'user?.roles?.includes("$1")');
    content = content.replace(/user\.role === "([^"]+)"/g, 'user.roles?.includes("$1")');
    
    // For specific patterns where role was passed to formatUserRole or getRoleColorClasses
    content = content.replace(/formatUserRole\(user\?\.role\)/g, 'formatUserRole(user?.roles?.[0])');
    content = content.replace(/formatUserRole\(log\.user\.role\)/g, 'formatUserRole(log.user.roles?.[0])');
    content = content.replace(/formatUserRole\(actor\.role\)/g, 'formatUserRole(actor.roles?.[0])');
    content = content.replace(/formatUserRole\(auditRow\.modifiedBy\?\.role\)/g, 'formatUserRole(auditRow.modifiedBy?.roles?.[0])');
    
    content = content.replace(/getRoleColorClasses\(user\?\.role\)/g, 'getRoleColorClasses(user?.roles?.[0])');
    content = content.replace(/getRoleColorClasses\(log\.user\.role\)/g, 'getRoleColorClasses(log.user.roles?.[0])');
    content = content.replace(/getRoleColorClasses\(auditRow\.modifiedBy\?\.role\)/g, 'getRoleColorClasses(auditRow.modifiedBy?.roles?.[0])');

    // Fix payload.user.role === "TEACHER"
    content = content.replace(/payload\.user\.role === "([^"]+)"/g, 'payload.user.roles?.includes("$1")');
    
    // Fix res.data.user?.role ===
    content = content.replace(/res\.data\.user\?\.role === "([^"]+)"/g, 'res.data.user?.roles?.includes("$1")');

    // Fix activeRole fallback in ChangePasswordModal
    content = content.replace(/activeRole = user\?\.role \?\? staffAuth\.user\?\.role \?\? null;/g, 'activeRole = user?.roles?.[0] ?? staffAuth.user?.roles?.[0] ?? null;');

    // Fix ProtectedRoute.tsx
    if (file.endsWith('ProtectedRoute.tsx')) {
        content = content.replace(/!allowedRoles\.includes\(user\.role\)/g, '!user.roles?.some((r) => allowedRoles.includes(r))');
    }

    // Fix useAuthStore((state) => state.user?.role)
    content = content.replace(/state\.user\?\.role/g, 'state.user?.roles');

    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
        updatedCount++;
    }
}

console.log(`Fixed ${updatedCount} files.`);
