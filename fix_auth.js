const fs = require('fs');
const file = 'c:/Users/Administrator/Documents/EnrollPro/client/src/store/auth.slice.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'ancillaryRoles: string[];\\n  photoPath?: string | null;',
  'ancillaryRoles: string[];\n  photoPath?: string | null;'
);

fs.writeFileSync(file, content);
console.log('fixed auth.slice.ts');
