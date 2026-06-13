const fs = require('fs');

let content = fs.readFileSync('client/src/features/admin/pages/Users.tsx', 'utf8');

// The script replaced the `role` with `roles` but there were still some references to `formData.role`.
content = content.replace(/formData\.role/g, 'formData.roles?.[0]');
content = content.replace(/profileFormData\.role/g, 'profileFormData.roles?.[0]');

// We can just fix the payload:
content = content.replace(/role: user\.roles,\n/g, ''); // Wait, it says `role: user.roles` at line 617?
content = content.replace(/role:\n\s+\|\s*"SYSTEM_ADMIN"/g, 'roles: (\n  | "SYSTEM_ADMIN"');

// Fix `role: formData.role` inside handleCreate? 
// Let's replace `role: formData.roles?.[0]` with nothing if it exists, or let's use a simpler replace
content = content.replace(/role: formData\.roles\?\.\[0\],\n/g, '');
content = content.replace(/role: user\.role,\n/g, '');

fs.writeFileSync('client/src/features/admin/pages/Users.tsx', content);
console.log('Fixed more roles in Users.tsx');
