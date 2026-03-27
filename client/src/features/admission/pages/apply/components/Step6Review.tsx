import React from "react";
import { useFormContext, Controller } from "react-hook-form";
import type { EarlyRegistrationFormData } from "../types";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import { format } from "date-fns";
import {
  Edit2,
  ShieldCheck,
  User,
  Users,
  School,
  ClipboardList,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";

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
  icon: React.ComponentType<{ className?: string }>;
  stepId: number;
  onEdit: (id: number) => void;
  children: React.ReactNode;
}) => (
  <div className='border border-border/60 rounded-2xl overflow-hidden bg-white shadow-sm'>
    <div className='px-5 py-3 bg-muted/30 border-b border-border/40 flex items-center justify-between'>
      <div className='flex items-center gap-2'>
        <Icon className='w-4 h-4 text-primary' />
        <h4 className='text-xs font-bold uppercase tracking-wider text-foreground/70'>
          {title}
        </h4>
      </div>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        onClick={() => onEdit(stepId)}
        className='h-7 text-[10px] font-bold uppercase text-primary hover:text-primary hover:bg-primary/5 gap-1'>
        <Edit2 className='w-3 h-3' /> Edit
      </Button>
    </div>
    <div className='p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm'>
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
  <div className='space-y-0.5'>
    <p className='text-[10px] font-bold uppercase text-muted-foreground tracking-tight'>
      {label}
    </p>
    <p className='font-semibold text-foreground truncate'>
      {value
        ? noUppercase
          ? value
          : typeof value === "string"
            ? value.toUpperCase()
            : value
        : "----"}
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
  } = useFormContext<EarlyRegistrationFormData>();

  const { schoolName } = useSettingsStore();
  const data = watch();
  const yearLabel = data.schoolYear;

  return (
    <div className='space-y-8'>
      <div className='space-y-6'>
        <SummaryCard
          title='Personal Information'
          icon={User}
          stepId={1}
          onEdit={onEdit}>
          {data.studentPhoto && (
            <div className='sm:col-span-2 flex justify-center pb-2'>
              <div className='relative w-48 h-48 rounded-lg overflow-hidden border-2 border-dashed border-primary shadow-sm'>
                <img
                  src={data.studentPhoto}
                  alt='Student'
                  className='w-full h-full object-cover'
                />
              </div>
            </div>
          )}
          <DataItem
            label='Full Name'
            value={`${data.lastName}, ${data.firstName}${data.middleName && data.middleName !== "N/A" ? ` ${data.middleName}` : ""}${data.extensionName && data.extensionName !== "N/A" ? ` ${data.extensionName}` : ""}`}
          />
          <DataItem
            label='Birthdate'
            value={data.birthdate ? format(data.birthdate, "MMMM d, yyyy") : ""}
          />
          <DataItem
            label='Sex & Age'
            value={`${data.sex} (${data.age} years old)`}
          />
          <DataItem label='LRN' value={data.lrn} />
        </SummaryCard>

        <SummaryCard
          title='Family & Contact'
          icon={Users}
          stepId={2}
          onEdit={onEdit}>
          <DataItem
            label='Mother'
            value={`${data.mother?.firstName} ${data.mother?.lastName}`}
          />
          <DataItem
            label='Father'
            value={`${data.father?.firstName} ${data.father?.lastName}`}
          />
          <DataItem label='Primary Email' value={data.email} noUppercase />
          <DataItem
            label='Address'
            value={`${data.currentAddress?.barangay}, ${data.currentAddress?.cityMunicipality}`}
          />
        </SummaryCard>

        <SummaryCard
          title='Background'
          icon={ShieldCheck}
          stepId={3}
          onEdit={onEdit}>
          <DataItem
            label='IP Community'
            value={data.isIpCommunity ? `Yes (${data.ipGroupName})` : "No"}
          />
          <DataItem
            label='4Ps Beneficiary'
            value={
              data.is4PsBeneficiary ? `Yes (${data.householdId4Ps})` : "No"
            }
          />
          <DataItem
            label='Balik-Aral'
            value={data.isBalikAral ? "Yes" : "No"}
          />
          <DataItem
            label='Disability'
            value={
              data.isLearnerWithDisability
                ? data.disabilityTypes?.join(", ")
                : "None"
            }
          />
        </SummaryCard>

        <SummaryCard
          title='Previous School'
          icon={School}
          stepId={4}
          onEdit={onEdit}>
          <DataItem label='Last School' value={data.lastSchoolName} />
          <DataItem label='Last Grade' value={data.lastGradeCompleted} />
          <DataItem label='School Year' value={data.schoolYearLastAttended} />
          <DataItem label='School Type' value={data.lastSchoolType} />
        </SummaryCard>

        <SummaryCard
          title='Enrollment Preferences'
          icon={ClipboardList}
          stepId={5}
          onEdit={onEdit}>
          <DataItem label='Grade Level' value={`Grade ${data.gradeLevel}`} />
          <DataItem
            label='Program'
            value={
              data.isScpApplication ? `SCP (${data.scpType})` : "Regular Section"
            }
          />
          <DataItem label='Learner Type' value={data.learnerType} />
        </SummaryCard>
      </div>

      <div className='pt-10 border-t border-border/60 space-y-8'>
        <div className='p-6 bg-primary/5 border border-primary/10 rounded-2xl space-y-6'>
          <div className='flex items-center gap-2 mb-2'>
            <ShieldCheck className='w-5 h-5 text-primary' />
            <h3 className='text-sm font-bold uppercase tracking-widest text-primary'>
              Accuracy Certification
            </h3>
          </div>

          <div className='flex items-start space-x-3'>
            <Controller
              name='isCertifiedTrue'
              control={control}
              render={({ field }) => (
                <Checkbox
                  id='cert-check'
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className={cn(
                    "w-6 h-6 mt-0.5 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
                    errors.isCertifiedTrue && "border-destructive",
                  )}
                />
              )}
            />
            <Label
              htmlFor='cert-check'
              className='text-sm font-medium leading-relaxed cursor-pointer select-none space-y-2 block'>
              <p>
                I certify that all information I have provided on this form is
                true, correct, and complete to the best of my knowledge and
                belief. I understand that any false information may be ground
                for disqualification.
              </p>

              <p className='italic text-muted-foreground border-l-2 border-primary/30 pl-3 py-1'>
                Nagapamatuod ako nga ang tanan nga impormasyon nga akon ginhatag
                sa sini nga porma matuod, husto, kag kompleto sa akon
                nahibaluan. Nahangpan ko nga ang bisan ano nga sala nga
                impormasyon mahimo mangin kabangdanan sang akon
                diskwalipikasyon.
              </p>

              <hr className='my-3 border-muted/30' />

              <p className='font-semibold text-destructive/90'>
                I hereby confirm my early registration and I fully understand
                that due to the volume of registrants and absorptive capacity,
                the {schoolName} may not guarantee my enrollment for SY{" "}
                {yearLabel}.
              </p>

              <p className='font-bold uppercase tracking-tight text-destructive'>
                (ANG INI NGA PAGPALISTA WALA NAGA-GARANTIYA NGA KAMO ENROLLED
                NA)
              </p>
            </Label>
          </div>
          {errors.isCertifiedTrue && (
            <p className='text-xs text-destructive font-bold pl-9'>
              {errors.isCertifiedTrue.message}
            </p>
          )}

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4'>
            <div className='space-y-2'>
              <Label
                htmlFor='sig'
                className='text-[10px] font-bold uppercase text-primary/60'>
                Full Name of Parent / Guardian *
              </Label>
              <Input
                autoComplete='off'
                id='sig'
                {...register("parentGuardianSignature")}
                placeholder='Type your full name'
                className={cn(
                  "h-12 border-2 font-bold uppercase",
                  errors.parentGuardianSignature && "border-destructive",
                )}
              />
              {errors.parentGuardianSignature && (
                <p className='text-xs text-destructive font-bold'>
                  {errors.parentGuardianSignature.message}
                </p>
              )}
            </div>
            <div className='space-y-2'>
              <Label className='text-[10px] font-bold uppercase text-primary/60'>
                Date Accomplished
              </Label>
              <Input
                autoComplete='off'
                value={format(new Date(), "MMMM dd, yyyy")}
                readOnly
                className='h-12 bg-muted/50 font-bold text-muted-foreground cursor-not-allowed uppercase'
              />
            </div>
          </div>
        </div>

        <div className='text-center'>
          <p className='text-[12px] sm:text-sm text-muted-foreground italic'>
            Privacy consent was recorded on {format(new Date(), "MMMM dd, yyyy")}
            .
          </p>
        </div>

        <div className='pt-4 flex justify-center'>
          <Button
            type='button'
            size='lg'
            onClick={onSubmitClick}
            disabled={isSubmitting}
            className='h-12 px-10 font-bold sm:w-auto w-full hover:opacity-90 bg-primary text-primary-foreground transition-all'>
            {isSubmitting ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <Check className='mr-2 h-5 w-5 stroke-3' />
            )}
            {isSubmitting ? "Submitting..." : "Submit Application"}
          </Button>
        </div>
      </div>
    </div>
  );
}
