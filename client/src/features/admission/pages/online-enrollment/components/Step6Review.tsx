import { useState, type ComponentType, type ReactNode } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { format } from "date-fns";
import {
  ClipboardList,
  Edit2,
  Info,
  School,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";

import type { EnrollmentFormData } from "../types";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { cn, formatScpType } from "@/shared/lib/utils";

interface Step6ReviewProps {
  onEdit: (stepId: number) => void;
  onSubmitClick?: () => void;
  isSubmitting?: boolean;
}

const SummaryCard = ({
  title,
  icon: Icon,
  stepId,
  onEdit,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  stepId: number;
  onEdit: (id: number) => void;
  children: ReactNode;
}) => (
  <div className="border border-border/60 rounded-2xl overflow-hidden bg-white shadow-sm">
    <div className="px-5 py-3 bg-muted/30 border-b border-border/40 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/70">
          {title}
        </h4>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onEdit(stepId)}
        className="h-7 text-[0.625rem] font-bold uppercase text-primary hover:text-primary hover:bg-primary/5 gap-1">
        <Edit2 className="w-3 h-3" /> Edit
      </Button>
    </div>
    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
      {children}
    </div>
  </div>
);

const DataItem = ({
  label,
  value,
  noUppercase,
}: {
  label: string;
  value: string | number | undefined | null;
  noUppercase?: boolean;
}) => (
  <div className="space-y-0.5">
    <p className="text-[0.625rem] font-bold uppercase text-muted-foreground tracking-tight">
      {label}
    </p>
    <p className="font-bold text-foreground truncate">
      {value
        ? noUppercase
          ? value
          : typeof value === "string"
            ? value.toUpperCase()
            : value
        : "NOT PROVIDED"}
    </p>
  </div>
);

export default function Step6Review({
  onEdit,
  isSubmitting,
  onSubmitClick,
}: Step6ReviewProps) {
  const {
    register,
    watch,
    control,
    formState: { errors },
  } = useFormContext<EnrollmentFormData>();

  const data = watch();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const generalAverageDisplay =
    typeof data.generalAverage === "number"
      ? Number(data.generalAverage).toFixed(2)
      : undefined;

  const fullName =
    `${data.lastName || ""}, ${data.firstName || ""}${data.middleName && data.middleName !== "N/A" ? ` ${data.middleName}` : ""}${data.extensionName && data.extensionName !== "N/A" ? ` ${data.extensionName}` : ""}`.trim();

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <SummaryCard
          title="Personal Information"
          icon={User}
          stepId={1}
          onEdit={onEdit}>
          {data.studentPhoto && (
            <div className="sm:col-span-2 flex justify-center pb-2">
              <div className="relative w-48 h-48 rounded-lg overflow-hidden border-2 border-dashed border-primary shadow-sm">
                <img
                  src={data.studentPhoto}
                  alt="Student"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
          <DataItem label="Full Name" value={fullName} />
          <DataItem
            label="Birthdate"
            value={data.birthdate ? format(data.birthdate, "MMMM d, yyyy") : ""}
          />
          <DataItem
            label="Sex and Age"
            value={`${data.sex || ""}${data.age ? ` (${data.age} years old)` : ""}`}
          />
          <DataItem
            label="LRN"
            value={data.hasNoLrn ? "NO LRN DECLARED" : data.lrn}
          />
        </SummaryCard>

        <SummaryCard
          title="Address and Contact"
          icon={Users}
          stepId={2}
          onEdit={onEdit}>
          <DataItem
            label="Current Address"
            value={`${data.currentAddress?.barangay || ""}, ${data.currentAddress?.cityMunicipality || ""}, ${data.currentAddress?.province || ""}`}
          />
          <DataItem
            label="Primary Contact"
            value={data.primaryContact?.replace("_", " ")}
          />
          <DataItem label="Primary Contact Number" value={data.contactNumber} />
          <DataItem label="Primary Email" value={data.email} noUppercase />
          <DataItem
            label="Mother"
            value={`${data.mother?.firstName || ""} ${data.mother?.lastName || ""}`}
          />
          <DataItem
            label="Father"
            value={`${data.father?.firstName || ""} ${data.father?.lastName || ""}`}
          />
          <DataItem
            label="Guardian"
            value={
              data.guardian?.firstName || data.guardian?.lastName
                ? `${data.guardian?.firstName || ""} ${data.guardian?.lastName || ""}`
                : ""
            }
          />
          <DataItem
            label="Guardian Relationship"
            value={data.guardianRelationship || data.guardian?.relationship}
          />
        </SummaryCard>

        <SummaryCard
          title="Background"
          icon={ShieldCheck}
          stepId={3}
          onEdit={onEdit}>
          <DataItem
            label="IP Community"
            value={
              data.isIpCommunity
                ? `YES (${data.ipGroupName || "UNSPECIFIED"})`
                : "NO"
            }
          />
          <DataItem
            label="4Ps Beneficiary"
            value={
              data.is4PsBeneficiary
                ? `YES (${data.householdId4Ps || "UNSPECIFIED"})`
                : "NO"
            }
          />
          <DataItem
            label="Balik-Aral"
            value={data.isBalikAral ? "YES" : "NO"}
          />
          <DataItem
            label="Disability"
            value={
              data.isLearnerWithDisability
                ? data.disabilityTypes?.join(", ")
                : "NONE"
            }
          />
        </SummaryCard>

        <SummaryCard
          title="Previous School"
          icon={School}
          stepId={4}
          onEdit={onEdit}>
          <DataItem label="Last School" value={data.lastSchoolName} />
          <DataItem
            label="Last Grade Completed"
            value={data.lastGradeCompleted}
          />
          <DataItem
            label="School Year Last Attended"
            value={data.schoolYearLastAttended}
          />
          <DataItem label="School Type" value={data.lastSchoolType} />
          <DataItem
            label="Final General Average (SF9)"
            value={generalAverageDisplay}
            noUppercase
          />
        </SummaryCard>

        <SummaryCard
          title="Enrollment Preferences"
          icon={ClipboardList}
          stepId={5}
          onEdit={onEdit}>
          <DataItem
            label="Grade Level"
            value={`Grade ${data.gradeLevel || ""}`}
          />
          <DataItem
            label="Learner Category"
            value={data.learnerType?.replaceAll("_", " ")}
          />
          <DataItem
            label="Learning Program"
            value={
              data.isScpApplication
                ? "Special Curricular Program (SCP)"
                : "Regular Section"
            }
            noUppercase
          />
          <DataItem
            label="Selected Program"
            value={
              data.isScpApplication && data.scpType
                ? formatScpType(data.scpType)
                : "Regular"
            }
            noUppercase
          />
        </SummaryCard>
      </div>

      <div className="pt-8 border-t border-border/60 space-y-6">
        <div className="p-6 bg-primary/5 border border-primary/10 rounded-2xl space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
              Accuracy Certification
            </h3>
          </div>

          <div className="flex items-start space-x-3">
            <Controller
              control={control}
              name="isCertifiedTrue"
              render={({ field }) => (
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-start gap-3">
                    <Switch
                      id="certify-check"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-1"
                    />
                    <Label
                      htmlFor="certify-check"
                      className="text-sm font-medium leading-relaxed cursor-pointer select-none space-y-3 block">
                      <p>
                        I certify that all information in this enrollment form
                        is true, correct, and complete to the best of my
                        knowledge. I understand that false information may
                        affect the learner&apos;s enrollment processing.
                      </p>
                    </Label>
                  </div>
                  {errors.isCertifiedTrue?.message && (
                    <p className="text-[0.6875rem] text-destructive font-bold pl-14">
                      {errors.isCertifiedTrue.message}
                    </p>
                  )}
                </div>
              )}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
              <Label
                htmlFor="parentGuardianSignature"
                className="text-[0.625rem] font-bold uppercase text-primary/60">
                Full Name of Parent / Guardian{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                autoComplete="off"
                id="parentGuardianSignature"
                {...register("parentGuardianSignature")}
                placeholder="Type your full name"
                className={cn(
                  "h-12 border-2 font-bold uppercase",
                  errors.parentGuardianSignature && "border-destructive",
                )}
              />
              {errors.parentGuardianSignature && (
                <p className="text-xs text-destructive font-bold">
                  {errors.parentGuardianSignature.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[0.625rem] font-bold uppercase text-primary/60">
                Date Accomplished
              </Label>
              <Input
                autoComplete="off"
                value={format(new Date(), "MMMM dd, yyyy")}
                readOnly
                className="h-12 bg-muted/50 font-bold text-muted-foreground cursor-not-allowed uppercase"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <Button
            type="button"
            className="w-full h-14 text-lg font-bold transition-all bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
            disabled={isSubmitting}
            onClick={() => setIsConfirmDialogOpen(true)}>
            Submit Application
          </Button>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium italic">
            <Info className="w-3.5 h-3.5" />
            Privacy consent was recorded before this submission.
          </p>
        </div>
      </div>

      <ConfirmationModal
        open={isConfirmDialogOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) {
            setIsConfirmDialogOpen(open);
          }
        }}
        title="Confirm Enrollment Submission"
        description="You are about to submit this online enrollment form. Please confirm all details are complete and accurate."
        onConfirm={() => onSubmitClick?.()}
        confirmText="Yes, Submit Application"
        loading={isSubmitting}
        variant="primary"
      />
    </div>
  );
}
