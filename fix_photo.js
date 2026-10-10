const fs = require('fs');
const file = 'c:/Users/Administrator/Documents/EnrollPro/server/prisma/seeds/task-01-seed.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /const majorSpecialization = departmentName;\\n\\n      const randomPhotoNum = i % 100;\\n      const teacherPhoto = prismaSex === Sex\.MALE \\n        \? \\https:\/\/randomuser\.me\/api\/portraits\/men\/\\.jpg\\ \\n        : \\https:\/\/randomuser\.me\/api\/portraits\/women\/\\.jpg\\;/;

content = content.replace(regex, `const majorSpecialization = departmentName;
      
      const randomPhotoNum = i % 100;
      const teacherPhoto = prismaSex === Sex.MALE 
        ? \`https://randomuser.me/api/portraits/men/\${randomPhotoNum}.jpg\` 
        : \`https://randomuser.me/api/portraits/women/\${randomPhotoNum}.jpg\`;`);

fs.writeFileSync(file, content);
console.log('done');
