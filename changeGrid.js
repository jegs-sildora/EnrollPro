const fs = require('fs');
const file = 'c:/Users/Administrator/Documents/EnrollPro/client/src/features/teachers/components/TeacherDetailPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'className={cn("grid gap-4", isTemporaryPersonnel ? "sm:grid-cols-3" : "sm:grid-cols-2")}',
  'className="grid gap-4 sm:grid-cols-3"'
);

fs.writeFileSync(file, content);
console.log('done');
