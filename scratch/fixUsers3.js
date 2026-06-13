const fs = require('fs');

let content = fs.readFileSync('client/src/features/admin/pages/Users.tsx', 'utf8');

// 1. User Interface
content = content.replace(
  `  role:
  | "SYSTEM_ADMIN"
  | "HEAD_REGISTRAR"
  | "CLASS_ADVISER"
  | "TEACHER"
  | "MRF"
  | "LEARNER";`,
  `  roles: (
  | "SYSTEM_ADMIN"
  | "HEAD_REGISTRAR"
  | "CLASS_ADVISER"
  | "TEACHER"
  | "MRF"
  | "LEARNER"
  )[];`
);
content = content.replace('employeeId: string | null;', 'employeeId: string | null;\n  accountName: string | null;');

// 2. formData and profileFormData
content = content.replace('role: "TEACHER" as User["role"],', 'roles: ["TEACHER"] as string[],');
content = content.replace(`    department: "",\n  });\n  const [selectedUser, setSelectedUser]`, `    department: "",\n    accountName: "",\n  });\n  const [selectedUser, setSelectedUser]`);
content = content.replace(`    department: "",\n  });\n\n  const validateCreateForm`, `    department: "",\n    accountName: "",\n  });\n\n  const validateCreateForm`);

// 3. validateCreateForm
content = content.replace(
  `    if (
      (formData.role === "SYSTEM_ADMIN" ||
        formData.role === "HEAD_REGISTRAR" ||
        formData.role === "TEACHER" ||
        formData.role === "CLASS_ADVISER" ||
        formData.role === "MRF") &&
      !formData.employeeId.trim()
    ) {
      nextErrors.employeeId = "Employee ID is mandatory for this role.";
    }`,
  `    if (
      (formData.roles.some((r) => ["SYSTEM_ADMIN", "HEAD_REGISTRAR", "TEACHER", "CLASS_ADVISER"].includes(r))) &&
      !formData.employeeId.trim()
    ) {
      nextErrors.employeeId = "Employee ID is mandatory for this role.";
    }`
);

content = content.replace(
  `      nextErrors.employeeId = "Employee ID must be exactly 7 numeric digits.";
    }
    if (!formData.mobileNumber.trim()) {`,
  `      nextErrors.employeeId = "Employee ID must be exactly 7 numeric digits.";
    }
    if (
      formData.roles.some((r) => ["MRF"].includes(r)) &&
      !formData.accountName?.trim()
    ) {
      nextErrors.accountName = "System Username is required for MRF staff.";
    }
    if (!formData.mobileNumber.trim()) {`
);

// 4. validateProfileForm
content = content.replace(
  `    if (
      (profileFormData.role === "SYSTEM_ADMIN" ||
        profileFormData.role === "HEAD_REGISTRAR" ||
        profileFormData.role === "MRF") &&
      !profileFormData.employeeId.trim()
    ) {
      nextErrors.employeeId = "Employee ID is mandatory for this role.";
    }`,
  `    if (
      (profileFormData.roles.some((r) => ["SYSTEM_ADMIN", "HEAD_REGISTRAR"].includes(r))) &&
      !profileFormData.employeeId.trim()
    ) {
      nextErrors.employeeId = "Employee ID is mandatory for this role.";
    }`
);

content = content.replace(
  `      nextErrors.employeeId = "Employee ID must be exactly 7 numeric digits.";
    }
    if (
      profileFormData.mobileNumber.trim() &&`,
  `      nextErrors.employeeId = "Employee ID must be exactly 7 numeric digits.";
    }
    if (
      profileFormData.roles.some((r) => ["MRF"].includes(r)) &&
      !profileFormData.accountName?.trim()
    ) {
      nextErrors.accountName = "System Username is required for MRF staff.";
    }
    if (
      profileFormData.mobileNumber.trim() &&`
);

// 5. handleCreate and handleProfileSave payloads
content = content.replace(
  `        role: formData.roles?.[0],
        mustChangePassword: formData.mustChangePassword,
        department: formData.department || null,
      };`,
  `        roles: formData.roles,
        mustChangePassword: formData.mustChangePassword,
        department: formData.department || null,
        accountName: formData.accountName?.trim() || null,
      };`
);
content = content.replace(
  `        role: formData.role,
        mustChangePassword: formData.mustChangePassword,
        department: formData.department || null,
      };`,
  `        roles: formData.roles,
        mustChangePassword: formData.mustChangePassword,
        department: formData.department || null,
        accountName: formData.accountName?.trim() || null,
      };`
);

content = content.replace(
  `      role: user.role,
      department: "",
    });
    setProfileOpen(true);`,
  `      roles: user.roles,
      department: "",
      accountName: user.accountName || "",
    });
    setProfileOpen(true);`
);

// 6. Fix user.role usages
content = content.replace(/user\?\.role === "([^"]+)"/g, 'user?.roles?.includes("$1")');
content = content.replace(/user\.role === "([^"]+)"/g, 'user.roles?.includes("$1")');
content = content.replace(/user\.role !== "([^"]+)"/g, '!user.roles?.includes("$1")');
content = content.replace(/formatUserRole\(user\?\.role\)/g, 'formatUserRole(user?.roles?.[0])');
content = content.replace(/getRoleColorClasses\(user\?\.role\)/g, 'getRoleColorClasses(user?.roles?.[0])');
content = content.replace(/res\.data\.user\?\.role === "([^"]+)"/g, 'res.data.user?.roles?.includes("$1")');
content = content.replace(/payload\.user\.role === "([^"]+)"/g, 'payload.user.roles?.includes("$1")');
content = content.replace(/state\.user\?\.role/g, 'state.user?.roles');

// 7. params.role
content = content.replace(/params\.role = /g, 'params.roles = [');
content = content.replace(/params\.role = "([^"]+)"/g, 'params.roles = ["$1"]');
content = content.replace(/params\.role = roleFilter;/g, 'params.roles = [roleFilter];');

fs.writeFileSync('client/src/features/admin/pages/Users.tsx', content);
console.log('Fixed Users.tsx perfectly');
