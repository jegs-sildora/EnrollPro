const fs = require('fs');

const file = 'c:/Users/Administrator/Documents/EnrollPro/client/src/features/teachers/components/TeacherDetailPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

// We need to replace all instances of MultiSearchableCombobox with SearchableCombobox
// Specifically those that use DEPED_TEACHER_SPECIALIZATION_OPTIONS.

// Find and replace bachelorMajor
content = content.replace(
  /<MultiSearchableCombobox\s+items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}\s+value={field\.value \? \[field\.value\] : \[\]}\s+onChange={\(val\) => field\.onChange\(val\[0\] \|\| ""\)}\s+disabled={!isEditing \|\| !watch\("undergraduateDegree"\)}\s+placeholder="SELECT MAJOR"\s+searchPlaceholder="SEARCH MAJORS\.\.\."\s+maxSelected={1}\s+error={!!errors\.bachelorMajor}\s+\/>/g,
  `<SearchableCombobox
                                          items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}
                                          value={field.value ?? ""}
                                          onChange={field.onChange}
                                          disabled={!isEditing || !watch("undergraduateDegree")}
                                          placeholder="SELECT MAJOR"
                                          searchPlaceholder="SEARCH MAJORS..."
                                          className={cn("h-10 w-full bg-background text-base font-bold leading-tight uppercase text-foreground border-border", errors.bachelorMajor && "border-destructive focus-visible:ring-destructive")}
                                        />`
);

// Find and replace bachelorMinor
content = content.replace(
  /<MultiSearchableCombobox\s+items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}\s+value={field\.value \? \[field\.value\] : \[\]}\s+onChange={\(val\) => field\.onChange\(val\[0\] \|\| ""\)}\s+disabled={!isEditing \|\| !watch\("undergraduateDegree"\)}\s+placeholder="SELECT MINOR"\s+searchPlaceholder="SEARCH MINORS\.\.\."\s+maxSelected={1}\s+error={!!errors\.bachelorMinor}\s+\/>/g,
  `<SearchableCombobox
                                          items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}
                                          value={field.value ?? ""}
                                          onChange={field.onChange}
                                          disabled={!isEditing || !watch("undergraduateDegree")}
                                          placeholder="SELECT MINOR"
                                          searchPlaceholder="SEARCH MINORS..."
                                          className={cn("h-10 w-full bg-background text-base font-bold leading-tight uppercase text-foreground border-border", errors.bachelorMinor && "border-destructive focus-visible:ring-destructive")}
                                        />`
);

// Find and replace postgrad major
content = content.replace(
  /<MultiSearchableCombobox\s+items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}\s+value={field\.value \? \[field\.value\] : \[\]}\s+onChange={\(val\) => field\.onChange\(val\[0\] \|\| ""\)}\s+disabled={!isEditing \|\| !watch\(`postgraduateDegrees\.\${index}\.degree`\)}\s+placeholder="SELECT MAJOR"\s+searchPlaceholder="SEARCH MAJORS\.\.\."\s+maxSelected={1}\s+error={!!errors\.postgraduateDegrees\?\.\[index\]\?\.major}\s+\/>/g,
  `<SearchableCombobox
                                              items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}
                                              value={field.value ?? ""}
                                              onChange={field.onChange}
                                              disabled={!isEditing || !watch(\`postgraduateDegrees.\${index}.degree\`)}
                                              placeholder="SELECT MAJOR"
                                              searchPlaceholder="SEARCH MAJORS..."
                                              className={cn("h-10 w-full bg-background text-base font-bold uppercase leading-tight text-foreground border-border", errors.postgraduateDegrees?.[index]?.major && "border-destructive focus-visible:ring-destructive")}
                                            />`
);

// Find and replace postgrad minor
content = content.replace(
  /<MultiSearchableCombobox\s+items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}\s+value={field\.value \? \[field\.value\] : \[\]}\s+onChange={\(val\) => field\.onChange\(val\[0\] \|\| ""\)}\s+disabled={!isEditing \|\| !watch\(`postgraduateDegrees\.\${index}\.degree`\)}\s+placeholder="SELECT MINOR"\s+searchPlaceholder="SEARCH MINORS\.\.\."\s+maxSelected={1}\s+error={!!errors\.postgraduateDegrees\?\.\[index\]\?\.minor}\s+\/>/g,
  `<SearchableCombobox
                                              items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}
                                              value={field.value ?? ""}
                                              onChange={field.onChange}
                                              disabled={!isEditing || !watch(\`postgraduateDegrees.\${index}.degree\`)}
                                              placeholder="SELECT MINOR"
                                              searchPlaceholder="SEARCH MINORS..."
                                              className={cn("h-10 w-full bg-background text-base font-bold uppercase leading-tight text-foreground border-border", errors.postgraduateDegrees?.[index]?.minor && "border-destructive focus-visible:ring-destructive")}
                                            />`
);

fs.writeFileSync(file, content);
console.log('Success');
