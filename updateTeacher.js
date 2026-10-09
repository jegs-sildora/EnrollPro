const fs = require('fs');

const file = 'c:/Users/Administrator/Documents/EnrollPro/client/src/features/teachers/components/TeacherDetailPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add imports
content = content.replace(
  'import { SearchableCombobox } from "@/shared/ui/searchable-combobox";',
  'import { SearchableCombobox } from "@/shared/ui/searchable-combobox";\nimport { MultiSearchableCombobox } from "@/shared/ui/multi-searchable-combobox";'
);

content = content.replace(
  'DEPED_TEACHER_SPECIALIZATION_VALUES,',
  'DEPED_TEACHER_SPECIALIZATION_VALUES,\n  DEPED_TEACHER_SPECIALIZATION_OPTIONS,'
);

// 2. Form Schema
content = content.replace(
  'bachelorMajor: z.string().optional().nullable(),\n      bachelorMinor: z.string().optional().nullable(),',
  'bachelorMajor: z.string().optional().nullable(),\n      bachelorMajorCustom: z.string().optional().nullable(),\n      bachelorMinor: z.string().optional().nullable(),\n      bachelorMinorCustom: z.string().optional().nullable(),'
);

content = content.replace(
  'major: z.string().optional().nullable(),\n        minor: z.string().optional().nullable(),',
  'major: z.string().optional().nullable(),\n        majorCustom: z.string().optional().nullable(),\n        minor: z.string().optional().nullable(),\n        minorCustom: z.string().optional().nullable(),'
);

// 3. SuperRefine
const oldRefine = `if (data.undergraduateDegree && (!data.bachelorMajor || data.bachelorMajor.trim().length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please specify the major or specialization.",
          path: ["bachelorMajor"],
        });
      }`;

const newRefine = `if (data.undergraduateDegree) {
        if (!data.bachelorMajor || data.bachelorMajor.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please specify the major or specialization.",
            path: ["bachelorMajor"],
          });
        } else if (data.bachelorMajor === "OTHER" && (!data.bachelorMajorCustom || data.bachelorMajorCustom.trim().length === 0)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please specify your custom major.",
            path: ["bachelorMajorCustom"],
          });
        }
      }
      
      if (data.bachelorMinor === "OTHER" && (!data.bachelorMinorCustom || data.bachelorMinorCustom.trim().length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please specify your custom minor.",
          path: ["bachelorMinorCustom"],
        });
      }
      
      data.postgraduateDegrees?.forEach((pg, index) => {
        if (pg.major === "OTHER" && (!pg.majorCustom || pg.majorCustom.trim().length === 0)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please specify your custom major.",
            path: ["postgraduateDegrees", index, "majorCustom"],
          });
        }
        if (pg.minor === "OTHER" && (!pg.minorCustom || pg.minorCustom.trim().length === 0)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please specify your custom minor.",
            path: ["postgraduateDegrees", index, "minorCustom"],
          });
        }
      });`;
content = content.replace(oldRefine, newRefine);

// 4. Default Values
const oldDefaultNew = `bachelorMajor: "",
        bachelorMinor: "",
        postgraduateDegrees: [{ degree: "", major: "", minor: "" }],`;
const newDefaultNew = `bachelorMajor: "",
        bachelorMajorCustom: "",
        bachelorMinor: "",
        bachelorMinorCustom: "",
        postgraduateDegrees: [{ degree: "", major: "", majorCustom: "", minor: "", minorCustom: "" }],`;
content = content.replace(oldDefaultNew, newDefaultNew);

const oldInit = `bachelorMajor: (teacher.bachelorMajor === "NONE" ? "" : teacher.bachelorMajor) || "",
          bachelorMinor: (teacher.bachelorMinor === "NONE" ? "" : teacher.bachelorMinor) || "",
          postgraduateDegrees: teacher.postgraduateDegrees?.length
            ? teacher.postgraduateDegrees.map((entry) => ({
              degree: entry.degree || "",
              major: entry.major || "",
              minor: entry.minor || "",
            }))
            : [{
              degree: (teacher.postgraduateDegree === "NONE" ? "" : teacher.postgraduateDegree) || "",
              major: teacher.majorSpecialization || "",
              minor: teacher.minorSpecialization || "",
            }],`;
const newInit = `bachelorMajor: (() => {
            const val = (teacher.bachelorMajor === "NONE" ? "" : teacher.bachelorMajor) || "";
            return val && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(val as any) ? "OTHER" : val;
          })(),
          bachelorMajorCustom: (() => {
            const val = (teacher.bachelorMajor === "NONE" ? "" : teacher.bachelorMajor) || "";
            return val && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(val as any) ? val : "";
          })(),
          bachelorMinor: (() => {
            const val = (teacher.bachelorMinor === "NONE" ? "" : teacher.bachelorMinor) || "";
            return val && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(val as any) ? "OTHER" : val;
          })(),
          bachelorMinorCustom: (() => {
            const val = (teacher.bachelorMinor === "NONE" ? "" : teacher.bachelorMinor) || "";
            return val && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(val as any) ? val : "";
          })(),
          postgraduateDegrees: teacher.postgraduateDegrees?.length
            ? teacher.postgraduateDegrees.map((entry) => ({
              degree: entry.degree || "",
              major: entry.major && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(entry.major as any) ? "OTHER" : (entry.major || ""),
              majorCustom: entry.major && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(entry.major as any) ? entry.major : "",
              minor: entry.minor && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(entry.minor as any) ? "OTHER" : (entry.minor || ""),
              minorCustom: entry.minor && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(entry.minor as any) ? entry.minor : "",
            }))
            : [{
              degree: (teacher.postgraduateDegree === "NONE" ? "" : teacher.postgraduateDegree) || "",
              major: teacher.majorSpecialization && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(teacher.majorSpecialization as any) ? "OTHER" : (teacher.majorSpecialization || ""),
              majorCustom: teacher.majorSpecialization && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(teacher.majorSpecialization as any) ? teacher.majorSpecialization : "",
              minor: teacher.minorSpecialization && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(teacher.minorSpecialization as any) ? "OTHER" : (teacher.minorSpecialization || ""),
              minorCustom: teacher.minorSpecialization && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(teacher.minorSpecialization as any) ? teacher.minorSpecialization : "",
            }],`;
content = content.replace(oldInit, newInit);

const oldMapError = `bachelorMajor: "",
          bachelorMinor: "",
          postgraduateDegrees: [{ degree: "", major: "", minor: "" }],`;
const newMapError = `bachelorMajor: "",
          bachelorMajorCustom: "",
          bachelorMinor: "",
          bachelorMinorCustom: "",
          postgraduateDegrees: [{ degree: "", major: "", majorCustom: "", minor: "", minorCustom: "" }],`;
content = content.replace(oldMapError, newMapError);

// 5. Submit mapping
const oldOnSubmit = `bachelorMajor: data.bachelorMajor?.trim() || null,
          bachelorMinor: data.bachelorMinor?.trim() || null,
          postgraduateDegrees,`;
const newOnSubmit = `bachelorMajor: (data.bachelorMajor === "OTHER" ? data.bachelorMajorCustom?.trim() : data.bachelorMajor?.trim()) || null,
          bachelorMinor: (data.bachelorMinor === "OTHER" ? data.bachelorMinorCustom?.trim() : data.bachelorMinor?.trim()) || null,
          postgraduateDegrees: data.postgraduateDegrees?.map(pg => ({
            ...pg,
            major: (pg.major === "OTHER" ? pg.majorCustom?.trim() : pg.major?.trim()) || null,
            minor: (pg.minor === "OTHER" ? pg.minorCustom?.trim() : pg.minor?.trim()) || null
          })) || [],`;
content = content.replace(oldOnSubmit, newOnSubmit);

// 6. UI Replacements - bachelorMajor
const bachelorMajorUI = `<Controller
                                        name="bachelorMajor"
                                        control={control}
                                        render={({ field }) => (
                                          <Input
                                            placeholder="E.G. MATHEMATICS"
                                            className={cn(
                                              "h-10 bg-background text-base font-bold uppercase",
                                              errors.bachelorMajor && "border-destructive focus-visible:ring-destructive",
                                            )}
                                            {...field}
                                            value={field.value || ""}
                                          />
                                        )}
                                      />
                                      <AnimatedError error={errors.bachelorMajor?.message as string} />`;
const newBachelorMajorUI = `<Controller
                                        name="bachelorMajor"
                                        control={control}
                                        render={({ field }) => (
                                          <MultiSearchableCombobox
                                            items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}
                                            value={field.value ? [field.value] : []}
                                            onChange={(val) => field.onChange(val[0] || "")}
                                            placeholder="SELECT MAJOR"
                                            searchPlaceholder="SEARCH MAJORS..."
                                            maxSelected={1}
                                            error={!!errors.bachelorMajor}
                                          />
                                        )}
                                      />
                                      <AnimatedError error={errors.bachelorMajor?.message as string} />
                                      {watch("bachelorMajor") === "OTHER" && (
                                        <div className="mt-2">
                                          <Controller
                                            name="bachelorMajorCustom"
                                            control={control}
                                            render={({ field }) => (
                                              <Input
                                                placeholder="SPECIFY MAJOR"
                                                className={cn(
                                                  "h-10 bg-background text-base font-bold uppercase",
                                                  errors.bachelorMajorCustom && "border-destructive focus-visible:ring-destructive"
                                                )}
                                                {...field}
                                                value={field.value || ""}
                                              />
                                            )}
                                          />
                                          <AnimatedError error={errors.bachelorMajorCustom?.message as string} />
                                        </div>
                                      )}`;
content = content.replace(bachelorMajorUI, newBachelorMajorUI);

// UI Replacements - bachelorMinor
const bachelorMinorUI = `<Controller
                                        name="bachelorMinor"
                                        control={control}
                                        render={({ field }) => (
                                          <Input
                                            placeholder="E.G. ENGLISH"
                                            className={cn(
                                              "h-10 bg-background text-base font-bold uppercase",
                                              errors.bachelorMinor && "border-destructive focus-visible:ring-destructive",
                                            )}
                                            {...field}
                                            value={field.value || ""}
                                          />
                                        )}
                                      />
                                      <AnimatedError error={errors.bachelorMinor?.message as string} />`;
const newBachelorMinorUI = `<Controller
                                        name="bachelorMinor"
                                        control={control}
                                        render={({ field }) => (
                                          <MultiSearchableCombobox
                                            items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}
                                            value={field.value ? [field.value] : []}
                                            onChange={(val) => field.onChange(val[0] || "")}
                                            placeholder="SELECT MINOR"
                                            searchPlaceholder="SEARCH MINORS..."
                                            maxSelected={1}
                                            error={!!errors.bachelorMinor}
                                          />
                                        )}
                                      />
                                      <AnimatedError error={errors.bachelorMinor?.message as string} />
                                      {watch("bachelorMinor") === "OTHER" && (
                                        <div className="mt-2">
                                          <Controller
                                            name="bachelorMinorCustom"
                                            control={control}
                                            render={({ field }) => (
                                              <Input
                                                placeholder="SPECIFY MINOR"
                                                className={cn(
                                                  "h-10 bg-background text-base font-bold uppercase",
                                                  errors.bachelorMinorCustom && "border-destructive focus-visible:ring-destructive"
                                                )}
                                                {...field}
                                                value={field.value || ""}
                                              />
                                            )}
                                          />
                                          <AnimatedError error={errors.bachelorMinorCustom?.message as string} />
                                        </div>
                                      )}`;
content = content.replace(bachelorMinorUI, newBachelorMinorUI);

// UI Replacements - pg major
const pgMajorUI = `<Controller
                                            name={\`postgraduateDegrees.\${index}.major\`}
                                            control={control}
                                            render={({ field }) => (
                                              <Input
                                                placeholder="E.G. EDUCATIONAL MANAGEMENT"
                                                className={cn(
                                                  "h-10 bg-background text-base font-bold uppercase",
                                                  errors.postgraduateDegrees?.[index]?.major && "border-destructive focus-visible:ring-destructive",
                                                )}
                                                {...field}
                                                value={field.value || ""}
                                              />
                                            )}
                                          />
                                          <AnimatedError error={errors.postgraduateDegrees?.[index]?.major?.message as string} />`;
const newPgMajorUI = `<Controller
                                            name={\`postgraduateDegrees.\${index}.major\`}
                                            control={control}
                                            render={({ field }) => (
                                              <MultiSearchableCombobox
                                                items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}
                                                value={field.value ? [field.value] : []}
                                                onChange={(val) => field.onChange(val[0] || "")}
                                                placeholder="SELECT MAJOR"
                                                searchPlaceholder="SEARCH MAJORS..."
                                                maxSelected={1}
                                                error={!!errors.postgraduateDegrees?.[index]?.major}
                                              />
                                            )}
                                          />
                                          <AnimatedError error={errors.postgraduateDegrees?.[index]?.major?.message as string} />
                                          {watch(\`postgraduateDegrees.\${index}.major\`) === "OTHER" && (
                                            <div className="mt-2">
                                              <Controller
                                                name={\`postgraduateDegrees.\${index}.majorCustom\`}
                                                control={control}
                                                render={({ field }) => (
                                                  <Input
                                                    placeholder="SPECIFY MAJOR"
                                                    className={cn(
                                                      "h-10 bg-background text-base font-bold uppercase",
                                                      errors.postgraduateDegrees?.[index]?.majorCustom && "border-destructive focus-visible:ring-destructive"
                                                    )}
                                                    {...field}
                                                    value={field.value || ""}
                                                  />
                                                )}
                                              />
                                              <AnimatedError error={errors.postgraduateDegrees?.[index]?.majorCustom?.message as string} />
                                            </div>
                                          )}`;
content = content.replace(pgMajorUI, newPgMajorUI);

// UI Replacements - pg minor
const pgMinorUI = `<Controller
                                            name={\`postgraduateDegrees.\${index}.minor\`}
                                            control={control}
                                            render={({ field }) => (
                                              <Input
                                                placeholder="E.G. GUIDANCE"
                                                className={cn(
                                                  "h-10 bg-background text-base font-bold uppercase",
                                                  errors.postgraduateDegrees?.[index]?.minor && "border-destructive focus-visible:ring-destructive",
                                                )}
                                                {...field}
                                                value={field.value || ""}
                                              />
                                            )}
                                          />
                                          <AnimatedError error={errors.postgraduateDegrees?.[index]?.minor?.message as string} />`;
const newPgMinorUI = `<Controller
                                            name={\`postgraduateDegrees.\${index}.minor\`}
                                            control={control}
                                            render={({ field }) => (
                                              <MultiSearchableCombobox
                                                items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}
                                                value={field.value ? [field.value] : []}
                                                onChange={(val) => field.onChange(val[0] || "")}
                                                placeholder="SELECT MINOR"
                                                searchPlaceholder="SEARCH MINORS..."
                                                maxSelected={1}
                                                error={!!errors.postgraduateDegrees?.[index]?.minor}
                                              />
                                            )}
                                          />
                                          <AnimatedError error={errors.postgraduateDegrees?.[index]?.minor?.message as string} />
                                          {watch(\`postgraduateDegrees.\${index}.minor\`) === "OTHER" && (
                                            <div className="mt-2">
                                              <Controller
                                                name={\`postgraduateDegrees.\${index}.minorCustom\`}
                                                control={control}
                                                render={({ field }) => (
                                                  <Input
                                                    placeholder="SPECIFY MINOR"
                                                    className={cn(
                                                      "h-10 bg-background text-base font-bold uppercase",
                                                      errors.postgraduateDegrees?.[index]?.minorCustom && "border-destructive focus-visible:ring-destructive"
                                                    )}
                                                    {...field}
                                                    value={field.value || ""}
                                                  />
                                                )}
                                              />
                                              <AnimatedError error={errors.postgraduateDegrees?.[index]?.minorCustom?.message as string} />
                                            </div>
                                          )}`;
content = content.replace(pgMinorUI, newPgMinorUI);


fs.writeFileSync(file, content);
console.log('Success');
