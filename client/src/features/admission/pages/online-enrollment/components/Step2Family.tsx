import { AnimatedError } from "@/shared/components/AnimatedError";
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
import { PhilippineAddressSelector } from "@/shared/components/PhilippineAddressSelector";

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
    formState: { errors },
  } = useFormContext<EnrollmentFormData>();

  const data = watch();
  const hasNoMother = data.hasNoMother;
  const hasNoFather = data.hasNoFather;
  const isPermanentSameAsCurrent = data.isPermanentSameAsCurrent;
  const isGuardianRequired = hasNoMother && hasNoFather;

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
    } else if (data.primaryContact === "FATHER") {
      setValue("father.contactNumber", data.contactNumber, {
        shouldValidate: false,
      });
    } else if (data.primaryContact === "GUARDIAN") {
      setValue("guardian.contactNumber", data.contactNumber, {
        shouldValidate: false,
      });
    }
  }, [data.primaryContact, data.contactNumber, setValue]);

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
        <AlertDescription className="font-extrabold text-primary/80">
          Please make sure contact details are active and correct for school
          updates and enrollment notices.
        </AlertDescription>
      </Alert>

      <div className="space-y-8">
        <h3 className="text-base leading-tight font-extrabold uppercase  text-primary">
          Current Home Address
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <Label
              htmlFor="currentAddress.houseNo"
              className="text-base font-extrabold uppercase">
              House No. / Street
            </Label>
            <Input
              autoComplete="off"
              id="currentAddress.houseNo"
              {...register("currentAddress.houseNo")}
              className="h-11 font-extrabold uppercase"
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
              className="text-base font-extrabold uppercase">
              Sitio / Purok
            </Label>
            <Input
              autoComplete="off"
              id="currentAddress.street"
              {...register("currentAddress.street")}
              className="h-11 font-extrabold uppercase"
              placeholder="e.g. RIZAL STREET"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
          </div>
        </div>

        <PhilippineAddressSelector
          value={{
            region: data.currentAddress?.region ?? "",
            province: data.currentAddress?.province ?? "",
            cityMunicipality: data.currentAddress?.cityMunicipality ?? "",
            barangay: data.currentAddress?.barangay ?? "",
          }}
          onChange={(field, val) =>
            setValue(`currentAddress.${field}`, val, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
          errors={{
            region: errors.currentAddress?.region?.message,
            province: errors.currentAddress?.province?.message,
            cityMunicipality: errors.currentAddress?.cityMunicipality?.message,
            barangay: errors.currentAddress?.barangay?.message,
          }}
          required
        />

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
            className="text-base leading-tight font-extrabold cursor-pointer select-none">
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
                <h3 className="text-base leading-tight font-extrabold uppercase  text-primary">
                  Permanent Address
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="permanentAddress.houseNo"
                      className="text-base font-extrabold uppercase">
                      House No. / Street
                    </Label>
                    <Input
                      autoComplete="off"
                      id="permanentAddress.houseNo"
                      {...register("permanentAddress.houseNo")}
                      className="h-11 font-extrabold uppercase"
                      placeholder="e.g. 456"
                      onInput={(e) => {
                        (e.target as HTMLInputElement).value = (
                          e.target as HTMLInputElement
                        ).value.toUpperCase();
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="permanentAddress.street"
                      className="text-base font-extrabold uppercase">
                      Sitio / Purok
                    </Label>
                    <Input
                      autoComplete="off"
                      id="permanentAddress.street"
                      {...register("permanentAddress.street")}
                      className="h-11 font-extrabold uppercase"
                      placeholder="e.g. MAGSAYSAY BLVD"
                      onInput={(e) => {
                        (e.target as HTMLInputElement).value = (
                          e.target as HTMLInputElement
                        ).value.toUpperCase();
                      }}
                    />
                  </div>
                </div>

                <PhilippineAddressSelector
                  value={{
                    region: data.permanentAddress?.region ?? "",
                    province: data.permanentAddress?.province ?? "",
                    cityMunicipality:
                      data.permanentAddress?.cityMunicipality ?? "",
                    barangay: data.permanentAddress?.barangay ?? "",
                  }}
                  onChange={(field, val) =>
                    setValue(`permanentAddress.${field}`, val, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  errors={{
                    region: errors.permanentAddress?.region?.message,
                    province: errors.permanentAddress?.province?.message,
                    cityMunicipality:
                      errors.permanentAddress?.cityMunicipality?.message,
                    barangay: errors.permanentAddress?.barangay?.message,
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="opacity-50" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base leading-tight font-extrabold uppercase  text-primary">
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
                className="text-base font-extrabold uppercase text-foreground cursor-pointer">
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
                className="text-base font-extrabold uppercase">
                Last Name{" "}
                {!hasNoMother && <span className="text-destructive">*</span>}
              </Label>
              <Input
                autoComplete="off"
                id="mother.lastName"
                {...register("mother.lastName")}
                disabled={hasNoMother}
                className={cn(
                  "h-11 uppercase font-extrabold",
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
                <p className="text-base text-destructive font-extrabold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.mother.lastName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="mother.firstName"
                className="text-base font-extrabold uppercase">
                First Name{" "}
                {!hasNoMother && <span className="text-destructive">*</span>}
              </Label>
              <Input
                autoComplete="off"
                id="mother.firstName"
                {...register("mother.firstName")}
                disabled={hasNoMother}
                className={cn(
                  "h-11 uppercase font-extrabold",
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
                <p className="text-base text-destructive font-extrabold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.mother.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="mother.middleName"
                className="text-base font-extrabold uppercase">
                Middle Name
              </Label>
              <Input
                autoComplete="off"
                id="mother.middleName"
                {...register("mother.middleName")}
                disabled={hasNoMother}
                className="h-11 uppercase font-extrabold"
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
            <h3 className="text-base leading-tight font-extrabold uppercase  text-primary">
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
                className="text-base font-extrabold uppercase text-foreground cursor-pointer">
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
                className="text-base font-extrabold uppercase">
                Last Name{" "}
                {!hasNoFather && <span className="text-destructive">*</span>}
              </Label>
              <Input
                autoComplete="off"
                id="father.lastName"
                {...register("father.lastName")}
                disabled={hasNoFather}
                className={cn(
                  "h-11 uppercase font-extrabold",
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
                <p className="text-base text-destructive font-extrabold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.father.lastName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="father.firstName"
                className="text-base font-extrabold uppercase">
                First Name{" "}
                {!hasNoFather && <span className="text-destructive">*</span>}
              </Label>
              <Input
                autoComplete="off"
                id="father.firstName"
                {...register("father.firstName")}
                disabled={hasNoFather}
                className={cn(
                  "h-11 uppercase font-extrabold",
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
                <p className="text-base text-destructive font-extrabold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.father.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="father.middleName"
                className="text-base font-extrabold uppercase">
                Middle Name
              </Label>
              <Input
                autoComplete="off"
                id="father.middleName"
                {...register("father.middleName")}
                disabled={hasNoFather}
                className="h-11 uppercase font-extrabold"
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
        <h3 className="text-base leading-tight font-extrabold uppercase  text-primary">
          Guardian Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <Label
              htmlFor="guardian.lastName"
              className="text-base font-extrabold uppercase">
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
                "h-11 uppercase font-extrabold",
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
              <p className="text-base text-destructive font-extrabold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.guardian.lastName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="guardian.firstName"
              className="text-base font-extrabold uppercase">
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
                "h-11 uppercase font-extrabold",
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
              <p className="text-base text-destructive font-extrabold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.guardian.firstName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="guardianRelationship"
              className="text-base font-extrabold uppercase">
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
                "h-11 font-extrabold uppercase",
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
            <AnimatedError error={errors.guardianRelationship?.message as string || errors.guardianRelationship as unknown as string} />
          </div>
        </div>
      </div>

      {activeContactsCount > 0 && (
        <>
          <Separator className="opacity-50" />

      <div className="space-y-4">
        <Label className="text-base leading-tight font-extrabold uppercase  text-primary">
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
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all group",
                    data.primaryContact === option.value
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-muted hover:bg-muted/50",
                  )}>
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                      data.primaryContact === option.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground group-hover:bg-primary/10 group-hover:text-primary",
                    )}>
                    <option.icon className="w-6 h-6" />
                  </div>
                  <span
                    className={cn(
                      "font-extrabold text-base leading-tight uppercase  text-center",
                      data.primaryContact === option.value
                        ? "text-primary"
                        : "text-foreground",
                    )}>
                    {displayLabel}
                  </span>
                </button>
              );
            })}
        </div>

        <AnimatedError error={errors.primaryContact?.message as string || errors.primaryContact as unknown as string} />
      </div>

      <div className="space-y-10">
        <div className="space-y-6">
          <h3 className="text-base leading-tight font-extrabold uppercase  text-primary">
            Contact Details
          </h3>

          {!data.primaryContact && (
            <p className="text-base leading-tight text-foreground italic font-bold">
              Select a primary contact above before entering contact details.
            </p>
          )}


          <div
            className={cn(
              "grid grid-cols-1 gap-8 items-start",
              [motherInfoFilled, fatherInfoFilled, guardianInfoFilled].filter(Boolean).length >= 3
                ? "md:grid-cols-3"
                : [motherInfoFilled, fatherInfoFilled, guardianInfoFilled].filter(Boolean).length === 2
                  ? "md:grid-cols-2"
                  : "md:grid-cols-1"
            )}>
            {data.primaryContact && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <h4 className="text-base leading-tight font-extrabold uppercase  text-primary">
                    Primary Contact
                  </h4>
                  <Label className="text-base font-extrabold uppercase text-foreground  flex items-center gap-2">
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
                      className="text-base font-extrabold uppercase flex items-center gap-1">
                      Contact Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="contactNumber"
                      {...register("contactNumber")}
                      placeholder="09XX-XXX-XXXX"
                      className={cn(
                        "h-11 font-extrabold bg-muted",
                        errors.contactNumber &&
                        "border-destructive focus-visible:ring-destructive",
                      )}
                      inputMode="tel"
                      maxLength={13}
                      onInput={(event) => {
                        const input = event.target as HTMLInputElement;
                        input.value = formatContactNumber(input.value);
                      }}
                    />
                    <AnimatedError error={errors.contactNumber?.message as string || errors.contactNumber as unknown as string} />
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

                return (
                  <div
                    key={secondary.id}
                    className="space-y-4 transition-opacity duration-0 opacity-70 hover:opacity-100 focus-within:opacity-100">
                    <div className="flex flex-col gap-1">
                      <h4 className="text-base leading-tight font-extrabold uppercase  text-foreground">
                        Secondary Contact (Optional)
                      </h4>
                      <Label className="text-base font-extrabold uppercase text-foreground/60  flex items-center gap-2">
                        <secondary.icon className="w-3 h-3" />
                        {secondary.label}'s Contact Information
                      </Label>
                    </div>

                    <div className="grid grid-cols-1 gap-6 p-5 rounded-2xl border border-border bg-muted/20 shadow-sm">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor={contactField}
                          className="text-base font-extrabold uppercase">
                          Contact Number
                        </Label>
                        <Input
                          id={contactField}
                          {...register(contactField)}
                          placeholder="09XX-XXX-XXXX"
                          className="h-11 font-extrabold bg-muted"
                          inputMode="tel"
                          maxLength={13}
                          onInput={(event) => {
                            const input = event.target as HTMLInputElement;
                            input.value = formatContactNumber(input.value);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
