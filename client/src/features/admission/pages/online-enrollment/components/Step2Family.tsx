import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Info, Mars, User, Venus } from "lucide-react";

import type { EnrollmentFormData } from "../types";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { Separator } from "@/shared/ui/separator";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { cn } from "@/shared/lib/utils";

type ContactKey = "MOTHER" | "FATHER" | "GUARDIAN";

const formatContactNumber = (raw: string) => {
  let value = raw.replace(/\D/g, "");
  if (value.length > 11) value = value.slice(0, 11);

  if (value.length > 7) {
    return `${value.slice(0, 4)}-${value.slice(4, 7)}-${value.slice(7)}`;
  }

  if (value.length > 4) {
    return `${value.slice(0, 4)}-${value.slice(4)}`;
  }

  return value;
};

export default function Step2Family() {
  const {
    register,
    watch,
    setValue,
    clearErrors,
    trigger,
    formState: { errors },
  } = useFormContext<EnrollmentFormData>();

  const data = watch();
  const hasNoMother = data.hasNoMother;
  const hasNoFather = data.hasNoFather;
  const isPermanentSameAsCurrent = data.isPermanentSameAsCurrent;
  const isGuardianRequired = hasNoMother && hasNoFather;
  const isLinkedFromEarlyRegistration =
    typeof data.earlyRegistrationId === "number";

  const motherInfoFilled =
    !hasNoMother &&
    !!data.mother?.firstName?.trim() &&
    !!data.mother?.lastName?.trim();

  const fatherInfoFilled =
    !hasNoFather &&
    !!data.father?.firstName?.trim() &&
    !!data.father?.lastName?.trim();

  const guardianInfoFilled =
    !!data.guardian?.firstName?.trim() && !!data.guardian?.lastName?.trim();

  const activeContactsCount = [
    motherInfoFilled,
    fatherInfoFilled,
    guardianInfoFilled,
  ].filter(Boolean).length;

  useEffect(() => {
    if (data.primaryContact === "MOTHER") {
      setValue("mother.contactNumber", data.contactNumber, {
        shouldValidate: false,
      });
      setValue("mother.email", data.email, { shouldValidate: false });
    } else if (data.primaryContact === "FATHER") {
      setValue("father.contactNumber", data.contactNumber, {
        shouldValidate: false,
      });
      setValue("father.email", data.email, { shouldValidate: false });
    } else if (data.primaryContact === "GUARDIAN") {
      setValue("guardian.contactNumber", data.contactNumber, {
        shouldValidate: false,
      });
      setValue("guardian.email", data.email, { shouldValidate: false });
    }
  }, [data.primaryContact, data.contactNumber, data.email, setValue]);

  useEffect(() => {
    const availableContacts: ContactKey[] = [];

    if (motherInfoFilled) availableContacts.push("MOTHER");
    if (fatherInfoFilled) availableContacts.push("FATHER");
    if (guardianInfoFilled) availableContacts.push("GUARDIAN");

    if (availableContacts.length === 0) {
      return;
    }

    if (!availableContacts.includes(data.primaryContact)) {
      setValue("primaryContact", availableContacts[0], {
        shouldValidate: true,
      });
      clearErrors("primaryContact");
    }
  }, [
    motherInfoFilled,
    fatherInfoFilled,
    guardianInfoFilled,
    data.primaryContact,
    setValue,
    clearErrors,
  ]);

  return (
    <div className="space-y-12">
      <Alert className="bg-primary/5 border-primary/20 items-center">
        <Info className="h-4 w-4 stroke-primary" />
        <AlertDescription className="font-bold text-primary/80">
          Please make sure contact details are active and correct for school
          updates and enrollment notices.
        </AlertDescription>
      </Alert>

      {isLinkedFromEarlyRegistration && (
        <Alert className="bg-amber-50 border-amber-200">
          <Info className="h-4 w-4 stroke-amber-600" />
          <AlertDescription className="text-amber-900 font-semibold">
            You are submitting from a linked Early Registration record. Please
            review and confirm the contact details below before final
            submission.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-8">
        <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
          Current Home Address
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <Label
              htmlFor="currentAddress.houseNo"
              className="text-xs font-bold uppercase">
              House No. / Street
            </Label>
            <Input
              autoComplete="off"
              id="currentAddress.houseNo"
              {...register("currentAddress.houseNo")}
              className="h-11 font-bold uppercase"
              placeholder="e.g. 123 OR RIZAL STREET"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="currentAddress.street"
              className="text-xs font-bold uppercase">
              Sitio / Purok
            </Label>
            <Input
              autoComplete="off"
              id="currentAddress.street"
              {...register("currentAddress.street")}
              className="h-11 font-bold uppercase"
              placeholder="e.g. RIZAL STREET"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <Label
              htmlFor="currentAddress.barangay"
              className="text-xs font-bold uppercase">
              Barangay <span className="text-destructive">*</span>
            </Label>
            <Input
              autoComplete="off"
              id="currentAddress.barangay"
              {...register("currentAddress.barangay")}
              className={cn(
                "h-11 font-bold uppercase",
                errors.currentAddress?.barangay &&
                  "border-destructive focus-visible:ring-destructive",
              )}
              placeholder="e.g. BARANGAY 1"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
            {errors.currentAddress?.barangay && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.currentAddress.barangay.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="currentAddress.cityMunicipality"
              className="text-xs font-bold uppercase">
              City / Municipality <span className="text-destructive">*</span>
            </Label>
            <Input
              autoComplete="off"
              id="currentAddress.cityMunicipality"
              {...register("currentAddress.cityMunicipality")}
              className={cn(
                "h-11 font-bold uppercase",
                errors.currentAddress?.cityMunicipality &&
                  "border-destructive focus-visible:ring-destructive",
              )}
              placeholder="e.g. QUEZON CITY"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
            {errors.currentAddress?.cityMunicipality && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.currentAddress.cityMunicipality.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="currentAddress.province"
              className="text-xs font-bold uppercase">
              Province <span className="text-destructive">*</span>
            </Label>
            <Input
              autoComplete="off"
              id="currentAddress.province"
              {...register("currentAddress.province")}
              className={cn(
                "h-11 font-bold uppercase",
                errors.currentAddress?.province &&
                  "border-destructive focus-visible:ring-destructive",
              )}
              placeholder="e.g. METRO MANILA"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
            {errors.currentAddress?.province && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.currentAddress.province.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3 pt-2">
          <Checkbox
            id="same-address"
            checked={isPermanentSameAsCurrent}
            onCheckedChange={(checked) =>
              setValue("isPermanentSameAsCurrent", checked === true, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            className="w-5 h-5 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
          <Label
            htmlFor="same-address"
            className="text-sm font-semibold cursor-pointer select-none">
            Permanent Address is same as Current Address
          </Label>
        </div>

        <AnimatePresence>
          {!isPermanentSameAsCurrent && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden">
              <div className="pt-8 pb-1 space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
                  Permanent Address
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="permanentAddress.houseNo"
                      className="text-xs font-bold uppercase">
                      House No. / Street
                    </Label>
                    <Input
                      autoComplete="off"
                      id="permanentAddress.houseNo"
                      {...register("permanentAddress.houseNo")}
                      className="h-11 font-bold uppercase"
                      placeholder="e.g. 456"
                      onInput={(e) => {
                        (e.target as HTMLInputElement).value = (
                          e.target as HTMLInputElement
                        ).value.toUpperCase();
                      }}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label
                      htmlFor="permanentAddress.street"
                      className="text-xs font-bold uppercase">
                      Sitio / Purok
                    </Label>
                    <Input
                      autoComplete="off"
                      id="permanentAddress.street"
                      {...register("permanentAddress.street")}
                      className="h-11 font-bold uppercase"
                      placeholder="e.g. MAGSAYSAY BLVD"
                      onInput={(e) => {
                        (e.target as HTMLInputElement).value = (
                          e.target as HTMLInputElement
                        ).value.toUpperCase();
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="permanentAddress.barangay"
                      className="text-xs font-bold uppercase">
                      Barangay
                    </Label>
                    <Input
                      autoComplete="off"
                      id="permanentAddress.barangay"
                      {...register("permanentAddress.barangay")}
                      className="h-11 font-bold uppercase"
                      placeholder="e.g. BARANGAY 2"
                      onInput={(e) => {
                        (e.target as HTMLInputElement).value = (
                          e.target as HTMLInputElement
                        ).value.toUpperCase();
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="permanentAddress.cityMunicipality"
                      className="text-xs font-bold uppercase">
                      City / Municipality
                    </Label>
                    <Input
                      autoComplete="off"
                      id="permanentAddress.cityMunicipality"
                      {...register("permanentAddress.cityMunicipality")}
                      className="h-11 font-bold uppercase"
                      placeholder="e.g. MAKATI CITY"
                      onInput={(e) => {
                        (e.target as HTMLInputElement).value = (
                          e.target as HTMLInputElement
                        ).value.toUpperCase();
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="permanentAddress.province"
                      className="text-xs font-bold uppercase">
                      Province
                    </Label>
                    <Input
                      autoComplete="off"
                      id="permanentAddress.province"
                      {...register("permanentAddress.province")}
                      className="h-11 font-bold uppercase"
                      placeholder="e.g. METRO MANILA"
                      onInput={(e) => {
                        (e.target as HTMLInputElement).value = (
                          e.target as HTMLInputElement
                        ).value.toUpperCase();
                      }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="opacity-50" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
              Mother&apos;s Details
            </h3>
            <div className="flex items-center gap-2">
              <Checkbox
                id="hasNoMother"
                checked={hasNoMother}
                onCheckedChange={(checked) => {
                  const value = checked === true;
                  setValue("hasNoMother", value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });

                  if (value) {
                    setValue("mother.lastName", "Information not available", {
                      shouldValidate: true,
                    });
                    setValue("mother.firstName", "Information not available", {
                      shouldValidate: true,
                    });
                    setValue("mother.middleName", "Information not available", {
                      shouldValidate: false,
                    });
                    setValue("mother.maidenName", "Information not available", {
                      shouldValidate: false,
                    });
                    clearErrors(["mother.lastName", "mother.firstName"]);
                  } else {
                    setValue("mother.lastName", "", { shouldValidate: true });
                    setValue("mother.firstName", "", { shouldValidate: true });
                    setValue("mother.middleName", "", {
                      shouldValidate: false,
                    });
                    setValue("mother.maidenName", "", {
                      shouldValidate: false,
                    });
                  }
                }}
              />
              <Label
                htmlFor="hasNoMother"
                className="text-xs font-bold uppercase text-muted-foreground cursor-pointer">
                Information not available
              </Label>
            </div>
          </div>

          <div
            className={cn(
              "space-y-4 transition-opacity",
              hasNoMother && "opacity-50 pointer-events-none",
            )}>
            <div className="space-y-1.5">
              <Label
                htmlFor="mother.lastName"
                className="text-xs font-bold uppercase">
                Last Name{" "}
                {!hasNoMother && <span className="text-destructive">*</span>}
              </Label>
              <Input
                autoComplete="off"
                id="mother.lastName"
                {...register("mother.lastName")}
                disabled={hasNoMother}
                className={cn(
                  "h-11 uppercase font-bold",
                  errors.mother?.lastName &&
                    "border-destructive focus-visible:ring-destructive",
                )}
                placeholder={hasNoMother ? "N/A" : "e.g. DELA CRUZ"}
                onInput={(e) => {
                  (e.target as HTMLInputElement).value = (
                    e.target as HTMLInputElement
                  ).value.toUpperCase();
                }}
              />
              {errors.mother?.lastName && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.mother.lastName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="mother.firstName"
                className="text-xs font-bold uppercase">
                First Name{" "}
                {!hasNoMother && <span className="text-destructive">*</span>}
              </Label>
              <Input
                autoComplete="off"
                id="mother.firstName"
                {...register("mother.firstName")}
                disabled={hasNoMother}
                className={cn(
                  "h-11 uppercase font-bold",
                  errors.mother?.firstName &&
                    "border-destructive focus-visible:ring-destructive",
                )}
                placeholder={hasNoMother ? "N/A" : "e.g. MARIA"}
                onInput={(e) => {
                  (e.target as HTMLInputElement).value = (
                    e.target as HTMLInputElement
                  ).value.toUpperCase();
                }}
              />
              {errors.mother?.firstName && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.mother.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="mother.middleName"
                className="text-xs font-bold uppercase">
                Middle Name
              </Label>
              <Input
                autoComplete="off"
                id="mother.middleName"
                {...register("mother.middleName")}
                disabled={hasNoMother}
                className="h-11 uppercase font-bold"
                placeholder="e.g. AQUINO or N/A"
                onInput={(e) => {
                  (e.target as HTMLInputElement).value = (
                    e.target as HTMLInputElement
                  ).value.toUpperCase();
                }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
              Father&apos;s Details
            </h3>
            <div className="flex items-center gap-2">
              <Checkbox
                id="hasNoFather"
                checked={hasNoFather}
                onCheckedChange={(checked) => {
                  const value = checked === true;
                  setValue("hasNoFather", value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });

                  if (value) {
                    setValue("father.lastName", "Information not available", {
                      shouldValidate: true,
                    });
                    setValue("father.firstName", "Information not available", {
                      shouldValidate: true,
                    });
                    setValue("father.middleName", "Information not available", {
                      shouldValidate: false,
                    });
                    clearErrors(["father.lastName", "father.firstName"]);
                  } else {
                    setValue("father.lastName", "", { shouldValidate: true });
                    setValue("father.firstName", "", { shouldValidate: true });
                    setValue("father.middleName", "", {
                      shouldValidate: false,
                    });
                  }
                }}
              />
              <Label
                htmlFor="hasNoFather"
                className="text-xs font-bold uppercase text-muted-foreground cursor-pointer">
                Information not available
              </Label>
            </div>
          </div>

          <div
            className={cn(
              "space-y-4 transition-opacity",
              hasNoFather && "opacity-50 pointer-events-none",
            )}>
            <div className="space-y-1.5">
              <Label
                htmlFor="father.lastName"
                className="text-xs font-bold uppercase">
                Last Name{" "}
                {!hasNoFather && <span className="text-destructive">*</span>}
              </Label>
              <Input
                autoComplete="off"
                id="father.lastName"
                {...register("father.lastName")}
                disabled={hasNoFather}
                className={cn(
                  "h-11 uppercase font-bold",
                  errors.father?.lastName &&
                    "border-destructive focus-visible:ring-destructive",
                )}
                placeholder={hasNoFather ? "N/A" : "e.g. DELA CRUZ"}
                onInput={(e) => {
                  (e.target as HTMLInputElement).value = (
                    e.target as HTMLInputElement
                  ).value.toUpperCase();
                }}
              />
              {errors.father?.lastName && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.father.lastName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="father.firstName"
                className="text-xs font-bold uppercase">
                First Name{" "}
                {!hasNoFather && <span className="text-destructive">*</span>}
              </Label>
              <Input
                autoComplete="off"
                id="father.firstName"
                {...register("father.firstName")}
                disabled={hasNoFather}
                className={cn(
                  "h-11 uppercase font-bold",
                  errors.father?.firstName &&
                    "border-destructive focus-visible:ring-destructive",
                )}
                placeholder={hasNoFather ? "N/A" : "e.g. JUAN"}
                onInput={(e) => {
                  (e.target as HTMLInputElement).value = (
                    e.target as HTMLInputElement
                  ).value.toUpperCase();
                }}
              />
              {errors.father?.firstName && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.father.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="father.middleName"
                className="text-xs font-bold uppercase">
                Middle Name
              </Label>
              <Input
                autoComplete="off"
                id="father.middleName"
                {...register("father.middleName")}
                disabled={hasNoFather}
                className="h-11 uppercase font-bold"
                placeholder="e.g. BAUTISTA or N/A"
                onInput={(e) => {
                  (e.target as HTMLInputElement).value = (
                    e.target as HTMLInputElement
                  ).value.toUpperCase();
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <Separator className="opacity-50" />

      <div className="space-y-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
          Guardian Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <Label
              htmlFor="guardian.lastName"
              className="text-xs font-bold uppercase">
              Last Name{" "}
              {isGuardianRequired && (
                <span className="text-destructive">*</span>
              )}
            </Label>
            <Input
              autoComplete="off"
              id="guardian.lastName"
              {...register("guardian.lastName")}
              className={cn(
                "h-11 uppercase font-bold",
                errors.guardian?.lastName &&
                  "border-destructive focus-visible:ring-destructive",
              )}
              placeholder="e.g. DELA CRUZ"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
            {errors.guardian?.lastName && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.guardian.lastName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="guardian.firstName"
              className="text-xs font-bold uppercase">
              First Name{" "}
              {isGuardianRequired && (
                <span className="text-destructive">*</span>
              )}
            </Label>
            <Input
              autoComplete="off"
              id="guardian.firstName"
              {...register("guardian.firstName")}
              className={cn(
                "h-11 uppercase font-bold",
                errors.guardian?.firstName &&
                  "border-destructive focus-visible:ring-destructive",
              )}
              placeholder="e.g. MARCELO"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
            {errors.guardian?.firstName && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.guardian.firstName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="guardianRelationship"
              className="text-xs font-bold uppercase">
              Relationship to Learner{" "}
              {isGuardianRequired && (
                <span className="text-destructive">*</span>
              )}
            </Label>
            <Input
              autoComplete="off"
              id="guardianRelationship"
              {...register("guardianRelationship")}
              className={cn(
                "h-11 font-bold uppercase",
                errors.guardianRelationship &&
                  "border-destructive focus-visible:ring-destructive",
              )}
              placeholder="e.g. GRANDPARENT"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
            {errors.guardianRelationship && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.guardianRelationship.message}
              </p>
            )}
          </div>
        </div>
      </div>

      <Separator className="opacity-50" />

      <div className="space-y-4">
        <Label className="text-sm font-bold uppercase tracking-widest text-primary">
          Who should we contact first?{" "}
          <span className="text-destructive">*</span>
        </Label>

        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            activeContactsCount === 3
              ? "md:grid-cols-3"
              : activeContactsCount === 2
                ? "md:grid-cols-2"
                : "grid-cols-1",
          )}>
          {(
            [
              {
                value: "MOTHER",
                label: "Mother",
                icon: Venus,
                hide: !motherInfoFilled,
              },
              {
                value: "FATHER",
                label: "Father",
                icon: Mars,
                hide: !fatherInfoFilled,
              },
              {
                value: "GUARDIAN",
                label: "Guardian",
                icon: User,
                hide: !guardianInfoFilled,
              },
            ] as const
          )
            .filter((option) => !option.hide)
            .map((option) => {
              const firstName =
                option.value === "MOTHER"
                  ? data.mother?.firstName
                  : option.value === "FATHER"
                    ? data.father?.firstName
                    : data.guardian?.firstName;

              const displayLabel =
                firstName &&
                firstName !== "N/A" &&
                firstName !== "INFORMATION NOT AVAILABLE" &&
                firstName !== "Information not available"
                  ? `${option.label} (${firstName})`
                  : option.label;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setValue("primaryContact", option.value, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                    if (isLinkedFromEarlyRegistration) {
                      setValue("isContactInfoConfirmed", false, {
                        shouldValidate: false,
                        shouldDirty: true,
                      });
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all group",
                    data.primaryContact === option.value
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-white hover:bg-muted/50",
                  )}>
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                      data.primaryContact === option.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                    )}>
                    <option.icon className="w-6 h-6" />
                  </div>
                  <span
                    className={cn(
                      "font-bold text-sm uppercase tracking-wider text-center",
                      data.primaryContact === option.value
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}>
                    {displayLabel}
                  </span>
                </button>
              );
            })}
        </div>

        {errors.primaryContact && (
          <p className="text-xs text-destructive font-medium flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.primaryContact.message}
          </p>
        )}
      </div>

      <div className="space-y-10">
        <div className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
            Contact Details
          </h3>

          {!data.primaryContact && (
            <p className="text-sm text-muted-foreground italic">
              Select a primary contact above before entering contact details.
            </p>
          )}

          <div className={cn(
            "rounded-xl border p-4 space-y-3 transition-colors",
            errors.isContactInfoConfirmed 
              ? "border-destructive bg-destructive/5" 
              : "border-blue-200 bg-blue-50"
          )}>
            <div className="flex items-start gap-2">
              <Checkbox
                id="isContactInfoConfirmed"
                checked={!!data.isContactInfoConfirmed}
                className={cn(errors.isContactInfoConfirmed && "border-destructive data-[state=unchecked]:border-destructive")}
                onCheckedChange={(checked) => {
                  setValue("isContactInfoConfirmed", checked === true, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  void trigger("isContactInfoConfirmed");
                }}
              />
              <Label
                htmlFor="isContactInfoConfirmed"
                className={cn(
                  "text-xs font-semibold leading-relaxed cursor-pointer",
                  errors.isContactInfoConfirmed ? "text-destructive" : "text-blue-900"
                )}>
                I confirm that the primary contact number and email are still
                active and correct for this enrollment. <span className="text-destructive">*</span>
              </Label>
            </div>
            {errors.isContactInfoConfirmed && (
              <p className="text-xs text-destructive font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.isContactInfoConfirmed.message}
              </p>
            )}
          </div>

          <div
            className={cn(
              "grid grid-cols-1 gap-8 items-start",
              motherInfoFilled && fatherInfoFilled && guardianInfoFilled
                ? "md:grid-cols-3"
                : "md:grid-cols-2",
            )}>
            {data.primaryContact && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-primary">
                    Primary Contact
                  </h4>
                  <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    {data.primaryContact === "MOTHER" ? (
                      <Venus className="w-3 h-3" />
                    ) : data.primaryContact === "FATHER" ? (
                      <Mars className="w-3 h-3" />
                    ) : (
                      <User className="w-3 h-3" />
                    )}
                    {data.primaryContact === "MOTHER"
                      ? "Mother's"
                      : data.primaryContact === "FATHER"
                        ? "Father's"
                        : "Guardian's"}{" "}
                    Contact Information
                  </Label>
                </div>

                <div className="grid grid-cols-1 gap-6 p-5 rounded-2xl border border-primary/20 bg-primary/5 shadow-sm">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="contactNumber"
                      className="text-xs font-bold uppercase flex items-center gap-1">
                      Contact Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="contactNumber"
                      {...register("contactNumber")}
                      placeholder="09XX-XXX-XXXX"
                      className={cn(
                        "h-11 font-bold bg-white",
                        errors.contactNumber &&
                          "border-destructive focus-visible:ring-destructive",
                      )}
                      inputMode="tel"
                      maxLength={13}
                      onInput={(event) => {
                        const input = event.target as HTMLInputElement;
                        input.value = formatContactNumber(input.value);
                        if (isLinkedFromEarlyRegistration) {
                          setValue("isContactInfoConfirmed", false, {
                            shouldValidate: false,
                            shouldDirty: true,
                          });
                        }
                      }}
                    />
                    {errors.contactNumber && (
                      <p className="text-xs text-destructive font-bold flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.contactNumber.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="email"
                      className="text-xs font-bold uppercase flex items-center gap-1">
                      Email Address <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      {...register("email")}
                      type="email"
                      placeholder="email@example.com"
                      className={cn(
                        "h-11 font-bold bg-white",
                        errors.email &&
                          "border-destructive focus-visible:ring-destructive",
                      )}
                      onInput={() => {
                        if (isLinkedFromEarlyRegistration) {
                          setValue("isContactInfoConfirmed", false, {
                            shouldValidate: false,
                            shouldDirty: true,
                          });
                        }
                      }}
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive font-bold flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {(
              [
                {
                  id: "mother",
                  label: "Mother",
                  icon: Venus,
                  active: motherInfoFilled && data.primaryContact !== "MOTHER",
                  path: "mother",
                },
                {
                  id: "father",
                  label: "Father",
                  icon: Mars,
                  active: fatherInfoFilled && data.primaryContact !== "FATHER",
                  path: "father",
                },
                {
                  id: "guardian",
                  label: "Guardian",
                  icon: User,
                  active:
                    guardianInfoFilled && data.primaryContact !== "GUARDIAN",
                  path: "guardian",
                },
              ] as const
            )
              .filter((secondary) => secondary.active)
              .map((secondary) => {
                const contactField = `${secondary.path}.contactNumber` as
                  | "mother.contactNumber"
                  | "father.contactNumber"
                  | "guardian.contactNumber";

                const emailField = `${secondary.path}.email` as
                  | "mother.email"
                  | "father.email"
                  | "guardian.email";

                return (
                  <div
                    key={secondary.id}
                    className="space-y-4 transition-opacity duration-0 opacity-70 hover:opacity-100 focus-within:opacity-100">
                    <div className="flex flex-col gap-1">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                        Secondary Contact (Optional)
                      </h4>
                      <Label className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest flex items-center gap-2">
                        <secondary.icon className="w-3 h-3" />
                        {secondary.label}'s Contact Information
                      </Label>
                    </div>

                    <div className="grid grid-cols-1 gap-6 p-5 rounded-2xl border border-border bg-muted/20 shadow-sm">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor={contactField}
                          className="text-xs font-bold uppercase">
                          Contact Number
                        </Label>
                        <Input
                          id={contactField}
                          {...register(contactField)}
                          placeholder="09XX-XXX-XXXX"
                          className="h-11 font-bold bg-white"
                          inputMode="tel"
                          maxLength={13}
                          onInput={(event) => {
                            const input = event.target as HTMLInputElement;
                            input.value = formatContactNumber(input.value);
                          }}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor={emailField}
                          className="text-xs font-bold uppercase">
                          Email Address
                        </Label>
                        <Input
                          id={emailField}
                          {...register(emailField)}
                          type="email"
                          placeholder="email@example.com"
                          className="h-11 font-bold bg-white"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
