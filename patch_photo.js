const fs = require('fs');
const file = 'c:/Users/Administrator/Documents/EnrollPro/server/prisma/seeds/task-01-seed.ts';
let content = fs.readFileSync(file, 'utf8');

const target1 = "const majorSpecialization = departmentName;";

const replacer1 = `const majorSpecialization = departmentName;
      const randomPhotoNum = i % 100;
      const teacherPhoto = prismaSex === Sex.MALE 
        ? \`https://randomuser.me/api/portraits/men/\${randomPhotoNum}.jpg\` 
        : \`https://randomuser.me/api/portraits/women/\${randomPhotoNum}.jpg\`;`;

const target2 = `const teacher = await prisma.teacher.create({
        data: {
          employeeId,`;

const replacer2 = `const teacher = await prisma.teacher.create({
        data: {
          photoPath: teacherPhoto,
          employeeId,`;

if (content.includes(target1) && content.includes(target2)) {
  content = content.replace(target1, replacer1).replace(target2, replacer2);
  fs.writeFileSync(file, content);
  console.log('done');
} else {
  console.log('could not find target string');
}
