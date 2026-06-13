const fs = require('fs');

let content = fs.readFileSync('client/src/features/admin/pages/Users.tsx', 'utf8');

// 1. User Interface
content = content.replace(
  /role:\n  \| "SYSTEM_ADMIN"\n  \| "HEAD_REGISTRAR"\n  \| "CLASS_ADVISER"\n  \| "TEACHER"\n  \| "MRF"\n  \| "LEARNER";/g,
  `roles: (
  | "SYSTEM_ADMIN"
  | "HEAD_REGISTRAR"
  | "CLASS_ADVISER"
  | "TEACHER"
  | "MRF"
  | "LEARNER"
  )[];`
);
content = content.replace(/employeeId: string \| null;/g, 'employeeId: string | null;\n  accountName: string | null;');

// 2. formData and profileFormData
content = content.replace(/role: "TEACHER" as User\["role"\],/g, 'roles: ["TEACHER"] as string[],');
content = content.replace(/department: "",\n  }\);/g, 'department: "",\n    accountName: "",\n  });');

// 3. validateCreateForm
content = content.replace(
  /\(formData\.role === "SYSTEM_ADMIN" \|\|\n\s+formData\.role === "HEAD_REGISTRAR" \|\|\n\s+formData\.role === "TEACHER" \|\|\n\s+formData\.role === "CLASS_ADVISER" \|\|\n\s+formData\.role === "MRF"\)/g,
  '(formData.roles.some((r) => ["SYSTEM_ADMIN", "HEAD_REGISTRAR", "TEACHER", "CLASS_ADVISER"].includes(r)))'
);
content = content.replace(
  /nextErrors\.employeeId = "Employee ID must be exactly 7 numeric digits\.";\n    }/g,
  `nextErrors.employeeId = "Employee ID must be exactly 7 numeric digits.";
    }
    if (
      formData.roles.some((r) => ["MRF"].includes(r)) &&
      !formData.accountName?.trim()
    ) {
      nextErrors.accountName = "System Username is required for MRF staff.";
    }`
);

// 4. validateProfileForm
content = content.replace(
  /\(profileFormData\.role === "SYSTEM_ADMIN" \|\|\n\s+profileFormData\.role === "HEAD_REGISTRAR" \|\|\n\s+profileFormData\.role === "MRF"\)/g,
  '(profileFormData.roles.some((r) => ["SYSTEM_ADMIN", "HEAD_REGISTRAR"].includes(r)))'
);
content = content.replace(
  /nextErrors\.employeeId = "Employee ID must be exactly 7 numeric digits\.";\n    }/g,
  `nextErrors.employeeId = "Employee ID must be exactly 7 numeric digits.";
    }
    if (
      profileFormData.roles.some((r) => ["MRF"].includes(r)) &&
      !profileFormData.accountName?.trim()
    ) {
      nextErrors.accountName = "System Username is required for MRF staff.";
    }`
);

// 5. handleCreate and handleProfileSave payloads
content = content.replace(/roles: formData\.roles,\n\s+mustChangePassword: formData\.mustChangePassword,\n\s+department: formData\.department \|\| null,\n\s+};\n\s+await api\.post\("\/admin\/users", payload\);/g, `roles: formData.roles,
        mustChangePassword: formData.mustChangePassword,
        department: formData.department || null,
        accountName: formData.accountName?.trim() || null,
      };
      await api.post("/admin/users", payload);`);

content = content.replace(/email: user\.email,\n\s+roles: user\.roles,\n\s+department: "",\n\s+}\);\n\s+setProfileOpen\(true\);/g, `email: user.email,
      roles: user.roles,
      department: "",
      accountName: user.accountName || "",
    });
    setProfileOpen(true);`);
    
// 6. Fix `user.role` to `user.roles` usages from fixRolesGlobal.js
content = content.replace(/user\?\.role === "([^"]+)"/g, 'user?.roles?.includes("$1")');
content = content.replace(/user\.role === "([^"]+)"/g, 'user.roles?.includes("$1")');
content = content.replace(/formatUserRole\(user\?\.role\)/g, 'formatUserRole(user?.roles?.[0])');
content = content.replace(/getRoleColorClasses\(user\?\.role\)/g, 'getRoleColorClasses(user?.roles?.[0])');
content = content.replace(/res\.data\.user\?\.role === "([^"]+)"/g, 'res.data.user?.roles?.includes("$1")');
content = content.replace(/payload\.user\.role === "([^"]+)"/g, 'payload.user.roles?.includes("$1")');
content = content.replace(/state\.user\?\.role/g, 'state.user?.roles');

fs.writeFileSync('client/src/features/admin/pages/Users.tsx', content);
console.log('Fixed Users.tsx');
