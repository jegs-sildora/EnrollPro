const fs = require('fs');

const file = 'c:/Users/Administrator/Documents/EnrollPro/client/src/features/teachers/components/TeacherDetailPanel.tsx';
let content = fs.readFileSync(file, 'utf8');
let lines = content.split(/\r?\n/);

function replaceLines(start, end, newLinesStr) {
  // start and end are 1-indexed inclusive
  const newLines = newLinesStr.split('\n');
  lines.splice(start - 1, end - start + 1, ...newLines);
}

// 1. Postgrad UI (1621-1650)
replaceLines(1621, 1650, `                                        <Controller
                                          name={\`postgraduateDegrees.\${index}.major\`}
                                          control={control}
                                          render={({ field }) => (
                                            <MultiSearchableCombobox
                                              items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}
                                              value={field.value ? [field.value] : []}
                                              onChange={(val) => field.onChange(val[0] || "")}
                                              disabled={!isEditing || !watch(\`postgraduateDegrees.\${index}.degree\`)}
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
                                                  {...field}
                                                  value={field.value ?? ""}
                                                  disabled={!isEditing || !watch(\`postgraduateDegrees.\${index}.degree\`)}
                                                  onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                                                  placeholder="SPECIFY MAJOR"
                                                  className={cn("h-10 bg-background text-base font-bold uppercase", errors.postgraduateDegrees?.[index]?.majorCustom && "border-destructive")}
                                                />
                                              )}
                                            />
                                            <AnimatedError error={errors.postgraduateDegrees?.[index]?.majorCustom?.message as string} />
                                          </div>
                                        )}
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-sm font-bold uppercase text-foreground">Minor <span className="text-foreground/60">(optional)</span></Label>
                                        <Controller
                                          name={\`postgraduateDegrees.\${index}.minor\`}
                                          control={control}
                                          render={({ field }) => (
                                            <MultiSearchableCombobox
                                              items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}
                                              value={field.value ? [field.value] : []}
                                              onChange={(val) => field.onChange(val[0] || "")}
                                              disabled={!isEditing || !watch(\`postgraduateDegrees.\${index}.degree\`)}
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
                                                  {...field}
                                                  value={field.value ?? ""}
                                                  disabled={!isEditing || !watch(\`postgraduateDegrees.\${index}.degree\`)}
                                                  onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                                                  placeholder="SPECIFY MINOR"
                                                  className={cn("h-10 bg-background text-base font-bold uppercase", errors.postgraduateDegrees?.[index]?.minorCustom && "border-destructive")}
                                                />
                                              )}
                                            />
                                            <AnimatedError error={errors.postgraduateDegrees?.[index]?.minorCustom?.message as string} />
                                          </div>
                                        )}`);

// 2. Bachelor UI (1558-1593)
replaceLines(1558, 1593, `                                    <Controller
                                      name="bachelorMajor"
                                      control={control}
                                      render={({ field }) => (
                                        <MultiSearchableCombobox
                                          items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}
                                          value={field.value ? [field.value] : []}
                                          onChange={(val) => field.onChange(val[0] || "")}
                                          disabled={!isEditing || !watch("undergraduateDegree")}
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
                                              {...field}
                                              value={field.value ?? ""}
                                              disabled={!isEditing || !watch("undergraduateDegree")}
                                              onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                                              placeholder="SPECIFY MAJOR"
                                              className={cn(
                                                "h-10 bg-background text-base font-bold uppercase",
                                                errors.bachelorMajorCustom && "border-destructive focus-visible:ring-destructive"
                                              )}
                                            />
                                          )}
                                        />
                                        <AnimatedError error={errors.bachelorMajorCustom?.message as string} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-sm font-bold uppercase text-foreground">Minor <span className="text-foreground/60">(optional)</span></Label>
                                    <Controller
                                      name="bachelorMinor"
                                      control={control}
                                      render={({ field }) => (
                                        <MultiSearchableCombobox
                                          items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}
                                          value={field.value ? [field.value] : []}
                                          onChange={(val) => field.onChange(val[0] || "")}
                                          disabled={!isEditing || !watch("undergraduateDegree")}
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
                                              {...field}
                                              value={field.value ?? ""}
                                              disabled={!isEditing || !watch("undergraduateDegree")}
                                              onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                                              placeholder="SPECIFY MINOR"
                                              className={cn(
                                                "h-10 bg-background text-base font-bold uppercase",
                                                errors.bachelorMinorCustom && "border-destructive focus-visible:ring-destructive"
                                              )}
                                            />
                                          )}
                                        />
                                        <AnimatedError error={errors.bachelorMinorCustom?.message as string} />
                                      </div>
                                    )}
                                  </div>`);

// 3. submit payload (628-633)
replaceLines(628, 633, `        bachelorMajor: (data.bachelorMajor === "OTHER" ? data.bachelorMajorCustom?.trim() : data.bachelorMajor?.trim()) || null,
        bachelorMinor: (data.bachelorMinor === "OTHER" ? data.bachelorMinorCustom?.trim() : data.bachelorMinor?.trim()) || null,
        postgraduateDegrees,
        postgraduateDegree: primaryPostgraduateDegree?.degree || "",
        majorSpecialization: (primaryPostgraduateDegree?.major === "OTHER" ? primaryPostgraduateDegree?.majorCustom?.trim() : primaryPostgraduateDegree?.major?.trim()) || "",
        minorSpecialization: (primaryPostgraduateDegree?.minor === "OTHER" ? primaryPostgraduateDegree?.minorCustom?.trim() : primaryPostgraduateDegree?.minor?.trim()) || "",`);

// 4. onSubmit postgrad map (606-612)
replaceLines(606, 612, `      const postgraduateDegrees = data.postgraduateDegrees
        .filter((entry) => entry.degree.trim().length > 0)
        .map((entry) => ({
          degree: entry.degree,
          major: (entry.major === "OTHER" ? entry.majorCustom?.trim() : entry.major?.trim()) || null,
          minor: (entry.minor === "OTHER" ? entry.minorCustom?.trim() : entry.minor?.trim()) || null,
        }));`);

// 5. else reset (513-515)
replaceLines(513, 515, `        bachelorMajor: "",
        bachelorMajorCustom: "",
        bachelorMinor: "",
        bachelorMinorCustom: "",
        postgraduateDegrees: [{ degree: "", major: "", majorCustom: "", minor: "", minorCustom: "" }],`);

// 6. reset init (469-481)
replaceLines(469, 481, `        bachelorMajor: (() => {
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
            degree: entry.degree === "NONE" ? "" : entry.degree,
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
          }],`);

// 7. defaultValues (389-391)
replaceLines(389, 391, `      bachelorMajor: "",
      bachelorMajorCustom: "",
      bachelorMinor: "",
      bachelorMinorCustom: "",
      postgraduateDegrees: [{ degree: "", major: "", majorCustom: "", minor: "", minorCustom: "" }],`);

// 8. bachelor validation (228-234)
replaceLines(228, 234, `    if (data.undergraduateDegree) {
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
    });`);

// 9. schemas (139-144)
replaceLines(139, 144, `    bachelorMajor: z.string().optional().nullable(),
    bachelorMajorCustom: z.string().optional().nullable(),
    bachelorMinor: z.string().optional().nullable(),
    bachelorMinorCustom: z.string().optional().nullable(),
    postgraduateDegrees: z.array(z.object({
      degree: z.enum(TEACHER_POSTGRADUATE_DEGREE_VALUES as unknown as [string, ...string[]], { message: "Invalid option: expected a valid postgraduate degree." }),
      major: z.string().optional().nullable(),
      majorCustom: z.string().optional().nullable(),
      minor: z.string().optional().nullable(),
      minorCustom: z.string().optional().nullable(),`);

fs.writeFileSync(file, lines.join('\n'));
console.log('Success');
