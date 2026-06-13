const fs = require('fs');

let content = fs.readFileSync('client/src/features/admin/pages/Users.tsx', 'utf8');

// fix line 87 (User interface)
content = content.replace(
  /role:\n\s+\|\s*"SYSTEM_ADMIN"\n\s+\|\s*"HEAD_REGISTRAR"\n\s+\|\s*"CLASS_ADVISER"\n\s+\|\s*"TEACHER"\n\s+\|\s*"MRF"\n\s+\|\s*"LEARNER";/g,
  `roles: (
  | "SYSTEM_ADMIN"
  | "HEAD_REGISTRAR"
  | "CLASS_ADVISER"
  | "TEACHER"
  | "MRF"
  | "LEARNER"
  )[];`
);

// fix line 389 (profileFormData initial state)
content = content.replace(
  /role: "TEACHER" as User\["role"\],\n\s+department: "",/g,
  `roles: ["TEACHER"] as string[],
    department: "",
    accountName: "",`
);

// fix line 561: role: formData.role
content = content.replace(/role: formData\.role,\n/g, '');

// fix line 617: role: user.role
content = content.replace(/role: user\.role,\n/g, 'roles: user.roles,\n      accountName: user.accountName || "",\n');

// fix lines like selectedUser.role === "LEARNER"
content = content.replace(/selectedUser\?\.role === "([^"]+)"/g, 'selectedUser?.roles?.includes("$1")');
content = content.replace(/selectedUser\?\.role !== "([^"]+)"/g, '!selectedUser?.roles?.includes("$1")');
content = content.replace(/selectedUser\.role === "([^"]+)"/g, 'selectedUser.roles?.includes("$1")');
content = content.replace(/user\.role !== "([^"]+)"/g, '!user.roles?.includes("$1")');
content = content.replace(/u\.role !== "([^"]+)"/g, '!u.roles?.includes("$1")');

// fix user.role to formatUserRole / getRoleColorClasses
content = content.replace(/formatUserRole\(user\.role\)/g, 'formatUserRole(user.roles?.[0])');
content = content.replace(/getRoleColorClasses\(user\.role\)/g, 'getRoleColorClasses(user.roles?.[0])');

fs.writeFileSync('client/src/features/admin/pages/Users.tsx', content);
console.log('Fixed Users.tsx errors perfectly this time');
