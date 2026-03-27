import { useFormContext } from "react-hook-form";
import type { EarlyRegistrationFormData } from "../types";
import {
  ACADEMIC_CLUSTERS,
  TECHPRO_CLUSTERS,
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
import { GraduationCap, BookOpen, AlertTriangle } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { motion, AnimatePresence } from "motion/react";

export default function Step5Enrollment() {
  const { register, watch, setValue } =
    useFormContext<EarlyRegistrationFormData>();

  const gradeLevel = watch("gradeLevel");
  const shsTrack = watch("shsTrack");
  const isScpApplication = watch("isScpApplication");
  const scpType = watch("scpType");
  const electiveCluster = watch("electiveCluster");

  const clusters =
    shsTrack === "Academic" ? ACADEMIC_CLUSTERS : TECHPRO_CLUSTERS;
  const showStemGrades = electiveCluster === "AC-STEM";

  const grades = ["7", "11"] as const;

  return (
    <div className='space-y-12'>
      {/* Grade Level Selector */}
      <div className='space-y-6'>
        <Label className='text-sm font-bold uppercase tracking-widest text-primary'>
          Grade Level to Apply for *
        </Label>
        <div className='grid grid-cols-2 gap-3 mt-2'>
          {grades.map((g) => (
            <button
              key={g}
              type='button'
              onClick={() => {
                setValue("gradeLevel", g);
                if (g !== "11") {
                  setValue("shsTrack", undefined);
                  setValue("electiveCluster", undefined);
                }
                if (g !== "7") {
                  setValue("isScpApplication", false);
                  setValue("scpType", undefined);
                }
              }}
              className={cn(
                "h-16 rounded-xl border-2 font-bold text-lg transition-all flex items-center justify-center shadow-sm",
                gradeLevel === g
                  ? "border-primary bg-primary text-primary-foreground pointer-events-none"
                  : "border-border bg-white text-muted-foreground hover:bg-primary/5",
              )}>
              G{g}
            </button>
          ))}
        </div>
      </div>

      {/* Grade 7: SCP Section */}
      <AnimatePresence>
        {gradeLevel === "7" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className='overflow-hidden'>
            <div className='space-y-8 pb-8'>
              <div className='p-6 border bg-primary/5 border-primary/20 rounded-2xl space-y-6 shadow-sm'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm'>
                    <BookOpen className='w-5 h-5 text-primary' />
                  </div>
                  <Label className='text-base font-bold text-primary'>
                    Application Type *
                  </Label>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <button
                    type='button'
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
                    <div className='flex items-center gap-3 mb-1'>
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                          !isScpApplication
                            ? "border-white"
                            : "border-muted-foreground",
                        )}>
                        {!isScpApplication && (
                          <div className='w-2.5 h-2.5 rounded-full bg-white' />
                        )}
                      </div>
                      <span className='font-bold'>Regular Section</span>
                    </div>
                    <p
                      className={cn(
                        "text-[11px] pl-8",
                        !isScpApplication
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground",
                      )}>
                      Open EARLY REGISTRATION • no entrance exam required.
                    </p>
                  </button>

                  <button
                    type='button'
                    className={cn(
                      "flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer text-left",
                      isScpApplication
                        ? "border-primary bg-primary text-primary-foreground pointer-events-none"
                        : "border-border bg-white hover:bg-primary/5",
                    )}
                    onClick={() => setValue("isScpApplication", true)}>
                    <div className='flex items-center gap-3 mb-1'>
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                          isScpApplication
                            ? "border-white"
                            : "border-muted-foreground",
                        )}>
                        {isScpApplication && (
                          <div className='w-2.5 h-2.5 rounded-full bg-white' />
                        )}
                      </div>
                      <span className='font-bold'>
                        Special Curricular Program (SCP)
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-[11px] pl-8",
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
                      className='overflow-hidden'>
                      <div className='pt-6 space-y-6'>
                        <Label className='text-sm font-bold uppercase tracking-widest text-primary'>
                          Select SCP Program *
                        </Label>
                        <div className='grid grid-cols-1 gap-3'>
                          {[
                            {
                              id: "STE",
                              label: "Science, Technology & Engineering (STE)",
                              desc: "Written entrance exam + Interview.",
                            },
                            {
                              id: "SPA",
                              label: "Special Program in the Arts (SPA)",
                              desc: "Written exam + Audition + Interview.",
                            },
                            {
                              id: "SPS",
                              label: "Special Program in Sports (SPS)",
                              desc: "Physical tryout • Sports background required.",
                            },
                            {
                              id: "SPJ",
                              label: "Special Program in Journalism (SPJ)",
                              desc: "Written exam (SPJQE) + Interview.",
                            },
                            {
                              id: "SPFL",
                              label:
                                "Special Program in Foreign Language (SPFL)",
                              desc: "Based on NAT English score.",
                            },
                            {
                              id: "SPTVE",
                              label:
                                "Special Program in Tech-Voc Education (SPTVE)",
                              desc: "Aptitude assessment.",
                            },
                          ].map((p) => (
                            <div key={p.id} className='space-y-0'>
                              <button
                                type='button'
                                className={cn(
                                  "w-full flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer text-left",
                                  scpType === p.id
                                    ? "border-primary bg-primary text-primary-foreground pointer-events-none shadow-md"
                                    : "border-border bg-white text-foreground hover:bg-primary/5",
                                )}
                                onClick={() =>
                                  setValue(
                                    "scpType",
                                    p.id as
                                      | "STE"
                                      | "SPA"
                                      | "SPS"
                                      | "SPJ"
                                      | "SPFL"
                                      | "SPTVE",
                                  )
                                }>
                                <div className='flex items-center gap-3 mb-1'>
                                  <div
                                    className={cn(
                                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                                      scpType === p.id
                                        ? "border-white"
                                        : "border-muted-foreground",
                                    )}>
                                    {scpType === p.id && (
                                      <div className='w-2.5 h-2.5 rounded-full bg-white' />
                                    )}
                                  </div>
                                  <span className='font-bold'>{p.label}</span>
                                </div>
                                <p
                                  className={cn(
                                    "text-[11px] pl-8 italic",
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
                                    className='overflow-hidden'>
                                    <div className='pl-8'>
                                      {p.id === "SPA" && (
                                        <div className='space-y-2'>
                                          <Label className='text-[10px] font-bold uppercase text-primary'>
                                            Preferred Art Field *
                                          </Label>
                                          <Select
                                            onValueChange={(val) =>
                                              setValue("artField", val)
                                            }
                                            defaultValue={watch("artField")}>
                                            <SelectTrigger className='h-10 bg-white border-2 font-bold'>
                                              <SelectValue placeholder='Select Art Field' />
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

                                      {p.id === "SPS" && (
                                        <div className='space-y-2'>
                                          <Label className='text-[10px] font-bold uppercase text-primary'>
                                            Primary Sport *
                                          </Label>
                                          <div className='grid grid-cols-2 gap-2'>
                                            {SPS_SPORTS.map((s) => (
                                              <div
                                                key={s}
                                                className='flex items-center space-x-2'>
                                                <Checkbox
                                                  id={`sport-${s}`}
                                                  checked={watch(
                                                    "sportsList",
                                                  )?.includes(s)}
                                                  onCheckedChange={(
                                                    checked,
                                                  ) => {
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
                                                        curr.filter(
                                                          (i) => i !== s,
                                                        ),
                                                      );
                                                  }}
                                                  className='data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary'
                                                />
                                                <Label
                                                  htmlFor={`sport-${s}`}
                                                  className='text-xs font-medium cursor-pointer'>
                                                  {s}
                                                </Label>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {p.id === "SPFL" && (
                                        <div className='space-y-2'>
                                          <Label className='text-[10px] font-bold uppercase text-primary'>
                                            Preferred Language *
                                          </Label>
                                          <Select
                                            onValueChange={(val) =>
                                              setValue("foreignLanguage", val)
                                            }
                                            defaultValue={watch(
                                              "foreignLanguage",
                                            )}>
                                            <SelectTrigger className='h-10 bg-white border-2 font-bold'>
                                              <SelectValue placeholder='Select Language' />
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grade 11: SHS Track Section */}
      <AnimatePresence>
        {gradeLevel === "11" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className='overflow-hidden'>
            <div className='space-y-8 pb-8'>
              <div className='p-6 border border-primary/20 bg-primary/5 rounded-2xl space-y-8 shadow-sm'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm'>
                    <GraduationCap className='w-5 h-5 text-primary' />
                  </div>
                  <Label className='text-base font-bold text-primary'>
                    SHS Program Selection *
                  </Label>
                </div>

                <div className='space-y-4'>
                  <Label className='text-sm font-bold uppercase tracking-widest text-primary opacity-70'>
                    Choose Track
                  </Label>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                    {(["Academic", "TechPro"] as const).map((t) => (
                      <button
                        key={t}
                        type='button'
                        className={cn(
                          "flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer bg-white text-left",
                          shsTrack === t
                            ? "border-primary bg-primary text-primary-foreground pointer-events-none shadow-md"
                            : "border-border bg-white text-foreground hover:bg-primary/5",
                        )}
                        onClick={() => {
                          setValue("shsTrack", t);
                          setValue("electiveCluster", undefined);
                        }}>
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                            shsTrack === t
                              ? "border-white"
                              : "border-muted-foreground",
                          )}>
                          {shsTrack === t && (
                            <div className='w-2.5 h-2.5 rounded-full bg-white' />
                          )}
                        </div>
                        <span className='font-bold'>
                          {t === "Academic"
                            ? "Academic Track"
                            : "Tech-Voc Track"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <AnimatePresence>
                  {!!shsTrack && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className='overflow-hidden'>
                      <div className='space-y-6 pt-4'>
                        <div className='space-y-2 px-1'>
                          <Label className='text-sm font-bold uppercase tracking-widest text-primary/60'>
                            Preferred Elective Cluster *
                          </Label>
                          <Select
                            value={electiveCluster}
                            onValueChange={(val) =>
                              setValue("electiveCluster", val)
                            }>
                            <SelectTrigger className='h-12 bg-white border-2 font-bold'>
                              <SelectValue placeholder='Select Elective Cluster' />
                            </SelectTrigger>
                            <SelectContent>
                              {clusters.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <AnimatePresence>
                          {showStemGrades && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className='overflow-hidden'>
                              <div className='pt-4'>
                                <div className='p-6 bg-amber-50 border-2 border-amber-200 rounded-2xl space-y-6'>
                                  <div className='flex items-start gap-3'>
                                    <AlertTriangle className='w-5 h-5 text-amber-600 mt-0.5' />
                                    <div>
                                      <h4 className='font-bold text-amber-900'>
                                        STEM Eligibility Check
                                      </h4>
                                      <p className='text-xs text-amber-800 font-medium leading-relaxed'>
                                        STEM requires a Grade 10 Science and
                                        Mathematics final grade of 85 or higher.
                                      </p>
                                    </div>
                                  </div>

                                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-6'>
                                    <div className='space-y-2'>
                                      <Label
                                        htmlFor='g10Science'
                                        className='text-xs font-bold uppercase text-amber-900/60'>
                                        G10 Science Final Grade
                                      </Label>
                                      <Input
                                        autoComplete='off'
                                        id='g10Science'
                                        type='number'
                                        {...register("g10ScienceGrade", {
                                          valueAsNumber: true,
                                        })}
                                        className='h-11 border-amber-200 bg-white font-bold'
                                        placeholder='0-100'
                                      />
                                      {watch("g10ScienceGrade") !== undefined &&
                                        watch("g10ScienceGrade")! < 85 && (
                                          <p className='text-[10px] font-bold text-amber-700 italic'>
                                            Note: Below 85. Registrar will
                                            review your case.
                                          </p>
                                        )}
                                    </div>
                                    <div className='space-y-2'>
                                      <Label
                                        htmlFor='g10Math'
                                        className='text-xs font-bold uppercase text-amber-900/60'>
                                        G10 Math Final Grade
                                      </Label>
                                      <Input
                                        autoComplete='off'
                                        id='g10Math'
                                        type='number'
                                        {...register("g10MathGrade", {
                                          valueAsNumber: true,
                                        })}
                                        className='h-11 border-amber-200 bg-white font-bold'
                                        placeholder='0-100'
                                      />
                                      {watch("g10MathGrade") !== undefined &&
                                        watch("g10MathGrade")! < 85 && (
                                          <p className='text-[10px] font-bold text-amber-700 italic'>
                                            Note: Below 85. Registrar will
                                            review your case.
                                          </p>
                                        )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* General Preferences (All applicants) */}
      <div className='space-y-10 pt-6 border-t border-border/40'>
        <div className='space-y-4'>
          <Label className='text-sm font-bold uppercase tracking-widest text-primary'>
            Type of Learner *
          </Label>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3'>
            {(
              [
                { value: "Regular", label: "Regular" },
                { value: "Transferee", label: "Transferee" },
                { value: "Returning Learner", label: "Returning Learner" },
                {
                  value: "OSCYA",
                  label: "Out-of-School Children, Youth, and Adults (OSCYA)",
                },
                { value: "ALS", label: "Alternative Learning System (ALS)" },
              ] as const
            ).map((t) => (
              <button
                key={t.value}
                type='button'
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
                    <div className='w-2.5 h-2.5 rounded-full bg-white' />
                  )}
                </div>
                <span className='font-bold text-sm leading-tight'>
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Learning Modality Preference */}
        <div className='space-y-4'>
          <Label className='text-sm font-bold uppercase tracking-widest text-primary'>
            If the school implements other distance learning modalities aside
            from face-to-face instruction, which would the learner prefer? Check
            all that applies:{" "}
          </Label>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3'>
            {LEARNING_MODALITIES.map((m) => (
              <div key={m} className='flex items-center space-x-3'>
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
                  className='w-5 h-5 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary'
                />
                <Label
                  htmlFor={`modality-${m}`}
                  className='text-sm font-medium cursor-pointer'>
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
