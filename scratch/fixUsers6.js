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

// fix line 115 (FetchUsersParams interface)
content = content.replace(/role\?: string;/g, 'roles?: string[];');

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

// fix params.role in fetchUsers
content = content.replace(/params\.role = "LEARNER";/g, 'params.roles = ["LEARNER"];');
content = content.replace(/params\.role = roleFilter;/g, 'params.roles = [roleFilter];');

// Add accountName to User
content = content.replace(/employeeId: string \| null;/g, 'employeeId: string | null;\n  accountName: string | null;');

// Add accountName to initial formData
content = content.replace(
  /roles: \["TEACHER"\] as string\[\],\n\s+password: "",\n\s+mustChangePassword: true,\n\s+department: "",\n\s+}\);\n\s+const \[selectedUser, setSelectedUser\]/g,
  `roles: ["TEACHER"] as string[],
    password: "",
    mustChangePassword: true,
    department: "",
    accountName: "",
  });
  const [selectedUser, setSelectedUser]`
);

// fix validateCreateForm
content = content.replace(/formData\.role === "([^"]+)"/g, 'formData.roles?.includes("$1")');
content = content.replace(
  /nextErrors\.employeeId = "Employee ID must be exactly 7 numeric digits\.";\n\s+}\n\s+if \(!formData\.mobileNumber\.trim\(\)\) \{/g,
  `nextErrors.employeeId = "Employee ID must be exactly 7 numeric digits.";
    }
    if (
      formData.roles?.includes("MRF") &&
      !formData.accountName?.trim()
    ) {
      nextErrors.accountName = "System Username is required for MRF staff.";
    }
    if (!formData.mobileNumber.trim()) {`
);

// fix validateProfileForm
content = content.replace(/profileFormData\.role === "([^"]+)"/g, 'profileFormData.roles?.includes("$1")');
content = content.replace(
  /nextErrors\.employeeId = "Employee ID must be exactly 7 numeric digits\.";\n\s+}\n\s+if \(\n\s+profileFormData\.mobileNumber\.trim\(\)/g,
  `nextErrors.employeeId = "Employee ID must be exactly 7 numeric digits.";
    }
    if (
      profileFormData.roles?.includes("MRF") &&
      !profileFormData.accountName?.trim()
    ) {
      nextErrors.accountName = "System Username is required for MRF staff.";
    }
    if (
      profileFormData.mobileNumber.trim()`
);

// fix handleCreate
content = content.replace(/role: formData\.roles\?\.\[0\],\n/g, '');
content = content.replace(/roles: formData\.roles\?\.\[0\],\n/g, ''); // just in case
content = content.replace(
  /mustChangePassword: formData\.mustChangePassword,\n\s+department: formData\.department \|\| null,\n\s+};\n\s+await api\.post\("\/admin\/users", payload\);/g,
  `roles: formData.roles,
        mustChangePassword: formData.mustChangePassword,
        department: formData.department || null,
        accountName: formData.accountName?.trim() || null,
      };
      await api.post("/admin/users", payload);`
);

// fix handleProfileSave
content = content.replace(
  /mustChangePassword: formData\.mustChangePassword,\n\s+department: formData\.department \|\| null,\n\s+};\n\s+await api\.patch/g, // wait, handleProfileSave uses profileFormData!
  `mustChangePassword: formData.mustChangePassword,
        department: formData.department || null,
        accountName: formData.accountName?.trim() || null,
      };
      await api.patch`
);
content = content.replace(
  /mobileNumber: profileFormData\.mobileNumber\.trim\(\) \|\| null,\n\s+email: profileFormData\.email\.trim\(\) \|\| null,\n\s+role: profileFormData\.roles\?\.\[0\],\n\s+department: profileFormData\.department \|\| null,\n\s+};\n\s+await api\.patch\(`\/admin\/users\/\$\{profileUser\.id\}`,\n\s+payload,\n\s+\);/g,
  `mobileNumber: profileFormData.mobileNumber.trim() || null,
        email: profileFormData.email.trim() || null,
        roles: profileFormData.roles,
        department: profileFormData.department || null,
        accountName: profileFormData.accountName?.trim() || null,
      };
      await api.patch(\`/admin/users/\${profileUser.id}\`,
        payload,
      );`
);
content = content.replace(/role: profileFormData\.role,/g, 'roles: profileFormData.roles,\n        accountName: profileFormData.accountName?.trim() || null,'); // Fallback replacement

fs.writeFileSync('client/src/features/admin/pages/Users.tsx', content);
console.log('Fixed Users.tsx errors for real!');
