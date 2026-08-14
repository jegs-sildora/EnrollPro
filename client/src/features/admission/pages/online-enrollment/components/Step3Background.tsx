import { motion, AnimatePresence } from "motion/react";
import { useFormContext } from "react-hook-form";
import { AnimatedError } from "@/shared/components/AnimatedError";
import type { EnrollmentFormData } from "../types";
import { DISABILITY_TYPES_A1, DISABILITY_TYPES_A2, SPECIAL_HEALTH_SUB_OPTIONS, VISUAL_IMPAIRMENT_SUB_OPTIONS } from "../types";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { cn } from "@/shared/lib/utils";
import { Checkbox } from "@/shared/ui/checkbox";
import { Badge } from "@/shared/ui/badge";
import { Lock } from "lucide-react";

export default function Step3Background() {
  const { register, watch, setValue, resetField, formState: { errors } } = useFormContext<EnrollmentFormData>();

  const isIpCommunity = watch("isIpCommunity");
  const is4PsBeneficiary = watch("is4PsBeneficiary");
  const isLearnerWithDisability = watch("isLearnerWithDisability");
  const specialNeedsCategory = watch("specialNeedsCategory");
  const hasPwdId = watch("hasPwdId");

  return (
    <div className="space-y-12">

      <div className="space-y-10">
        {/* IP Community */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base leading-tight font-extrabold flex items-center gap-2">
              Is the learner a member of an IP cultural community? *
            </Label>
            <Badge
              variant="outline"
              className="text-sm uppercase border-primary/20 text-primary gap-1 font-extrabold">
              <Lock className="w-2.5 h-2.5" /> Confidential
            </Badge>
          </div>
          <div id="isIpCommunity" className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setValue("isIpCommunity", false, { shouldValidate: true })}
              className={cn(
                "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                isIpCommunity === false
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
              )}>
              <span className="font-extrabold text-base leading-tight ">
                No
              </span>
            </button>
            <button
              type="button"
              onClick={() => setValue("isIpCommunity", true, { shouldValidate: true })}
              className={cn(
                "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                isIpCommunity === true
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
              )}>
              <span className="font-extrabold text-base leading-tight ">
                Yes
              </span>
            </button>
          </div>
          <AnimatedError error={errors.isIpCommunity?.message as string || errors.isIpCommunity as unknown as string} />
          <AnimatePresence>
            {isIpCommunity && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden p-1">
                <div className="pt-4 space-y-2 w-full">
                  <Label
                    htmlFor="ip-group"
                    className="text-base font-extrabold uppercase text-foreground">
                    Specify IP Group Name
                  </Label>
                  <Input
                    autoComplete="off"
                    id="ip-group"
                    {...register("ipGroupName")}
                    placeholder="e.g. Ati, Mangyan"
                    className={cn(
                      "h-11 font-extrabold uppercase",
                      errors.ipGroupName && "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  <AnimatedError error={errors.ipGroupName?.message as string || errors.ipGroupName as unknown as string} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 4Ps Beneficiary */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base leading-tight font-extrabold">
              Does the learner's household currently receive benefits under the
              Pantawid Pamilyang Pilipino Program (4Ps)? *
            </Label>
            <Badge
              variant="outline"
              className="text-sm uppercase border-primary/20 text-primary gap-1 font-extrabold">
              <Lock className="w-2.5 h-2.5" /> Confidential
            </Badge>
          </div>
          <div id="is4PsBeneficiary" className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setValue("is4PsBeneficiary", false, { shouldValidate: true })}
              className={cn(
                "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                is4PsBeneficiary === false
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
              )}>
              <span className="font-extrabold text-base leading-tight ">
                No
              </span>
            </button>
            <button
              type="button"
              onClick={() => setValue("is4PsBeneficiary", true, { shouldValidate: true })}
              className={cn(
                "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                is4PsBeneficiary === true
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
              )}>
              <span className="font-extrabold text-base leading-tight ">
                Yes
              </span>
            </button>
          </div>
          <AnimatedError error={errors.is4PsBeneficiary?.message as string || errors.is4PsBeneficiary as unknown as string} />
          <AnimatePresence>
            {is4PsBeneficiary && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden p-1">
                <div className="pt-4 space-y-2 w-full">
                  <Label
                    htmlFor="household-id"
                    className="text-base font-extrabold uppercase text-foreground">
                    4Ps Household ID Number
                  </Label>
                  <Input
                    autoComplete="off"
                    id="household-id"
                    {...register("householdId4Ps")}
                    placeholder="Household ID"
                    className={cn(
                      "h-11 font-extrabold uppercase",
                      errors.householdId4Ps && "border-destructive focus-visible:ring-destructive"
                    )}
                    inputMode="numeric"
                    onKeyDown={(e) => {
                      if (
                        !/[0-9]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(
                          e.key,
                        )
                      )
                        e.preventDefault();
                    }}
                  />
                  <AnimatedError error={errors.householdId4Ps?.message as string || errors.householdId4Ps as unknown as string} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Balik Aral */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base leading-tight font-extrabold">
              Is this learner returning to school after a gap of 1 year or more?
            (Balik-Aral) *
            </Label>
            <Badge
              variant="outline"
              className="text-sm uppercase border-primary/20 text-primary gap-1 font-extrabold">
              <Lock className="w-2.5 h-2.5" /> Confidential
            </Badge>
          </div>
          <div id="isBalikAral" className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setValue("isBalikAral", false, { shouldValidate: true });
                setValue("learnerType", "NEW_ENROLLEE", { shouldValidate: true });
              }}
              className={cn(
                "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                watch("isBalikAral") === false
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
              )}>
              <span className="font-extrabold text-base leading-tight ">
                No
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setValue("isBalikAral", true, { shouldValidate: true });
                setValue("learnerType", "RETURNING", { shouldValidate: true });
              }}
              className={cn(
                "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                watch("isBalikAral") === true
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
              )}>
              <span className="font-extrabold text-base leading-tight ">
                Yes
              </span>
            </button>
          </div>
          <AnimatedError error={errors.isBalikAral?.message as string || errors.isBalikAral as unknown as string} />
        </div>

        {/* SNED / Disability */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base leading-tight font-extrabold">
              Is the learner under the Special Needs Education Program? *
            </Label>
            <Badge
              variant="outline"
              className="text-sm uppercase border-primary/20 text-primary gap-1 font-extrabold">
              <Lock className="w-2.5 h-2.5" /> Confidential
            </Badge>
          </div>
          <div id="isLearnerWithDisability" className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setValue("isLearnerWithDisability", false, { shouldValidate: true });
                setValue("specialNeedsCategory", undefined, { shouldValidate: true, shouldDirty: true });
                setValue("disabilityTypes", [], { shouldValidate: true, shouldDirty: true });
                setValue("hasPwdId", false, { shouldValidate: true, shouldDirty: true });
              }}
              className={cn(
                "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                isLearnerWithDisability === false
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
              )}>
              <span className="font-extrabold text-base leading-tight ">
                No
              </span>
            </button>
            <button
              type="button"
              onClick={() => setValue("isLearnerWithDisability", true, { shouldValidate: true })}
              className={cn(
                "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                isLearnerWithDisability === true
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
              )}>
              <span className="font-extrabold text-base leading-tight ">
                Yes
              </span>
            </button>
          </div>
          <AnimatedError error={errors.isLearnerWithDisability?.message as string || errors.isLearnerWithDisability as unknown as string} />

          <AnimatePresence>
            {isLearnerWithDisability && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden p-1">
                <div className="pt-4 space-y-6">
                  <p className="text-base font-extrabold uppercase text-foreground ">
                    If Yes, check only 1, either from a1 or a2
                  </p>
                  <AnimatedError error={errors.specialNeedsCategory?.message as string || errors.specialNeedsCategory as unknown as string} />

                  {/* a1 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="sned-a1"
                        checked={specialNeedsCategory === "a1"}
                        onCheckedChange={(checked) => {
                          setValue(
                            "specialNeedsCategory",
                            checked ? "a1" : undefined,
                            { shouldValidate: true, shouldDirty: true }
                          );
                          setValue("disabilityTypes", [], { shouldValidate: true, shouldDirty: true });
                        }}
                        className="w-5 h-5 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                      />
                      <Label
                        htmlFor="sned-a1"
                        className="text-base leading-tight font-extrabold cursor-pointer">
                        a1. With Diagnosis from Licensed Medical Specialist
                      </Label>
                    </div>
                    <AnimatePresence>
                      {specialNeedsCategory === "a1" && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden">
                          <div className="ml-7 mt-2 p-4 border border-border/60 bg-muted/10 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-3">
                            {DISABILITY_TYPES_A1.map((type) => {
                              const isChecked = watch("disabilityTypes")?.includes(type);
                              const subOptions = type === "Special Health Problem/Chronic Disease" 
                                ? SPECIAL_HEALTH_SUB_OPTIONS 
                                : type === "Visual Impairment" 
                                  ? VISUAL_IMPAIRMENT_SUB_OPTIONS 
                                  : null;

                              return (
                                <div key={type} className="flex flex-col space-y-3">
                                  <div className="flex items-center space-x-3">
                                    <Checkbox
                                      id={`disability-${type}`}
                                      checked={isChecked}
                                      onCheckedChange={(checked) => {
                                        const current = watch("disabilityTypes") || [];
                                        let newTypes = checked
                                          ? [...current, type]
                                          : current.filter((t) => t !== type);
                                        
                                        // If unchecking, remove sub-options too
                                        if (!checked && subOptions) {
                                          newTypes = newTypes.filter(t => !subOptions.includes(t));
                                        }

                                        setValue("disabilityTypes", newTypes, { shouldValidate: true });
                                      }}
                                      className="w-4 h-4 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                                    />
                                    <Label
                                      htmlFor={`disability-${type}`}
                                      className="text-base leading-tight font-extrabold cursor-pointer">
                                      {type}
                                    </Label>
                                  </div>

                                  <AnimatePresence>
                                    {isChecked && subOptions && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden ml-7 flex flex-col space-y-3"
                                      >
                                        {subOptions.map((subType) => (
                                          <div key={subType} className="flex items-center space-x-3">
                                            <Checkbox
                                              id={`disability-${subType}`}
                                              checked={watch("disabilityTypes")?.includes(subType)}
                                              onCheckedChange={(checked) => {
                                                const current = watch("disabilityTypes") || [];
                                                // Clear other sub-options of the same parent for better UX
                                                const withoutOtherSubOptions = current.filter(t => !subOptions.includes(t));
                                                setValue(
                                                  "disabilityTypes",
                                                  checked
                                                    ? [...withoutOtherSubOptions, subType]
                                                    : current.filter((t) => t !== subType),
                                                  { shouldValidate: true }
                                                );
                                              }}
                                              className="w-4 h-4 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                                            />
                                            <Label
                                              htmlFor={`disability-${subType}`}
                                              className="text-sm leading-tight font-extrabold cursor-pointer">
                                              {subType}
                                            </Label>
                                          </div>
                                        ))}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                          <AnimatedError error={errors.disabilityTypes?.message as string || errors.disabilityTypes as unknown as string} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* a2 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="sned-a2"
                        checked={specialNeedsCategory === "a2"}
                        onCheckedChange={(checked) => {
                          setValue(
                            "specialNeedsCategory",
                            checked ? "a2" : undefined,
                            { shouldValidate: true, shouldDirty: true }
                          );
                          setValue("disabilityTypes", [], { shouldValidate: true, shouldDirty: true });
                        }}
                        className="w-5 h-5 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                      />
                      <Label
                        htmlFor="sned-a2"
                        className="text-base leading-tight font-extrabold cursor-pointer">
                        a2. With Manifestations
                      </Label>
                    </div>
                    <AnimatePresence>
                      {specialNeedsCategory === "a2" && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden">
                          <div className="ml-7 mt-2 p-4 border border-border/60 bg-muted/10 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-3">
                            {DISABILITY_TYPES_A2.map((type) => (
                              <div
                                key={type}
                                className="flex items-center space-x-3">
                                <Checkbox
                                  id={`disability-${type}`}
                                  checked={watch("disabilityTypes")?.includes(
                                    type,
                                  )}
                                  onCheckedChange={(checked) => {
                                    const current =
                                      watch("disabilityTypes") || [];
                                    setValue(
                                      "disabilityTypes",
                                      checked
                                        ? [...current, type]
                                        : current.filter((t) => t !== type),
                                    );
                                  }}
                                  className="w-4 h-4 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                                />
                                <Label
                                  htmlFor={`disability-${type}`}
                                  className="text-base leading-tight font-extrabold cursor-pointer">
                                  {type}
                                </Label>
                              </div>
                            ))}
                          </div>
                          <AnimatedError error={errors.disabilityTypes?.message as string || errors.disabilityTypes as unknown as string} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* b. PWD ID */}
                  <div className="space-y-2">
                    <Label className="text-base leading-tight font-extrabold">
                      b. Does the Learner have a PWD ID?
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setValue("hasPwdId", false, { shouldValidate: true })}
                        className={cn(
                          "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                          !hasPwdId
                            ? "border-primary bg-primary text-primary-foreground shadow-md"
                            : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
                        )}>
                        <span className="font-extrabold text-base leading-tight ">
                          No
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue("hasPwdId", true, { shouldValidate: true })}
                        className={cn(
                          "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                          hasPwdId
                            ? "border-primary bg-primary text-primary-foreground shadow-md"
                            : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
                        )}>
                        <span className="font-extrabold text-base leading-tight ">
                          Yes
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
