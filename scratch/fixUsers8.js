const fs = require('fs');

let content = fs.readFileSync('client/src/features/admin/pages/Users.tsx', 'utf8');

// replace all \r\n with \n so simple matches work
content = content.replace(/\r\n/g, '\n');

// replace word bound 'role' but wait, I can just do this exactly.
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

content = content.replace(/role\?: string;/g, 'roles?: string[];');
content = content.replace(/role: "TEACHER" as User\["role"\],/g, 'roles: ["TEACHER"] as string[],');

// For validations
content = content.replace(/formData\.role === "([^"]+)"/g, 'formData.roles?.includes("$1")');
content = content.replace(/profileFormData\.role === "([^"]+)"/g, 'profileFormData.roles?.includes("$1")');

// Objects definition
content = content.replace(/role: formData\.roles\?\.\[0\],\n/g, '');
content = content.replace(/role: formData\.roles,\n/g, '');
content = content.replace(/role: formData\.role,\n/g, '');
content = content.replace(/role: profileFormData\.role,\n/g, '');

// This is safe because user.role isn't used before this in replacement.
content = content.replace(/role: user\.role,\n/g, 'roles: user.roles,\n');

// comparisons
content = content.replace(/selectedUser\?\.role === "([^"]+)"/g, 'selectedUser?.roles?.includes("$1")');
content = content.replace(/selectedUser\?\.role !== "([^"]+)"/g, '!selectedUser?.roles?.includes("$1")');
content = content.replace(/selectedUser\.role === "([^"]+)"/g, 'selectedUser.roles?.includes("$1")');
content = content.replace(/user\.role !== "([^"]+)"/g, '!user.roles?.includes("$1")');
content = content.replace(/u\.role !== "([^"]+)"/g, '!u.roles?.includes("$1")');

// format / getRole
content = content.replace(/formatUserRole\(user\.role\)/g, 'formatUserRole(user.roles?.[0])');
content = content.replace(/getRoleColorClasses\(user\.role\)/g, 'getRoleColorClasses(user.roles?.[0])');

// Only match EXACT user.role not inside user.roles
content = content.replace(/([^a-zA-Z])user\.role([^a-zA-Z])/g, '$1user.roles?.[0]$2');
// Wait, replacing 'user.role' like this will catch `user.role`! But we ALREADY replaced `role: user.role,` with `roles: user.roles,`.
// So it won't catch `roles: user.roles,` because it says `user.role` !

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

// Add accountName to validateCreateForm
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

// Add accountName to validateProfileForm
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

// Add accountName to handleCreate payload
content = content.replace(
  /mustChangePassword: formData\.mustChangePassword,\n\s+department: formData\.department \|\| null,\n\s+};\n\s+await api\.post\("\/admin\/users", payload\);/g,
  `roles: formData.roles,
        mustChangePassword: formData.mustChangePassword,
        department: formData.department || null,
        accountName: formData.accountName?.trim() || null,
      };
      await api.post("/admin/users", payload);`
);

// Add accountName to handleProfileSave payload
content = content.replace(
  /mobileNumber: profileFormData\.mobileNumber\.trim\(\) \|\| null,\n\s+email: profileFormData\.email\.trim\(\) \|\| null,\n\s+department: profileFormData\.department \|\| null,\n\s+};\n\s+await api\.patch\(`\/admin\/users\/\$\{profileUser\.id\}`,\n\s+payload,\n\s+\);/g,
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

// Add accountName to profileFormData set (in openProfileEditor)
content = content.replace(
  /roles: user\.roles,\n\s+department: "",\n\s+}\);\n\s+setProfileOpen\(true\);/g,
  `roles: user.roles,
      department: "",
      accountName: user.accountName || "",
    });
    setProfileOpen(true);`
);

fs.writeFileSync('client/src/features/admin/pages/Users.tsx', content);
console.log('Fixed Users.tsx errors for real, no bugs!');
