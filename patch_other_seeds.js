const fs = require('fs');
const file1 = 'c:/Users/Administrator/Documents/EnrollPro/server/prisma/seeds/ancillary-roles-seed.ts';
const file2 = 'c:/Users/Administrator/Documents/EnrollPro/server/prisma/seeds/task-01-users-seed.ts';

function patchAncillary() {
    let lines = fs.readFileSync(file1, 'utf8').split('\n');
    let patched = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('await prisma.teacher.upsert({') && lines[i-1] && !lines[i-1].includes('randomPhotoNum')) {
            lines.splice(i, 0, 
`    const randomPhotoNum = Math.floor(Math.random() * 100);
    const teacherPhoto = t.sex === 'MALE' ? \`https://randomuser.me/api/portraits/men/\${randomPhotoNum}.jpg\` : \`https://randomuser.me/api/portraits/women/\${randomPhotoNum}.jpg\`;`);
            i += 2;
        }
        if (lines[i].includes('employeeId: t.employeeId,') && lines[i-1].includes('create: {')) {
            lines.splice(i, 0, '        photoPath: teacherPhoto,');
            i++;
        }
        if (lines[i].includes('middleName: t.middleName,') && lines[i-1].includes('update: {')) {
            lines.splice(i, 0, '        photoPath: teacherPhoto,');
            i++;
            patched = true;
        }
    }
    fs.writeFileSync(file1, lines.join('\n'));
    console.log('patched ancillary:', patched);
}

function patchUsers() {
    let lines = fs.readFileSync(file2, 'utf8').split('\n');
    let patched = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('const teacher = await prisma.teacher.upsert({') && lines[i-1] && !lines[i-1].includes('randomPhotoNum')) {
            lines.splice(i, 0, 
`      const randomPhotoNum = Math.floor(Math.random() * 100);
      const teacherPhoto = userData.sex === 'MALE' ? \`https://randomuser.me/api/portraits/men/\${randomPhotoNum}.jpg\` : \`https://randomuser.me/api/portraits/women/\${randomPhotoNum}.jpg\`;`);
            i += 2;
        }
        if (lines[i].includes('employeeId: userData.employeeId,') && lines[i-1].includes('create: {')) {
            lines.splice(i, 0, '          photoPath: teacherPhoto,');
            i++;
        }
        if (lines[i].includes('departments: {') && lines[i-1].includes('update: {')) {
            lines.splice(i, 0, '          photoPath: teacherPhoto,');
            i++;
            patched = true;
        }
    }
    fs.writeFileSync(file2, lines.join('\n'));
    console.log('patched users:', patched);
}

patchAncillary();
patchUsers();
