const fs = require('fs');

let content = fs.readFileSync('client/src/features/admin/pages/Users.tsx', 'utf8');

content = content.replace(
  /roles: \["TEACHER"\] as string\[\],\n\s+department: "",\n\s+}\);\n\n\s+const validateCreateForm/g,
  `roles: ["TEACHER"] as string[],
    department: "",
    accountName: "",
  });

  const validateCreateForm`
);

fs.writeFileSync('client/src/features/admin/pages/Users.tsx', content);
console.log('Fixed profileFormData missing accountName!');
