import { useFormContext } from 'react-hook-form';
import type { AdmissionFormData } from '../types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Step4PreviousSchool() {
  const { register, watch, setValue, formState: { errors } } = useFormContext<AdmissionFormData>();

  // Generate last 10 school years
  const currentYear = new Date().getFullYear();
  const schoolYears = Array.from({ length: 10 }, (_, i) => {
    const start = currentYear - i;
    return `${start}-${start + 1}`;
  });

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="prev-school" className="text-sm font-bold">Name of Last School Attended *</Label>
          <Input autoComplete="off" 
            id="prev-school" 
            {...register('lastSchoolName')} 
            placeholder="e.g. Negros Occidental High School" 
            className={cn("h-11 font-bold uppercase", errors.lastSchoolName && "border-destructive")} 
          />
          {errors.lastSchoolName && <p className="text-[11px] text-destructive font-medium">{errors.lastSchoolName.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="prev-school-id" className="text-sm font-bold">DepEd School ID</Label>
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
            </div>
            <Input autoComplete="off" id="prev-school-id" {...register('lastSchoolId')} placeholder="6-digit ID (if known)" className="h-11 font-bold font-mono" maxLength={6}  inputMode="numeric" onKeyDown={(e) => { if (!/[0-9]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key)) e.preventDefault(); }} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prev-sy" className="text-sm font-bold">School Year Last Attended *</Label>
            <Select onValueChange={(val) => setValue('syLastAttended', val)} defaultValue={watch('syLastAttended')}>
              <SelectTrigger className={cn("h-11 font-bold", errors.syLastAttended && "border-destructive")}>
                <SelectValue placeholder="Select School Year" />
              </SelectTrigger>
              <SelectContent>
                {schoolYears.map(sy => (
                  <SelectItem key={sy} value={sy}>{sy}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-sm font-bold">Last Grade Level Completed *</Label>
          <RadioGroup 
            value={watch('lastGradeCompleted')} 
            onValueChange={(val) => setValue('lastGradeCompleted', val)}
            className="flex flex-wrap gap-x-8 gap-y-4 pt-1"
          >
            {['Grade 6', 'Grade 10', 'Grade 11', 'Other'].map((opt) => (
              <div key={opt} className="flex items-center space-x-2">
                <RadioGroupItem value={opt} id={`grade-${opt}`} className="w-5 h-5 border-black text-black" />
                <Label htmlFor={`grade-${opt}`} className="font-semibold cursor-pointer">{opt}</Label>
              </div>
            ))}
          </RadioGroup>
          {watch('lastGradeCompleted') === 'Other' && (
            <Input autoComplete="off" 
              {...register('lastGradeCompleted')} 
              placeholder="Specify Grade Level" 
              className="h-11 font-bold max-w-xs animate-in fade-in slide-in-from-left-2 duration-300" 
            />
          )}
        </div>

        <div className="space-y-4">
          <Label className="text-sm font-bold">Type of Last School *</Label>
          <RadioGroup 
            value={watch('lastSchoolType')} 
            onValueChange={(val: 'Public' | 'Private' | 'International' | 'ALS') => setValue('lastSchoolType', val)}
            className="flex flex-wrap gap-x-8 gap-y-4 pt-1"
          >
            {['Public', 'Private', 'International', 'ALS'].map((opt) => (
              <div key={opt} className="flex items-center space-x-2">
                <RadioGroupItem value={opt} id={`type-${opt}`} className="w-5 h-5 border-black text-black" />
                <Label htmlFor={`type-${opt}`} className="font-semibold cursor-pointer">{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-2 pt-2">
          <Label htmlFor="prev-addr" className="text-sm font-bold text-muted-foreground">School Address / Division (Optional)</Label>
          <Input autoComplete="off" id="prev-addr" {...register('lastSchoolAddress')} placeholder="City/Municipality, Province" className="h-11 font-bold uppercase" />
        </div>
      </div>

      <Alert className="bg-black/5 border-black/20 mt-12">
        <Info className="h-4 w-4 text-black" />
        <AlertDescription className="text-sm font-bold text-black leading-relaxed">
          If the learner does not have a Report Card (SF9), they may still enroll. The school will accept a certification letter from the previous school principal as an alternative.
        </AlertDescription>
      </Alert>
    </div>
  );
}
