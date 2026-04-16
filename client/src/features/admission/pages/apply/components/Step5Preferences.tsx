import { useFormContext } from "react-hook-form";
import { useEffect } from "react";
import type { EnrollmentFormData } from "../types";
import {
  SPA_ART_FIELDS,
  SPS_SPORTS,
  SPFL_LANGUAGES,
  LEARNING_MODALITIES,
} from "../types";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { BookOpen } from "lucide-react";
import { cn, SCP_LABELS } from "@/shared/lib/utils";
import { motion, AnimatePresence } from "motion/react";

export default function Step5Enrollment() {
  const { register, watch, setValue, clearErrors } =
    useFormContext<EnrollmentFormData>();

  const isScpApplication = watch("isScpApplication");
  const scpType = watch("scpType");
  const learnerType = watch("learnerType");
  const hasNoLrn = watch("hasNoLrn");

  useEffect(() => {
    const canDeclareNoLrn =
      learnerType === "TRANSFEREE" || learnerType === "NEW_ENROLLEE";
    if (!canDeclareNoLrn && hasNoLrn) {
      setValue("hasNoLrn", false, { shouldValidate: true, shouldDirty: true });
      clearErrors("hasNoLrn");
    }
  }, [learnerType, hasNoLrn, setValue, clearErrors]);

  return (
    <div className="space-y-12">
      {/* Grade Level */}
      <div className="space-y-6">
        <Label className="text-sm font-bold uppercase tracking-widest text-primary">
          Grade Level to Apply for *
        </Label>
        <Input
          value="Grade 7 (JHS)"
          disabled
          className="bg-muted font-semibold"
        />
        <input type="hidden" {...register("gradeLevel")} value="7" />
      </div>

      {/* SCP Section */}
      <div>
        <div className="space-y-8 pb-8">
          <div className="p-6 border bg-primary/5 border-primary/20 rounded-2xl space-y-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <Label className="text-base font-bold text-primary">
                Application Type *
              </Label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                className={cn(
                  "flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer text-left",
                  !isScpApplication
                    ? "border-primary bg-primary text-primary-foreground pointer-events-none"
                    : "border-border bg-white hover:bg-primary/5",
                )}
                onClick={() => {
                  setValue("isScpApplication", false);
                  setValue("scpType", undefined);
                }}>
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                      !isScpApplication
                        ? "border-white"
                        : "border-muted-foreground",
                    )}>
                    {!isScpApplication && (
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="font-bold">Regular Section</span>
                </div>
                <p
                  className={cn(
                    "text-[0.6875rem] pl-8",
                    !isScpApplication
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground",
                  )}>
                  Open BASIC EDUCATION ENROLLMENT FORM • no entrance exam
                  required.
                </p>
              </button>

              <button
                type="button"
                className={cn(
                  "flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer text-left",
                  isScpApplication
                    ? "border-primary bg-primary text-primary-foreground pointer-events-none"
                    : "border-border bg-white hover:bg-primary/5",
                )}
                onClick={() => setValue("isScpApplication", true)}>
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                      isScpApplication
                        ? "border-white"
                        : "border-muted-foreground",
                    )}>
                    {isScpApplication && (
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="font-bold">
                    Special Curricular Program (SCP)
                  </span>
                </div>
                <p
                  className={cn(
                    "text-[0.6875rem] pl-8",
                    isScpApplication
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground",
                  )}>
                  Requires qualifying assessment or audition.
                </p>
              </button>
            </div>

            <AnimatePresence>
              {isScpApplication && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <div className="pt-6 space-y-6">
                    <Label className="text-sm font-bold uppercase tracking-widest text-primary">
                      Select SCP Program *
                    </Label>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        {
                          id: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
                          label: SCP_LABELS.SCIENCE_TECHNOLOGY_AND_ENGINEERING,
                          desc: "Written entrance exam + Interview.",
                        },
                        {
                          id: "SPECIAL_PROGRAM_IN_THE_ARTS",
                          label: SCP_LABELS.SPECIAL_PROGRAM_IN_THE_ARTS,
                          desc: "Written exam + Audition + Interview.",
                        },
                        {
                          id: "SPECIAL_PROGRAM_IN_SPORTS",
                          label: SCP_LABELS.SPECIAL_PROGRAM_IN_SPORTS,
                          desc: "Physical tryout • Sports background required.",
                        },
                        {
                          id: "SPECIAL_PROGRAM_IN_JOURNALISM",
                          label: SCP_LABELS.SPECIAL_PROGRAM_IN_JOURNALISM,
                          desc: "Written exam (SPJQE) + Interview.",
                        },
                        {
                          id: "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
                          label: SCP_LABELS.SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE,
                          desc: "Based on NAT English score.",
                        },
                        {
                          id: "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
                          label:
                            SCP_LABELS.SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION,
                          desc: "Aptitude assessment.",
                        },
                      ].map((p) => (
                        <div key={p.id} className="space-y-0">
                          <button
                            type="button"
                            className={cn(
                              "w-full flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer text-left",
                              scpType === p.id
                                ? "border-primary bg-primary text-primary-foreground pointer-events-none shadow-md"
                                : "border-border bg-white text-foreground hover:bg-primary/5",
                            )}
                            onClick={() =>
                              setValue(
                                "scpType",
                                p.id as EnrollmentFormData["scpType"],
                              )
                            }>
                            <div className="flex items-center gap-3 mb-1">
                              <div
                                className={cn(
                                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                                  scpType === p.id
                                    ? "border-white"
                                    : "border-muted-foreground",
                                )}>
                                {scpType === p.id && (
                                  <div className="w-2.5 h-2.5 rounded-full bg-white" />
                                )}
                              </div>
                              <span className="font-bold">{p.label}</span>
                            </div>
                            <p
                              className={cn(
                                "text-[0.6875rem] pl-8 italic",
                                scpType === p.id
                                  ? "text-primary-foreground/80"
                                  : "text-muted-foreground",
                              )}>
                              {p.desc}
                            </p>
                          </button>

                          {/* Sub-fields rendered outside button to avoid nesting issues */}
                          <AnimatePresence>
                            {scpType === p.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden">
                                <div className="pl-8 pt-4">
                                  {p.id === "SPECIAL_PROGRAM_IN_THE_ARTS" && (
                                    <div className="space-y-2">
                                      <Label className="text-[0.625rem] font-bold uppercase text-primary">
                                        Preferred Art Field *
                                      </Label>
                                      <Select
                                        onValueChange={(val) =>
                                          setValue("artField", val)
                                        }
                                        defaultValue={watch("artField")}>
                                        <SelectTrigger className="h-10 bg-white border-2 font-bold">
                                          <SelectValue placeholder="Select Art Field" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {SPA_ART_FIELDS.map((f) => (
                                            <SelectItem key={f} value={f}>
                                              {f}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}

                                  {p.id === "SPECIAL_PROGRAM_IN_SPORTS" && (
                                    <div className="space-y-2">
                                      <Label className="text-[0.625rem] font-bold uppercase text-primary">
                                        Primary Sport *
                                      </Label>
                                      <div className="grid grid-cols-2 gap-2">
                                        {SPS_SPORTS.map((s) => (
                                          <div
                                            key={s}
                                            className="flex items-center space-x-2">
                                            <Checkbox
                                              id={`sport-${s}`}
                                              checked={watch(
                                                "sportsList",
                                              )?.includes(s)}
                                              onCheckedChange={(checked) => {
                                                const curr =
                                                  watch("sportsList") || [];
                                                if (checked)
                                                  setValue("sportsList", [
                                                    ...curr,
                                                    s,
                                                  ]);
                                                else
                                                  setValue(
                                                    "sportsList",
                                                    curr.filter((i) => i !== s),
                                                  );
                                              }}
                                              className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                                            />
                                            <Label
                                              htmlFor={`sport-${s}`}
                                              className="text-xs font-medium cursor-pointer">
                                              {s}
                                            </Label>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {p.id ===
                                    "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE" && (
                                    <div className="space-y-2">
                                      <Label className="text-[0.625rem] font-bold uppercase text-primary">
                                        Preferred Language *
                                      </Label>
                                      <Select
                                        onValueChange={(val) =>
                                          setValue("foreignLanguage", val)
                                        }
                                        defaultValue={watch("foreignLanguage")}>
                                        <SelectTrigger className="h-10 bg-white border-2 font-bold">
                                          <SelectValue placeholder="Select Language" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {SPFL_LANGUAGES.map((l) => (
                                            <SelectItem key={l} value={l}>
                                              {l}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* General Preferences (All applicants) */}
      <div className="space-y-10 pt-6 border-t border-border/40">
        <div className="space-y-4">
          <Label className="text-sm font-bold uppercase tracking-widest text-primary">
            Type of Learner *
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {(
              [
                { value: "NEW_ENROLLEE", label: "New Enrollee" },
                { value: "TRANSFEREE", label: "Transferee" },
                { value: "RETURNING", label: "Returning Learner" },
                {
                  value: "OSCYA",
                  label: "Out-of-School Children, Youth, and Adults (OSCYA)",
                },
                { value: "ALS", label: "Alternative Learning System (ALS)" },
              ] as const
            ).map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setValue("learnerType", t.value)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left h-full min-h-[72px]",
                  watch("learnerType") === t.value
                    ? "border-primary bg-primary text-primary-foreground pointer-events-none shadow-md"
                    : "border-border bg-white hover:bg-primary/5",
                )}>
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    watch("learnerType") === t.value
                      ? "border-white"
                      : "border-muted-foreground",
                  )}>
                  {watch("learnerType") === t.value && (
                    <div className="w-2.5 h-2.5 rounded-full bg-white" />
                  )}
                </div>
                <span className="font-bold text-sm leading-tight">
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Learning Modality Preference */}
        <div className="space-y-4">
          <Label className="text-sm font-bold uppercase tracking-widest text-primary">
            If the school implements other distance learning modalities aside
            from face-to-face instruction, which would the learner prefer? Check
            all that applies:{" "}
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {LEARNING_MODALITIES.map((m) => (
              <div key={m} className="flex items-center space-x-3">
                <Checkbox
                  id={`modality-${m}`}
                  checked={watch("learningModalities")?.includes(m)}
                  onCheckedChange={(checked) => {
                    const curr = watch("learningModalities") || [];
                    setValue(
                      "learningModalities",
                      checked ? [...curr, m] : curr.filter((i) => i !== m),
                    );
                  }}
                  className="w-5 h-5 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                />
                <Label
                  htmlFor={`modality-${m}`}
                  className="text-sm font-medium cursor-pointer">
                  {m}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
