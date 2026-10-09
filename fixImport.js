const fs = require('fs');
const file = 'c:/Users/Administrator/Documents/EnrollPro/client/src/features/teachers/components/TeacherDetailPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

// Use regex to remove duplicate import
const pattern = /import { MultiSearchableCombobox } from "@\/shared\/ui\/multi-searchable-combobox";(\r?\n)import { MultiSearchableCombobox } from "@\/shared\/ui\/multi-searchable-combobox";/g;
content = content.replace(pattern, 'import { MultiSearchableCombobox } from "@/shared/ui/multi-searchable-combobox";');

fs.writeFileSync(file, content);
console.log('Fixed');
