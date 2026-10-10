const fs = require('fs');
const file = 'c:/Users/Administrator/Documents/EnrollPro/server/prisma/seeds/task-01-seed.ts';
let lines = fs.readFileSync(file, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('photoPath: teacherPhoto,')) {
        lines.splice(i, 1);
        i--;
    }
}

let targetIndex = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const teacher = await prisma.teacher.create({')) {
        targetIndex = i + 2; // the line after `data: {`
        break;
    }
}

if (targetIndex !== -1) {
    lines.splice(targetIndex, 0, '          photoPath: teacherPhoto,');
    fs.writeFileSync(file, lines.join('\n'));
    console.log('Done');
} else {
    console.log('Not found');
}
