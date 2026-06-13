const fs = require('fs');

let content = fs.readFileSync('client/src/features/admin/pages/Users.tsx', 'utf8');

// replace all \r\n with \n so simple matches work
content = content.replace(/\r\n/g, '\n');

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

// fix FetchUsersParams
content = content.replace(/role\?: string;/g, 'roles?: string[];');

// fix role in initial states
content = content.replace(/role: "TEACHER" as User\["role"\],/g, 'roles: ["TEACHER"] as string[],');

// fix role in validation
content = content.replace(/formData\.role === "([^"]+)"/g, 'formData.roles?.includes("$1")');
content = content.replace(/profileFormData\.role === "([^"]+)"/g, 'profileFormData.roles?.includes("$1")');

// fix role: formData.role and role: user.role
content = content.replace(/role: formData\.roles\?\.\[0\],\n/g, '');
content = content.replace(/role: formData\.roles,\n/g, '');
content = content.replace(/role: formData\.role,\n/g, '');
content = content.replace(/role: profileFormData\.role,\n/g, '');
content = content.replace(/role: user\.role,\n/g, 'roles: user.roles,\n');

// fix user.role logic
content = content.replace(/selectedUser\?\.role === "([^"]+)"/g, 'selectedUser?.roles?.includes("$1")');
content = content.replace(/selectedUser\?\.role !== "([^"]+)"/g, '!selectedUser?.roles?.includes("$1")');
content = content.replace(/selectedUser\.role === "([^"]+)"/g, 'selectedUser.roles?.includes("$1")');
content = content.replace(/user\.role !== "([^"]+)"/g, '!user.roles?.includes("$1")');
content = content.replace(/u\.role !== "([^"]+)"/g, '!u.roles?.includes("$1")');
content = content.replace(/formatUserRole\(user\.role\)/g, 'formatUserRole(user.roles?.[0])');
content = content.replace(/getRoleColorClasses\(user\.role\)/g, 'getRoleColorClasses(user.roles?.[0])');
content = content.replace(/user\.role/g, 'user.roles?.[0]');

fs.writeFileSync('client/src/features/admin/pages/Users.tsx', content);
console.log('Fixed Users.tsx finally');
