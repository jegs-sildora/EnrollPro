import { useFormContext } from "react-hook-form";
import type { EnrollmentFormData } from "../types";
import { DISABILITY_TYPES_A1, DISABILITY_TYPES_A2 } from "../types";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Checkbox } from "@/shared/ui/checkbox";
import { Badge } from "@/shared/ui/badge";
import { Lock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function Step3Background() {
  const { register, watch, setValue } = useFormContext<EnrollmentFormData>();

  const isIpCommunity = watch("isIpCommunity");
  const is4PsBeneficiary = watch("is4PsBeneficiary");
  const isLearnerWithDisability = watch("isLearnerWithDisability");
  const specialNeedsCategory = watch("specialNeedsCategory");
  const hasPwdId = watch("hasPwdId");

  return (
    <div className="space-y-12">
      <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20  rounded-xl">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-border">
          <Lock className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-base leading-tight font-bold text-primary">
            Sensitive Information
          </p>
          <p className="text-[0.6875rem] text-primary font-bold uppercase ">
            All details are kept strictly confidential.
          </p>
        </div>
      </div>

      <div className="space-y-10">
        {/* IP Community */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base leading-tight font-bold flex items-center gap-2">
              Is the learner a member of an IP cultural community? *
            </Label>
            <Badge
              variant="outline"
              className="text-[0.625rem] uppercase border-primary/20 text-primary gap-1 font-bold">
              <Lock className="w-2.5 h-2.5" /> Confidential
            </Badge>
          </div>
          <RadioGroup
            value={isIpCommunity ? "Yes" : "No"}
            onValueChange={(val) => setValue("isIpCommunity", val === "Yes")}
            className="flex gap-8">
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="No"
                id="ip-no"
                className="w-5 h-5 border-primary text-primary"
              />
              <Label
                htmlFor="ip-no"
                className="font-bold cursor-pointer">
                No
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="Yes"
                id="ip-yes"
                className="w-5 h-5 border-primary text-primary"
              />
              <Label
                htmlFor="ip-yes"
                className="font-bold cursor-pointer">
                Yes
              </Label>
            </div>
          </RadioGroup>
          <AnimatePresence>
            {isIpCommunity && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden p-1">
                <div className="pt-4 space-y-2 max-w-sm">
                  <Label
                    htmlFor="ip-group"
                    className="text-base font-bold uppercase text-foreground">
                    Specify IP Group Name
                  </Label>
                  <Input
                    autoComplete="off"
                    id="ip-group"
                    {...register("ipGroupName")}
                    placeholder="e.g. Ati, Mangyan"
                    className="h-11 font-bold uppercase"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 4Ps Beneficiary */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base leading-tight font-bold">
              Does the learner's household currently receive benefits under the
              Pantawid Pamilyang Pilipino Program (4Ps)? *
            </Label>
            <Badge
              variant="outline"
              className="text-[0.625rem] uppercase border-primary/20 text-primary gap-1 font-bold">
              <Lock className="w-2.5 h-2.5" /> Confidential
            </Badge>
          </div>
          <RadioGroup
            value={is4PsBeneficiary ? "Yes" : "No"}
            onValueChange={(val) => setValue("is4PsBeneficiary", val === "Yes")}
            className="flex gap-8">
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="No"
                id="4ps-no"
                className="w-5 h-5 border-primary text-primary"
              />
              <Label
                htmlFor="4ps-no"
                className="font-bold cursor-pointer">
                No
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="Yes"
                id="4ps-yes"
                className="w-5 h-5 border-primary text-primary"
              />
              <Label
                htmlFor="4ps-yes"
                className="font-bold cursor-pointer">
                Yes
              </Label>
            </div>
          </RadioGroup>
          <AnimatePresence>
            {is4PsBeneficiary && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden p-1">
                <div className="pt-4 space-y-2 max-w-sm">
                  <Label
                    htmlFor="household-id"
                    className="text-base font-bold uppercase text-foreground">
                    4Ps Household ID Number
                  </Label>
                  <Input
                    autoComplete="off"
                    id="household-id"
                    {...register("householdId4Ps")}
                    placeholder="Household ID"
                    className="h-11 font-bold"
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Balik Aral */}
        <div className="space-y-4">
          <Label className="text-base leading-tight font-bold">
            Is this learner returning to school after a gap of 1 year or more?
            (Balik-Aral) *
          </Label>
          <RadioGroup
            value={watch("isBalikAral") ? "Yes" : "No"}
            onValueChange={(val) => setValue("isBalikAral", val === "Yes")}
            className="flex gap-8">
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="No"
                id="ba-no"
                className="w-5 h-5 border-primary text-primary"
              />
              <Label
                htmlFor="ba-no"
                className="font-bold cursor-pointer">
                No
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="Yes"
                id="ba-yes"
                className="w-5 h-5 border-primary text-primary"
              />
              <Label
                htmlFor="ba-yes"
                className="font-bold cursor-pointer">
                Yes
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* SNED / Disability */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base leading-tight font-bold">
              Is the learner under the Special Needs Education Program? *
            </Label>
            <Badge
              variant="outline"
              className="text-[0.625rem] uppercase border-primary/20 text-primary gap-1 font-bold">
              <Lock className="w-2.5 h-2.5" /> Confidential
            </Badge>
          </div>
          <RadioGroup
            value={isLearnerWithDisability ? "Yes" : "No"}
            onValueChange={(val) => {
              setValue("isLearnerWithDisability", val === "Yes");
              if (val === "No") {
                setValue("specialNeedsCategory", undefined);
                setValue("disabilityTypes", []);
                setValue("hasPwdId", false);
              }
            }}
            className="flex gap-8">
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="No"
                id="lwd-no"
                className="w-5 h-5 border-primary text-primary"
              />
              <Label
                htmlFor="lwd-no"
                className="font-bold cursor-pointer">
                No
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="Yes"
                id="lwd-yes"
                className="w-5 h-5 border-primary text-primary"
              />
              <Label
                htmlFor="lwd-yes"
                className="font-bold cursor-pointer">
                Yes
              </Label>
            </div>
          </RadioGroup>

          <AnimatePresence>
            {isLearnerWithDisability && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden p-1">
                <div className="pt-4 space-y-6">
                  <p className="text-base font-bold uppercase text-foreground ">
                    If Yes, check only 1, either from a1 or a2
                  </p>

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
                          );
                          setValue("disabilityTypes", []);
                        }}
                        className="w-5 h-5 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                      />
                      <Label
                        htmlFor="sned-a1"
                        className="text-base leading-tight font-bold cursor-pointer">
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
                            {DISABILITY_TYPES_A1.map((type) => (
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
                                  className="text-base leading-tight font-bold cursor-pointer">
                                  {type}
                                </Label>
                              </div>
                            ))}
                          </div>
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
                          );
                          setValue("disabilityTypes", []);
                        }}
                        className="w-5 h-5 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                      />
                      <Label
                        htmlFor="sned-a2"
                        className="text-base leading-tight font-bold cursor-pointer">
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
                                  className="text-base leading-tight font-bold cursor-pointer">
                                  {type}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* b. PWD ID */}
                  <div className="space-y-2">
                    <Label className="text-base leading-tight font-bold">
                      b. Does the Learner have a PWD ID?
                    </Label>
                    <RadioGroup
                      value={hasPwdId ? "Yes" : "No"}
                      onValueChange={(val) =>
                        setValue("hasPwdId", val === "Yes")
                      }
                      className="flex gap-8">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="No"
                          id="pwd-no"
                          className="w-5 h-5 border-primary text-primary"
                        />
                        <Label
                          htmlFor="pwd-no"
                          className="font-bold cursor-pointer">
                          No
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="Yes"
                          id="pwd-yes"
                          className="w-5 h-5 border-primary text-primary"
                        />
                        <Label
                          htmlFor="pwd-yes"
                          className="font-bold cursor-pointer">
                          Yes
                        </Label>
                      </div>
                    </RadioGroup>
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
