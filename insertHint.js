const fs = require('fs');
const file = 'c:/Users/Administrator/Documents/EnrollPro/client/src/features/teachers/components/TeacherDetailPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

const insertPoint = `                          <div className="space-y-2 pt-2">
                            <Label className="text-base font-bold uppercase text-foreground">
                              {isAdding ? "Default Password" : "Password Control"}`;

const newBlock = `                          {isTemporaryPersonnel && watch("accessExpirationDate") && (
                            <div className="space-y-1.5 pt-2 pb-4">
                              <p className="text-sm font-bold text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 uppercase flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                                PORTAL ACCESS WILL AUTOMATICALLY BE DISABLED ON {new Date(watch("accessExpirationDate") as string).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} BASED ON THE CONTRACT END DATE.
                              </p>
                            </div>
                          )}
` + insertPoint;

content = content.replace(insertPoint, newBlock);
fs.writeFileSync(file, content);
console.log('done');
