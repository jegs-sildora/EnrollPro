const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'client', 'src', 'features', 'admin', 'components', 'UserAccountFormSheet.tsx');
let code = fs.readFileSync(filePath, 'utf-8');

// Fix the fragment wrapper
code = code.replace(
  /\{\/\* 2\. Personal Information Section \*\/\}\n\s*\{mode === "create" && \(\n\s*<div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mb-4">/,
  `{/* 2. Personal Information Section */}
              {mode === "create" && (
                <>
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mb-4">`
);

code = code.replace(
  /\n\s*\)\}\n\n\s*\{\/\* Security Management Section \(Edit Mode\) \*\/\}/,
  `
                </>
              )}

              {/* Security Management Section (Edit Mode) */}`
);

fs.writeFileSync(filePath, code);
console.log("Fixed UserAccountFormSheet.tsx fragment");
