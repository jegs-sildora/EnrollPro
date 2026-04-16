import { useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import type { EarlyRegFormData } from "../types";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Button } from "@/shared/ui/button";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import {
  ShieldCheck,
  User,
  Home,
  Users,
  Info,
  Edit2,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { formatScpType } from "@/shared/lib/utils";

interface LegalConsentStepProps {
  isSubmitting: boolean;
  onEdit: (stepId: number) => void;
  onConfirmSubmit: () => void;
}

const SummaryCard = ({
  title,
  icon: Icon,
  stepId,
  onEdit,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  stepId: number;
  onEdit: (id: number) => void;
  children: React.ReactNode;
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
    <p className="text-base font-bold uppercase text-muted-foreground tracking-tight">
      {label}
    </p>
    <p className="text-base font-bold text-foreground truncate uppercase">
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

export default function LegalConsentStep({
  isSubmitting,
  onEdit,
  onConfirmSubmit,
}: LegalConsentStepProps) {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<EarlyRegFormData>();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  const data = watch();

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <SummaryCard
          title="Basic Information"
          icon={ClipboardList}
          stepId={1}
          onEdit={onEdit}>
          <DataItem label="School Year" value={data.schoolYear} />
          <DataItem
            label="Grade Level to Enroll"
            value={`Grade ${data.gradeLevel}`}
          />
          <DataItem
            label="Learner Type"
            value={data.learnerType?.replace("_", " ")}
          />
          <DataItem label="LEARNER REFERENCE NUMBER" value={data.lrn} />
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

        <SummaryCard
          title="Learner Profile"
          icon={User}
          stepId={2}
          onEdit={onEdit}>
          {data.studentPhoto && (
            <div className="sm:col-span-2 flex justify-center pb-2">
              <div className="w-24 h-24 rounded-lg border-2 border-dashed border-primary/50 bg-background overflow-hidden">
                <img
                  src={data.studentPhoto}
                  alt="Student"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
          <DataItem
            label="Full Name"
            value={`${data.lastName}, ${data.firstName} ${data.middleName || ""} ${data.extensionName || ""}`}
          />
          <DataItem label="Sex at Birth" value={data.sex} />
          <DataItem
            label="Birthdate"
            value={
              data.birthdate
                ? format(new Date(data.birthdate), "MMMM dd, yyyy")
                : ""
            }
          />
          <DataItem
            label="IP Community"
            value={data.isIpCommunity ? `YES (${data.ipGroupName})` : "NO"}
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
          title="Address and Contact"
          icon={Home}
          stepId={3}
          onEdit={onEdit}>
          <DataItem label="Barangay" value={data.barangay} />
          <DataItem label="City/Municipality" value={data.cityMunicipality} />
          <DataItem label="Province" value={data.province} />

          <div className="sm:col-span-2 mt-2 pt-2 border-t border-border/40 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DataItem
                label={`Primary Contact (${data.primaryContact?.toLowerCase()})`}
                value={data.contactNumber}
              />
              <DataItem label="Primary Email" value={data.email} noUppercase />
            </div>

            {/* Secondary Contacts */}
            {data.mother?.contactNumber && data.primaryContact !== "MOTHER" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-70">
                <DataItem
                  label="Mother's Contact #"
                  value={data.mother.contactNumber}
                />
                <DataItem
                  label="Mother's Email"
                  value={data.mother.email}
                  noUppercase
                />
              </div>
            )}
            {data.father?.contactNumber && data.primaryContact !== "FATHER" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-70">
                <DataItem
                  label="Father's Contact #"
                  value={data.father.contactNumber}
                />
                <DataItem
                  label="Father's Email"
                  value={data.father.email}
                  noUppercase
                />
              </div>
            )}
            {data.guardian?.contactNumber &&
              data.primaryContact !== "GUARDIAN" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-70">
                  <DataItem
                    label="Guardian's Contact #"
                    value={data.guardian.contactNumber}
                  />
                  <DataItem
                    label="Guardian's Email"
                    value={data.guardian.email}
                    noUppercase
                  />
                </div>
              )}
          </div>
        </SummaryCard>

        <SummaryCard
          title="Parent and Guardian"
          icon={Users}
          stepId={3}
          onEdit={onEdit}>
          <DataItem
            label="Mother's Maiden Name"
            value={
              data.hasNoMother
                ? "Information not available"
                : `${data.mother?.firstName} ${data.mother?.maidenName}`
            }
          />
          <DataItem
            label="Father's Name"
            value={
              data.hasNoFather
                ? "Information not available"
                : `${data.father?.firstName} ${data.father?.lastName}`
            }
          />
          {data.guardian?.firstName && (
            <DataItem
              label="Guardian"
              value={`${data.guardian?.firstName} ${data.guardian?.lastName} (${data.guardianRelationship})`}
            />
          )}
          {data.primaryContact && (
            <DataItem
              label="Primary Contact Person"
              value={data.primaryContact}
            />
          )}
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
              name="isPrivacyConsentGiven"
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
                        I confirm that all information in this form is true,
                        correct, and complete to the best of my knowledge. I
                        understand that false information may affect enrollment.
                      </p>
                    </Label>
                  </div>
                  {errors.isPrivacyConsentGiven?.message && (
                    <p className="text-[0.6875rem] text-destructive font-bold pl-14">
                      {errors.isPrivacyConsentGiven.message}
                    </p>
                  )}
                </div>
              )}
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <Button
            type="button"
            className="w-full h-14 text-lg font-bold transition-all bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
            disabled={isSubmitting}
            onClick={() => setIsConfirmDialogOpen(true)}>
            Submit Registration
          </Button>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <Info className="w-3.5 h-3.5" />
            Data Privacy consent was recorded before this form.
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
        title="Confirm Registration Submission"
        description="You are about to submit this registration form. Please confirm that all details are complete and correct."
        onConfirm={onConfirmSubmit}
        confirmText="Yes, Submit Registration"
        loading={isSubmitting}
        variant="primary"
      />
    </div>
  );
}
