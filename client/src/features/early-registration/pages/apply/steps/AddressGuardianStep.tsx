import { useFormContext } from "react-hook-form";
import type { EarlyRegFormData } from "../types";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Info, UserPlus, AlertCircle, User, Venus, Mars } from "lucide-react";
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

  return (
    <div className="space-y-12">
      <Alert className="bg-primary/5 border-primary/20 items-center">
        <Info className="h-4 w-4 stroke-primary" />
        <AlertDescription className="font-bold text-primary/80">
          Important: Please ensure all contact details are accurate for
          registration updates.
        </AlertDescription>
      </Alert>

      {/* Address Information */}
      <div className="space-y-8">
        <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
          Current Address
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
              placeholder="E.G. 123 RIZAL ST."
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
              placeholder="E.G. PUROK 3"
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
              placeholder="E.G. BARANGAY 1"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
            {errors.barangay && (
              <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
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
              placeholder="E.G. QUEZON CITY"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
            {errors.cityMunicipality && (
              <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
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
              placeholder="E.G. METRO MANILA"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
            {errors.province && (
              <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
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
              Mother&apos;s Maiden Name
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
                    setValue("mother.maidenName", "N/A");
                    setValue("mother.firstName", "N/A");
                    setValue("mother.middleName", "N/A");
                    clearErrors(["mother.maidenName", "mother.firstName"]);
                  } else {
                    setValue("mother.maidenName", "");
                    setValue("mother.firstName", "");
                    setValue("mother.middleName", "");
                  }
                }}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label
                htmlFor="hasNoMother"
                className="text-[0.625rem] font-bold uppercase text-muted-foreground cursor-pointer">
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
                <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
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
                <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
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
                placeholder="N/A"
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
              Father&apos;s Information
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
                    setValue("father.lastName", "N/A");
                    setValue("father.firstName", "N/A");
                    setValue("father.middleName", "N/A");
                    clearErrors(["father.lastName", "father.firstName"]);
                  } else {
                    setValue("father.lastName", "");
                    setValue("father.firstName", "");
                    setValue("father.middleName", "");
                  }
                }}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label
                htmlFor="hasNoFather"
                className="text-[0.625rem] font-bold uppercase text-muted-foreground cursor-pointer">
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
                <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
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
                <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
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
                placeholder="N/A"
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
          <UserPlus className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
            Guardian Information (If different from parents)
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <Label
              htmlFor="guardian.lastName"
              className="text-xs font-bold uppercase">
              Last Name {isGuardianRequired && <span className="text-destructive">*</span>}
            </Label>
            <Input
              autoComplete="off"
              id="guardian.lastName"
              {...register("guardian.lastName")}
              className={cn(
                "h-11 uppercase font-bold",
                errors.guardian?.lastName && "border-destructive focus-visible:ring-destructive",
              )}
              placeholder="e.g. DELA CRUZ"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
            {errors.guardian?.lastName && (
              <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.guardian.lastName.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="guardian.firstName"
              className="text-xs font-bold uppercase">
              First Name {isGuardianRequired && <span className="text-destructive">*</span>}
            </Label>
            <Input
              autoComplete="off"
              id="guardian.firstName"
              {...register("guardian.firstName")}
              className={cn(
                "h-11 uppercase font-bold",
                errors.guardian?.firstName && "border-destructive focus-visible:ring-destructive",
              )}
              placeholder="e.g. MARCELO"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
            {errors.guardian?.firstName && (
              <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.guardian.firstName.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="guardianRelationship"
              className="text-xs font-bold uppercase">
              Relationship {isGuardianRequired && <span className="text-destructive">*</span>}
            </Label>
            <Input
              autoComplete="off"
              id="guardianRelationship"
              {...register("guardianRelationship")}
              className={cn(
                "h-11 font-bold uppercase",
                errors.guardianRelationship && "border-destructive focus-visible:ring-destructive",
              )}
              placeholder="e.g. GRANDPARENT"
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
            {errors.guardianRelationship && (
              <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.guardianRelationship.message}
              </p>
            )}
          </div>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Contact Information */}
      <div className="space-y-10">
        <div className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
            Contact Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label htmlFor="contactNumber" className="text-sm font-semibold">
                Contact Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contactNumber"
                {...register("contactNumber")}
                placeholder="09XX-XXX-YYYY"
                className={cn(
                  "h-11 font-bold",
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
                <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.contactNumber.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-semibold">
                Email Address
              </Label>
              <Input
                id="email"
                {...register("email")}
                type="email"
                placeholder="email@example.com"
                className={cn(
                  "h-11 font-bold",
                  errors.email &&
                    "border-destructive focus-visible:ring-destructive",
                )}
              />
              {errors.email && (
                <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-sm font-bold uppercase tracking-widest text-primary">
            Who should we contact? <span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(
              [
                { value: "MOTHER", label: "Mother", icon: Venus },
                { value: "FATHER", label: "Father", icon: Mars },
                { value: "GUARDIAN", label: "Guardian", icon: User },
              ] as const
            ).map((opt) => {
              const firstName = opt.value === "MOTHER" 
                ? data.mother?.firstName 
                : opt.value === "FATHER" 
                  ? data.father?.firstName 
                  : data.guardian?.firstName;
              const displayLabel = firstName && firstName !== "N/A" 
                ? `${opt.label} (${firstName})` 
                : opt.label;

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setValue("primaryContact", opt.value as any, {
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
            <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.primaryContact.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
