const fs = require('fs');
const file = 'c:/Users/Administrator/Documents/EnrollPro/server/prisma/seeds/seed.ts';
let lines = fs.readFileSync(file, 'utf8').split('\n');
let patched = false;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const createdUser = await prisma.user.upsert({') && lines[i-1] && !lines[i-1].includes('randomPhotoNum')) {
        lines.splice(i, 0, 
`    const randomPhotoNum = Math.floor(Math.random() * 100);
    const teacherPhoto = u.sex === 'MALE' ? \`https://randomuser.me/api/portraits/men/\${randomPhotoNum}.jpg\` : \`https://randomuser.me/api/portraits/women/\${randomPhotoNum}.jpg\`;`);
        i += 2;
    }
    
    // We only want to add photoPath to prisma.teacher.upsert, NOT prisma.user.upsert
    // Let's track if we're inside teacher.upsert
    if (lines[i].includes('await prisma.teacher.upsert({')) {
        // Find the `update: {` block inside teacher.upsert
        let foundUpdate = false;
        let foundCreate = false;
        for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].includes('update: {') && !foundUpdate) {
                lines.splice(j + 1, 0, '        photoPath: teacherPhoto,');
                foundUpdate = true;
                j++;
            }
            if (lines[j].includes('create: {') && !foundCreate) {
                lines.splice(j + 1, 0, '        photoPath: teacherPhoto,');
                foundCreate = true;
                j++;
                patched = true;
                break; // Break after create is found and patched
            }
        }
        i += 2;
    }
}
fs.writeFileSync(file, lines.join('\n'));
console.log('patched seed.ts:', patched);
