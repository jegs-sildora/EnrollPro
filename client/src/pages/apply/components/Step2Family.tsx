import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import type { AdmissionFormData } from '../types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Step2Family() {
  const { register, watch, setValue, formState: { errors } } = useFormContext<AdmissionFormData>();

  const isPermanentSameAsCurrent = watch('isPermanentSameAsCurrent');
  const [showGuardian, setShowGuardian] = useState(!!watch('guardian.lastName'));

  return (
    <div className="space-y-12">
      <Alert className="bg-[#061E29]/5 border-[#061E29]/20 items-center">
        <Info className="h-4 w-4 text-[#061E29]" />
        <AlertDescription className="font-bold text-[#061E29]/80">
          Important: Application updates and exam schedules will be sent to the email provided below.
        </AlertDescription>
      </Alert>

      {/* Contact Email */}
      <div className="space-y-2 max-w-md">
        <Label htmlFor="email" className="text-sm font-semibold">Email Address <span className="text-destructive">*</span></Label>
        <Input autoComplete="off" 
          id="email" 
          type="email" 
          {...register('email')} 
          placeholder="email@email.com" 
          className={cn("h-11 font-bold", errors.email && "border-destructive")} 
        />
        {errors.email && <p className="text-[11px] text-destructive font-medium">{errors.email.message}</p>}
      </div>

      <Separator className="opacity-50" />

      {/* Parents Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#061E29]">Mother's Information</h3>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mom-lastName" className="text-xs font-bold uppercase">Last Name <span className="text-destructive">*</span></Label>
              <Input autoComplete="off" id="mom-lastName" {...register('mother.lastName')} className="h-11 uppercase font-bold" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mom-firstName" className="text-xs font-bold uppercase">First Name <span className="text-destructive">*</span></Label>
              <Input autoComplete="off" id="mom-firstName" {...register('mother.firstName')} className="h-11 uppercase font-bold" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mom-contact" className="text-xs font-bold uppercase">Contact Number</Label>
              <Input autoComplete="off" id="mom-contact" {...register('mother.contactNumber')} placeholder="09XXXXXXXXX" className="h-11 font-bold" inputMode="numeric" maxLength={11} onKeyDown={(e) => !/[0-9]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key) && e.preventDefault()} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#061E29]">Father's Information</h3>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dad-lastName" className="text-xs font-bold uppercase">Last Name <span className="text-destructive">*</span></Label>
              <Input autoComplete="off" id="dad-lastName" {...register('father.lastName')} className="h-11 uppercase font-bold" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dad-firstName" className="text-xs font-bold uppercase">First Name <span className="text-destructive">*</span></Label>
              <Input autoComplete="off" id="dad-firstName" {...register('father.firstName')} className="h-11 uppercase font-bold" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dad-contact" className="text-xs font-bold uppercase">Contact Number</Label>
              <Input autoComplete="off" id="dad-contact" {...register('father.contactNumber')} placeholder="09XXXXXXXXX" className="h-11 font-bold" inputMode="numeric" maxLength={11} onKeyDown={(e) => !/[0-9]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key) && e.preventDefault()} />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="add-guardian" 
            checked={showGuardian} 
            onCheckedChange={(checked) => setShowGuardian(checked === true)} 
            className="w-5 h-5 border-[#061E29] data-[state=checked]:bg-[#061E29] data-[state=checked]:text-white"
          />
          <Label htmlFor="add-guardian" className="text-sm font-semibold cursor-pointer flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#061E29]" />
            Add Guardian / Primary Contact (If different from parents)
          </Label>
        </div>

        <AnimatePresence>
          {showGuardian && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden px-1 -mx-1"
            >
              <div className="pt-8 space-y-6 px-1 mx-1 pb-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="guard-lastName" className="text-xs font-bold uppercase">Last Name</Label>
                    <Input autoComplete="off" id="guard-lastName" {...register('guardian.lastName')} className="h-11 uppercase font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="guard-firstName" className="text-xs font-bold uppercase">First Name</Label>
                    <Input autoComplete="off" id="guard-firstName" {...register('guardian.firstName')} className="h-11 uppercase font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="guard-contact" className="text-xs font-bold">Contact Number</Label>
                    <Input autoComplete="off" id="guard-contact" {...register('guardian.contactNumber')} placeholder="09XXXXXXXXX" className="h-11 font-bold" inputMode="numeric" maxLength={11} onKeyDown={(e) => !/[0-9]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key) && e.preventDefault()} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="guard-rel" className="text-xs font-bold uppercase">Relationship to Learner</Label>
                    <Input autoComplete="off" id="guard-rel" {...register('guardian.relationship')} placeholder="e.g. Grandparent" className="h-11 font-bold uppercase" onChange={(e) => e.target.value = e.target.value.toUpperCase()} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="opacity-50" />

      {/* Address Information */}
      <div className="space-y-8">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[#061E29]">Current Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <Label htmlFor="curr-house" className="text-xs font-bold uppercase">House No.</Label>
            <Input autoComplete="off" id="curr-house" {...register('currentAddress.houseNo')} className="h-11 font-bold" inputMode="numeric" onKeyDown={(e) => !/[0-9]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key) && e.preventDefault()} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="curr-street" className="text-xs font-bold uppercase">Street</Label>
            <Input autoComplete="off" id="curr-street" {...register('currentAddress.street')} className="h-11 font-bold uppercase" onChange={(e) => e.target.value = e.target.value.toUpperCase()} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="curr-brgy" className="text-xs font-bold uppercase">Barangay <span className="text-destructive">*</span></Label>
            <Input autoComplete="off" id="curr-brgy" {...register('currentAddress.barangay')} className={cn("h-11 font-bold uppercase", errors.currentAddress?.barangay && "border-destructive")} onChange={(e) => e.target.value = e.target.value.toUpperCase()} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="curr-city" className="text-xs font-bold uppercase">City / Municipality <span className="text-destructive">*</span></Label>
            <Input autoComplete="off" id="curr-city" {...register('currentAddress.cityMunicipality')} className={cn("h-11 font-bold uppercase", errors.currentAddress?.cityMunicipality && "border-destructive")} onChange={(e) => e.target.value = e.target.value.toUpperCase()} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="curr-prov" className="text-xs font-bold uppercase">Province <span className="text-destructive">*</span></Label>
            <Input autoComplete="off" id="curr-prov" {...register('currentAddress.province')} className={cn("h-11 font-bold uppercase", errors.currentAddress?.province && "border-destructive")} onChange={(e) => e.target.value = e.target.value.toUpperCase()} />
          </div>
        </div>

        <div className="flex items-center space-x-3 pt-2">
          <Checkbox 
            id="same-address" 
            checked={isPermanentSameAsCurrent} 
            onCheckedChange={(checked) => setValue('isPermanentSameAsCurrent', checked === true)} 
            className="w-5 h-5 border-[#061E29] data-[state=checked]:bg-[#061E29] data-[state=checked]:text-white"
          />
          <Label htmlFor="same-address" className="text-sm font-semibold cursor-pointer select-none">
            Permanent Address is same as Current Address
          </Label>
        </div>

        <AnimatePresence>
          {!isPermanentSameAsCurrent && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-8 pb-1 space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-[#061E29]">Permanent Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="perm-house" className="text-xs font-bold uppercase">House No.</Label>
                    <Input autoComplete="off" id="perm-house" {...register('permanentAddress.houseNo')} className="h-11 font-bold" inputMode="numeric" onKeyDown={(e) => !/[0-9]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key) && e.preventDefault()} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="perm-street" className="text-xs font-bold uppercase">Street</Label>
                    <Input autoComplete="off" id="perm-street" {...register('permanentAddress.street')} className="h-11 font-bold uppercase" onChange={(e) => e.target.value = e.target.value.toUpperCase()} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="perm-brgy" className="text-xs font-bold uppercase">Barangay</Label>
                    <Input autoComplete="off" id="perm-brgy" {...register('permanentAddress.barangay')} className="h-11 font-bold uppercase" onChange={(e) => e.target.value = e.target.value.toUpperCase()} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="perm-city" className="text-xs font-bold uppercase">City / Municipality</Label>
                    <Input autoComplete="off" id="perm-city" {...register('permanentAddress.cityMunicipality')} className="h-11 font-bold uppercase" onChange={(e) => e.target.value = e.target.value.toUpperCase()} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="perm-prov" className="text-xs font-bold uppercase">Province</Label>
                    <Input autoComplete="off" id="perm-prov" {...register('permanentAddress.province')} className="h-11 font-bold uppercase" onChange={(e) => e.target.value = e.target.value.toUpperCase()} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
