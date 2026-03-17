import { useFormContext } from 'react-hook-form';
import type { AdmissionFormData } from '../types';
import { DISABILITY_TYPES } from '../types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Lock, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Step3Background() {
  const { register, watch, setValue } = useFormContext<AdmissionFormData>();

  const isIpCommunity = watch('isIpCommunity');
  const is4PsBeneficiary = watch('is4PsBeneficiary');
  const isLearnerWithDisability = watch('isLearnerWithDisability');

  return (
    <div className="space-y-12">
      <div className="flex items-center gap-3 p-4 bg-[#061E29]/5 border border-[#061E29]/20  rounded-xl">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-border">
          <Lock className="w-5 h-5 text-[#061E29]" />
        </div>
        <div>
          <p className="text-sm font-bold text-[#061E29]">Sensitive Information</p>
          <p className="text-[11px] text-[#061E29] font-medium uppercase tracking-wider">All details are kept strictly confidential.</p>
        </div>
      </div>

      <div className="space-y-10">
        {/* IP Community */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-bold flex items-center gap-2">
              Is the learner a member of an IP cultural community? *
            </Label>
            <Badge variant="outline" className="text-[10px] uppercase border-[#061E29]/20 text-[#061E29] gap-1">
              <Lock className="w-2.5 h-2.5" /> Confidential
            </Badge>
          </div>
          <RadioGroup 
            value={isIpCommunity ? 'Yes' : 'No'} 
            onValueChange={(val) => setValue('isIpCommunity', val === 'Yes')}
            className="flex gap-8"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="No" id="ip-no" className="w-5 h-5 border-[#061E29] text-[#061E29]" />
              <Label htmlFor="ip-no" className="font-semibold cursor-pointer">No</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Yes" id="ip-yes" className="w-5 h-5 border-[#061E29] text-[#061E29]" />
              <Label htmlFor="ip-yes" className="font-semibold cursor-pointer">Yes</Label>
            </div>
          </RadioGroup>
          <AnimatePresence>
            {isIpCommunity && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden p-1"
              >
                <div className="pt-4 space-y-2 max-w-sm">
                  <Label htmlFor="ip-group" className="text-xs font-bold uppercase text-muted-foreground">Specify IP Group Name</Label>
                  <Input autoComplete="off" id="ip-group" {...register('ipGroupName')} placeholder="e.g. Ati, Mangyan" className="h-11 font-bold uppercase" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 4Ps Beneficiary */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-bold">
              Is your family a beneficiary of the 4Ps? *
            </Label>
            <Badge variant="outline" className="text-[10px] uppercase border-[#061E29]/20 text-[#061E29] gap-1">
              <Lock className="w-2.5 h-2.5" /> Confidential
            </Badge>
          </div>
          <RadioGroup 
            value={is4PsBeneficiary ? 'Yes' : 'No'} 
            onValueChange={(val) => setValue('is4PsBeneficiary', val === 'Yes')}
            className="flex gap-8"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="No" id="4ps-no" className="w-5 h-5 border-[#061E29] text-[#061E29]" />
              <Label htmlFor="4ps-no" className="font-semibold cursor-pointer">No</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Yes" id="4ps-yes" className="w-5 h-5 border-[#061E29] text-[#061E29]" />
              <Label htmlFor="4ps-yes" className="font-semibold cursor-pointer">Yes</Label>
            </div>
          </RadioGroup>
          <AnimatePresence>
            {is4PsBeneficiary && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden p-1"
              >
                <div className="pt-4 space-y-2 max-w-sm">
                  <Label htmlFor="household-id" className="text-xs font-bold uppercase text-muted-foreground">4Ps Household ID Number</Label>
                  <Input autoComplete="off" id="household-id" {...register('householdId4Ps')} placeholder="Household ID" className="h-11 font-bold" inputMode="numeric" onKeyDown={(e) => { if (!/[0-9]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key)) e.preventDefault(); }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Balik Aral */}
        <div className="space-y-4">
          <Label className="text-sm font-bold">
            Is this learner returning to school after a gap of 1 year or more? (Balik-Aral) *
          </Label>
          <RadioGroup 
            value={watch('isBalikAral') ? 'Yes' : 'No'} 
            onValueChange={(val) => setValue('isBalikAral', val === 'Yes')}
            className="flex gap-8"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="No" id="ba-no" className="w-5 h-5 border-[#061E29] text-[#061E29]" />
              <Label htmlFor="ba-no" className="font-semibold cursor-pointer">No</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Yes" id="ba-yes" className="w-5 h-5 border-[#061E29] text-[#061E29]" />
              <Label htmlFor="ba-yes" className="font-semibold cursor-pointer">Yes</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Disability */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-bold">
              Does the learner have a disability? *
            </Label>
            <Badge variant="outline" className="text-[10px] uppercase border-[#061E29]/20 text-[#061E29] gap-1">
              <Lock className="w-2.5 h-2.5" /> Confidential
            </Badge>
          </div>
          <RadioGroup 
            value={isLearnerWithDisability ? 'Yes' : 'No'} 
            onValueChange={(val) => setValue('isLearnerWithDisability', val === 'Yes')}
            className="flex gap-8"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="No" id="lwd-no" className="w-5 h-5 border-[#061E29] text-[#061E29]" />
              <Label htmlFor="lwd-no" className="font-semibold cursor-pointer">No</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Yes" id="lwd-yes" className="w-5 h-5 border-[#061E29] text-[#061E29]" />
              <Label htmlFor="lwd-yes" className="font-semibold cursor-pointer">Yes</Label>
            </div>
          </RadioGroup>
          <AnimatePresence>
            {isLearnerWithDisability && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden p-1"
              >
                <div className="pt-6">
                  <div className="p-6 border border-border/60 bg-muted/10 rounded-xl space-y-6">
                    <Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Type of Disability (Select all that apply)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {DISABILITY_TYPES.map((type) => (
                        <div key={type} className="flex items-center space-x-3">
                          <Checkbox 
                            id={`disability-${type}`}
                            checked={watch('disabilityType')?.includes(type)}
                            onCheckedChange={(checked) => {
                              const current = watch('disabilityType') || [];
                              if (checked) {
                                setValue('disabilityType', [...current, type]);
                              } else {
                                setValue('disabilityType', current.filter((t) => t !== type));
                              }
                            }}
                            className="w-5 h-5 data-[state=checked]:bg-[#061E29] data-[state=checked]:text-white border-[#061E29]"
                          />
                          <Label htmlFor={`disability-${type}`} className="text-sm font-medium cursor-pointer">{type}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Alert className="bg-[#061E29]/5 border-[#061E29]/10 mt-12">
        <Info className="h-4 w-4 text-[#061E29]" />
        <AlertDescription className="font-bold text-[#061E29]/80">
          This information is used exclusively to connect the learner to appropriate support services. It will not affect their eligibility for enrollment in any way.
        </AlertDescription>
      </Alert>
    </div>
  );
}
