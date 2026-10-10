const fs = require('fs');
const file = 'c:/Users/Administrator/Documents/EnrollPro/client/src/features/sections/pages/ViewMasterlist.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('getGradeLevelButtonStyles')) {
  content = content.replace(
    'import { PageTransition } from "@/shared/components/PageTransition";',
    'import { PageTransition } from "@/shared/components/PageTransition";\nimport { cn, getGradeLevelButtonStyles } from "@/shared/lib/utils";'
  );
  
  // Replace Profile button class
  content = content.replace(
    /className="font-bold uppercase text-primary border-primary hover:bg-primary hover:text-primary-foreground transition-all"/g,
    'className={cn("font-bold uppercase transition-all", getGradeLevelButtonStyles(section?.gradeLevel))}'
  );
  
  fs.writeFileSync(file, content);
  console.log('patched');
}
