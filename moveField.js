const fs = require('fs');
const file = 'c:/Users/Administrator/Documents/EnrollPro/client/src/features/teachers/components/TeacherDetailPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Change the grid container from sm:grid-cols-2 to dynamic cols
content = content.replace(
  '<div className="grid gap-4 sm:grid-cols-2">',
  '<div className={cn("grid gap-4", isTemporaryPersonnel ? "sm:grid-cols-3" : "sm:grid-cols-2")}>'
);

// 2. Remove the old accessExpirationDate block
const blockToRemoveRegex = /\{isTemporaryPersonnel && \(\s*<div className="space-y-1\.5 pt-2">\s*<Label className="text-base font-bold uppercase text-foreground">\s*Contract End Date \/ Access Expiration <span className="text-destructive">\*<\/span>\s*<\/Label>\s*<Controller\s*name="accessExpirationDate"\s*control=\{control\}\s*render=\{\(\{ field \}\) => \(\s*<HybridDatePicker\s*disabled=\{!isEditing\}\s*value=\{field\.value \|\| ""\}\s*onChange=\{field\.onChange\}\s*minDate=\{new Date\(\)\}\s*className=\{cn\(\s*"h-11 font-bold text-base leading-tight",\s*errors\.accessExpirationDate && "border-destructive focus-visible:ring-destructive",\s*\)\}\s*\/>\s*\)\}\s*\/>\s*<p className="text-sm text-foreground">\s*Portal access will automatically be blocked at midnight on this date\.\s*<\/p>\s*<AnimatedError error=\{errors\.accessExpirationDate\?\.message as string\} \/>\s*<\/div>\s*\)\}\s*/;
content = content.replace(blockToRemoveRegex, '');

// 3. Insert it between Nature of Appointment and Fund Source
const insertPoint = '<div className="space-y-1.5">\n                                  <Label className="text-base font-bold uppercase text-foreground">Fund Source <span className="text-destructive">*</span></Label>';

const newBlock = `{isTemporaryPersonnel && (
                                  <div className="space-y-1.5">
                                    <Label className="text-base font-bold uppercase text-foreground">
                                      Contract End Date <span className="text-destructive">*</span>
                                    </Label>
                                    <Controller
                                      name="accessExpirationDate"
                                      control={control}
                                      render={({ field }) => (
                                        <HybridDatePicker
                                          disabled={!isEditing}
                                          value={field.value || ""}
                                          onChange={field.onChange}
                                          minDate={new Date()}
                                          className={cn(
                                            "h-10 font-bold text-base leading-tight",
                                            errors.accessExpirationDate && "border-destructive focus-visible:ring-destructive",
                                          )}
                                        />
                                      )}
                                    />
                                    <AnimatedError error={errors.accessExpirationDate?.message as string} />
                                  </div>
                                )}
                                ` + insertPoint;

content = content.replace(insertPoint, newBlock);

fs.writeFileSync(file, content);
console.log('done');
