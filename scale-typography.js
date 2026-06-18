const fs = require('fs');
const path = require('path');

const dirs = [
  'client/src/features/enrollment',
  'client/src/features/admission',
  'client/src/features/settings',
  'client/src/features/admin',
  'client/src/features/learner',
  'client/src/features/sections',
  'client/src/features/bosy',
  'client/src/features/audit-logs',
  'client/src/features/auth',
  'client/src/features/dashboard',
  'client/src/features/intake',
  'client/src/features/integration',
  'client/src/features/reading-assessment',
  'client/src/features/students',
  'client/src/features/teachers',
  'client/src/shared/components',
  'client/src/shared/layouts'
];

function processDir(dirPath) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      let originalContent = content;
      
      content = content.replace(/\btext-sm\b/g, '__TEXT_BASE__');
      content = content.replace(/\btext-xs\b/g, '__TEXT_SM__');
      
      content = content.replace(/__TEXT_BASE__/g, 'text-base');
      content = content.replace(/__TEXT_SM__/g, 'text-sm');

      // Task 1: Compensation for tracking. text-xs often had tracking-wider.
      content = content.replace(/\btracking-wider\b/g, 'tracking-wide');

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf-8');
        console.log('Updated:', fullPath);
      }
    }
  }
}

dirs.forEach(d => {
    const fullDirPath = path.join('c:/Users/localhost/Documents/Enrollpro', d);
    if (fs.existsSync(fullDirPath)) {
        processDir(fullDirPath);
    }
});
