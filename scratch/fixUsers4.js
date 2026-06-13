const fs = require('fs');

let content = fs.readFileSync('client/src/features/admin/pages/Users.tsx', 'utf8');

// fix User interface
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

// fix profileFormData initial state
content = content.replace(
  /role: "TEACHER" as User\["role"\],\n\s+department: "",/g,
  `roles: ["TEACHER"] as string[],
    department: "",
    accountName: "",`
);

// fix validateCreateForm
content = content.replace(/formData\.role === "([^"]+)"/g, 'formData.roles?.includes("$1")');

// fix validateProfileForm
content = content.replace(/profileFormData\.role === "([^"]+)"/g, 'profileFormData.roles?.includes("$1")');

// fix handleCreate
content = content.replace(/role: formData\.roles\?\.\[0\],\n/g, '');
content = content.replace(/role: formData\.roles,\n/g, '');

// fix FetchUsersParams
content = content.replace(/role\?: string;/g, 'roles?: string[];');

fs.writeFileSync('client/src/features/admin/pages/Users.tsx', content);
console.log('Fixed Users.tsx errors');
