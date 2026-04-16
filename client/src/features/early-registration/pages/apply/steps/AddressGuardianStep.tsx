import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import type { EarlyRegFormData } from "../types";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Info, AlertCircle, User, Venus, Mars } from "lucide-react";
import { Separator } from "@/shared/ui/separator";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { cn } from "@/shared/lib/utils";

export default function AddressGuardianStep() {
  const {
    register,
    watch,
    setValue,
    clearErrors,
    formState: { errors },
  } = useFormContext<EarlyRegFormData>();

  const data = watch();
  const hasNoMother = data.hasNoMother;
  const hasNoFather = data.hasNoFather;
  const isGuardianRequired = hasNoMother && hasNoFather;

  // Sync primary contact's info to the corresponding guardian object
  useEffect(() => {
    if (data.primaryContact === "MOTHER") {
      setValue("mother.contactNumber", data.contactNumber);
      setValue("mother.email", data.email);
    } else if (data.primaryContact === "FATHER") {
      setValue("father.contactNumber", data.contactNumber);
      setValue("father.email", data.email);
    } else if (data.primaryContact === "GUARDIAN") {
      setValue("guardian.contactNumber", data.contactNumber);
      setValue("guardian.email", data.email);
    }
  }, [data.primaryContact, data.contactNumber, data.email, setValue]);

  const motherInfoFilled =
    !hasNoMother &&
    data.mother?.firstName?.trim() &&
    data.mother?.maidenName?.trim();

  const fatherInfoFilled =
    !hasNoFather &&
    data.father?.firstName?.trim() &&
    data.father?.lastName?.trim();

  const guardianInfoFilled =
    data.guardian?.firstName?.trim() && data.guardian?.lastName?.trim();

  const activeContactsCount = [
    motherInfoFilled,
    fatherInfoFilled,
    guardianInfoFilled,
  ].filter(Boolean).length;

  return (
    <div className="space-y-12">
      <Alert className="bg-primary/5 border-primary/20 items-center">
        <Info className="h-4 w-4 stroke-primary" />
        <AlertDescription className="font-bold text-primary/80">
          Please make sure contact details are active and correct for school
          updates.
        </AlertDescription>
      </Alert>

      {/* Address Information */}
      <div className="space-y-8">
        <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
          Current Home Address
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <Label
              htmlFor="houseNoStreet"
              className="text-xs font-bold uppercase">
              House No. / Street
            </Label>
            <Input
              autoComplete="off"
              id="houseNoStreet"
              {...register("houseNoStreet")}
              className="h-11 font-bold uppercase"
              placeholder="e.g. 123 RIZAL ST"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sitio" className="text-xs font-bold uppercase">
              Sitio / Purok
            </Label>
            <Input
              autoComplete="off"
              id="sitio"
              {...register("sitio")}
              className="h-11 font-bold uppercase"
              placeholder="e.g. PUROK 3"
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
            <Label htmlFor="barangay" className="text-xs font-bold uppercase">
              Barangay <span className="text-destructive">*</span>
            </Label>
            <Input
              autoComplete="off"
              id="barangay"
              {...register("barangay")}
              className={cn(
                "h-11 font-bold uppercase",
                errors.barangay &&
                  "border-destructive focus-visible:ring-destructive",
              )}
              placeholder="e.g. BARANGAY 1"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
            {errors.barangay && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.barangay.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="cityMunicipality"
              className="text-xs font-bold uppercase">
              City / Municipality <span className="text-destructive">*</span>
            </Label>
            <Input
              autoComplete="off"
              id="cityMunicipality"
              {...register("cityMunicipality")}
              className={cn(
                "h-11 font-bold uppercase",
                errors.cityMunicipality &&
                  "border-destructive focus-visible:ring-destructive",
              )}
              placeholder="e.g. QUEZON CITY"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
            {errors.cityMunicipality && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.cityMunicipality.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="province" className="text-xs font-bold uppercase">
              Province <span className="text-destructive">*</span>
            </Label>
            <Input
              autoComplete="off"
              id="province"
              {...register("province")}
              className={cn(
                "h-11 font-bold uppercase",
                errors.province &&
                  "border-destructive focus-visible:ring-destructive",
              )}
              placeholder="e.g. METRO MANILA"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
            {errors.province && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.province.message}
              </p>
            )}
          </div>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Parents Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Mother Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
              Mother&apos;s Details
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hasNoMother"
                {...register("hasNoMother")}
                onChange={(e) => {
                  const val = e.target.checked;
                  setValue("hasNoMother", val);
                  if (val) {
                    setValue("mother.maidenName", "Information not available");
                    setValue("mother.firstName", "Information not available");
                    setValue("mother.middleName", "Information not available");
                    clearErrors(["mother.maidenName", "mother.firstName"]);
                  } else {
                    setValue("mother.maidenName", "");
                    setValue("mother.firstName", "");
                    setValue("mother.middleName", "");
                  }
                }}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
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
                htmlFor="mother.maidenName"
                className="text-xs font-bold uppercase">
                Maiden Last Name{" "}
                {!hasNoMother && <span className="text-destructive">*</span>}
              </Label>
              <Input
                autoComplete="off"
                id="mother.maidenName"
                {...register("mother.maidenName")}
                disabled={hasNoMother}
                className={cn(
                  "h-11 uppercase font-bold",
                  errors.mother?.maidenName &&
                    "border-destructive focus-visible:ring-destructive",
                )}
                placeholder={hasNoMother ? "N/A" : "e.g. DELA CRUZ"}
                onInput={(e) => {
                  (e.target as HTMLInputElement).value = (
                    e.target as HTMLInputElement
                  ).value.toUpperCase();
                }}
              />
              {errors.mother?.maidenName && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.mother.maidenName.message}
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
                placeholder="e.g. AQUILLA or N/A"
                onInput={(e) => {
                  (e.target as HTMLInputElement).value = (
                    e.target as HTMLInputElement
                  ).value.toUpperCase();
                }}
              />
            </div>
          </div>
        </div>

        {/* Father Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
              Father&apos;s Details
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hasNoFather"
                {...register("hasNoFather")}
                onChange={(e) => {
                  const val = e.target.checked;
                  setValue("hasNoFather", val);
                  if (val) {
                    setValue("father.lastName", "Information not available");
                    setValue("father.firstName", "Information not available");
                    setValue("father.middleName", "Information not available");
                    clearErrors(["father.lastName", "father.firstName"]);
                  } else {
                    setValue("father.lastName", "");
                    setValue("father.firstName", "");
                    setValue("father.middleName", "");
                  }
                }}
                className="w-4 h-4 rounded border-primary text-primary focus:ring-primary accent-primary"
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

      {/* Guardian Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
            Guardian Details
          </h3>
        </div>
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
            .filter((opt) => !opt.hide)
            .map((opt) => {
              const firstName =
                opt.value === "MOTHER"
                  ? data.mother?.firstName
                  : opt.value === "FATHER"
                    ? data.father?.firstName
                    : data.guardian?.firstName;

              const displayLabel =
                firstName &&
                firstName !== "N/A" &&
                firstName !== "Information not available"
                  ? `${opt.label} (${firstName})`
                  : opt.label;

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setValue("primaryContact", opt.value, {
                      shouldValidate: true,
                    })
                  }
                  className={cn(
                    "flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all group",
                    watch("primaryContact") === opt.value
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-white hover:bg-muted/50",
                  )}>
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                      watch("primaryContact") === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                    )}>
                    <opt.icon className="w-6 h-6" />
                  </div>
                  <span
                    className={cn(
                      "font-bold text-sm uppercase tracking-wider text-center",
                      watch("primaryContact") === opt.value
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

      {/* Contact Information */}
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

          <div
            className={cn(
              "grid grid-cols-1 gap-8 items-start",
              motherInfoFilled && fatherInfoFilled && guardianInfoFilled
                ? "md:grid-cols-3"
                : "md:grid-cols-2",
            )}>
            {/* 1. Primary Contact Block */}
            {data.primaryContact && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-primary">
                    Primary Contact
                  </h4>
                  <Label className="text-[0.625rem] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
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
                      onInput={(e) => {
                        const input = e.target as HTMLInputElement;
                        let val = input.value.replace(/\D/g, "");
                        if (val.length > 11) val = val.slice(0, 11);
                        if (val.length > 7) {
                          val = `${val.slice(0, 4)}-${val.slice(4, 7)}-${val.slice(7)}`;
                        } else if (val.length > 4) {
                          val = `${val.slice(0, 4)}-${val.slice(4)}`;
                        }
                        input.value = val;
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
                      Email Address (Email Address)
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

            {/* 2. Secondary Contact(s) Block */}
            <>
              {(
                [
                  {
                    id: "mother",
                    label: "Mother",
                    icon: Venus,
                    active:
                      motherInfoFilled && data.primaryContact !== "MOTHER",
                    path: "mother",
                  },
                  {
                    id: "father",
                    label: "Father",
                    icon: Mars,
                    active:
                      fatherInfoFilled && data.primaryContact !== "FATHER",
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
                .filter((s) => s.active)
                .map((s) => {
                  const contactField = `${s.path}.contactNumber` as
                    | "mother.contactNumber"
                    | "father.contactNumber"
                    | "guardian.contactNumber";
                  const emailField = `${s.path}.email` as
                    | "mother.email"
                    | "father.email"
                    | "guardian.email";

                  return (
                    <div
                      key={s.id}
                      className="space-y-4 transition-opacity duration-300 opacity-70 hover:opacity-100 focus-within:opacity-100">
                      <div className="flex flex-col gap-1">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                          Secondary Contact (Optional)
                        </h4>
                        <Label className="text-[0.625rem] font-black uppercase text-muted-foreground/60 tracking-widest flex items-center gap-2">
                          <s.icon className="w-3 h-3" /> {s.label}'s Contact
                          Information
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
                            onInput={(e) => {
                              const input = e.target as HTMLInputElement;
                              let val = input.value.replace(/\D/g, "");
                              if (val.length > 11) val = val.slice(0, 11);
                              if (val.length > 7) {
                                val = `${val.slice(0, 4)}-${val.slice(4, 7)}-${val.slice(7)}`;
                              } else if (val.length > 4) {
                                val = `${val.slice(0, 4)}-${val.slice(4)}`;
                              }
                              input.value = val;
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label
                            htmlFor={emailField}
                            className="text-xs font-bold uppercase">
                            Email Address (Email Address)
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
            </>
          </div>
        </div>
      </div>
    </div>
  );
}
