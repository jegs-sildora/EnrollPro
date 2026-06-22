import re
from pathlib import Path

QUEUE_TABLE = r'c:\Users\localhost\Documents\Enrollpro\client\src\features\bosy\components\QueueTable.tsx'

with open(QUEUE_TABLE, 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure we don't duplicate cn import if the previous script ran or failed
if 'import { cn }' not in content:
    content = content.replace('import { formatApplicationStatus, formatEosyStatus } from "@/shared/lib/utils";', 
                              'import { formatApplicationStatus, formatEosyStatus, cn } from "@/shared/lib/utils";')

# Column 1
content = content.replace('title="LEARNER"', 'title="LRN & LEARNER\'S NAME"')

# Column 2
content = content.replace('title="GRADE"', 'title="TARGET GRADE"')

# Column 3
content = content.replace('title="PREVIOUS SECTION / ADVISER"', 'title="PRIOR SECTION (S.Y. 25-26)"')

# Column 4 Header
content = content.replace('title="PRIOR STATUS"', 'title="LAST YEAR\'S RESULT"')

# Column 4 Cell (use re to safely replace the old academicStatus cell)
cell_pattern = r'const s = row\.original\.academicStatus;\s*if \(\!s\)\s*return \(\s*<div className="text-center text-foreground text-base">—</div>\s*\);\s*return \(\s*<div className="text-center">\s*<span\s*className=\{`text-\[10px\] font-black uppercase \$\{\s*s === "PROMOTED" \? "text-emerald-600" : "text-amber-600"\s*\}`\}>\s*\{formatEosyStatus\(s\)\}\s*</span>\s*</div>\s*\);'

new_cell = '''const s = row.original.academicStatus;
          if (!s)
            return (
              <div className="text-center text-foreground text-base">—</div>
            );
          return (
            <div className="text-center">
              <Badge
                variant="outline"
                className={cn("text-[10px] font-black uppercase", s === "PROMOTED" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700")}
              >
                {s === "PROMOTED" ? "[Promoted]" : "[Retained]"}
              </Badge>
            </div>
          );'''
content = re.sub(cell_pattern, new_cell, content)

# Column 5 Header
content = content.replace('title="STATUS"', 'title="INTAKE STATUS"')

# Column 5 badges (update statusBadge function)
# I need to update the text inside the statusBadge function.
# Pending -> [Pending Review]
# Confirmed -> [Confirmed]
content = content.replace('>Pending<', '>[Pending Review]<')
content = content.replace('>Confirmed<', '>[Confirmed]<')

# Change Pending pill style from orange to amber
content = content.replace('bg-orange-50 border-orange-200 text-orange-700', 'bg-amber-50 border-amber-200 text-amber-700')

# Column 6 Action Button text
content = content.replace('>Confirm<', '>Confirm Roll-Over<')
# Update the icon inside the button to match the text maybe? CheckCircle2 is fine.

# Empathetic Zero-State UI for DataTable
empty_state_content = '''
      emptyStateContent={
        <div className="flex flex-col items-center justify-center h-48 space-y-3 text-muted-foreground">
          <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <p className="font-bold text-foreground">No unconfirmed returning learners match your current filter.</p>
          <p className="text-sm">Select a different 'Target Grade' above or check your search spelling.</p>
        </div>
      }
'''
if 'emptyStateContent={' not in content:
    content = content.replace('<DataTable', '<DataTable' + empty_state_content)

with open(QUEUE_TABLE, 'w', encoding='utf-8') as f:
    f.write(content)

print("QueueTable updated.")
