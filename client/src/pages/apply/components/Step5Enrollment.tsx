import { useFormContext } from 'react-hook-form';
import type { AdmissionFormData } from '../types';
import { ACADEMIC_CLUSTERS, TECHPRO_CLUSTERS, SPA_ART_FIELDS, SPS_SPORTS, SPFL_LANGUAGES } from '../types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { GraduationCap, BookOpen, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Step5Enrollment() {
  const { register, watch, setValue } = useFormContext<AdmissionFormData>();

  const gradeLevel = watch('gradeLevel');
  const shsTrack = watch('shsTrack');
  const scpApplication = watch('scpApplication');
  const scpType = watch('scpType');
  const electiveCluster = watch('electiveCluster');

  const clusters = shsTrack === 'Academic' ? ACADEMIC_CLUSTERS : TECHPRO_CLUSTERS;
  const showStemGrades = electiveCluster === 'AC-STEM';

  const grades = ['7', '8', '9', '10', '11', '12'] as const;

  return (
    <div className="space-y-12">
      {/* Grade Level Selector */}
      <div className="space-y-6">
        <Label className="text-sm font-bold uppercase tracking-widest text-primary">Grade Level to Enroll *</Label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-2">
          {grades.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                setValue('gradeLevel', g);
                if (g !== '11') {
                  setValue('shsTrack', undefined);
                  setValue('electiveCluster', undefined);
                }
                if (g !== '7') {
                  setValue('scpApplication', false);
                  setValue('scpType', undefined);
                }
              }}
              className={cn(
                "h-16 rounded-xl border-2 font-bold text-lg transition-all flex items-center justify-center shadow-sm",
                gradeLevel === g
                  ? "border-primary bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] pointer-events-none"
                  : "border-border bg-white text-muted-foreground hover:bg-[hsl(var(--sidebar-accent))]"
              )}
            >
              G{g}
            </button>
          ))}
        </div>
      </div>

      {/* Grade 7: SCP Section */}
      <AnimatePresence>
        {gradeLevel === '7' && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-8 pb-8">
              <div className="p-6 border border-primary bg-primary rounded-2xl space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <Label className="text-base font-bold">Application Type *</Label>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button type="button" className={cn(
                    "flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer text-left",
                    !scpApplication ? "border-primary bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] pointer-events-none" : "border-border bg-white hover:bg-[hsl(var(--sidebar-accent))]"
                  )} onClick={() => { setValue('scpApplication', false); setValue('scpType', undefined); }}>
                    <div className="flex items-center gap-3 mb-1">
                      <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", !scpApplication ? "border-[hsl(var(--accent-foreground))]" : "border-muted-foreground")}>
                        {!scpApplication && <div className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--accent-foreground))]" />}
                      </div>
                      <span className="font-bold">Regular Section</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground pl-8">Open admission — no entrance exam required.</p>
                  </button>

                  <button type="button" className={cn(
                    "flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer text-left",
                    scpApplication ? "border-primary bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] pointer-events-none" : "border-border bg-white hover:bg-[hsl(var(--sidebar-accent))]"
                  )} onClick={() => setValue('scpApplication', true)}>
                    <div className="flex items-center gap-3 mb-1">
                      <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", scpApplication ? "border-[hsl(var(--accent-foreground))]" : "border-muted-foreground")}>
                        {scpApplication && <div className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--accent-foreground))]" />}
                      </div>
                      <span className="font-bold">Special Curricular Program (SCP)</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground pl-8">Requires qualifying assessment or audition.</p>
                  </button>
                </div>

                <AnimatePresence>
                  {scpApplication && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-6 space-y-6">
                        <Separator className="opacity-20" />
                        <Label className="text-sm font-bold uppercase tracking-widest text-primary">Select SCP Program *</Label>
                        <RadioGroup 
                          value={scpType} 
                          onValueChange={(val: 'STE' | 'SPA' | 'SPS' | 'SPJ' | 'SPFL' | 'SPTVE') => setValue('scpType', val)}
                          className="grid grid-cols-1 gap-3"
                        >
                          {[
                            { id: 'STE', label: 'Science, Technology & Engineering (STE)', desc: 'Written entrance exam administered by the SDO.' },
                            { id: 'SPA', label: 'Special Program in the Arts (SPA)', desc: 'Written exam + Audition + Interview.' },
                            { id: 'SPS', label: 'Special Program in Sports (SPS)', desc: 'Physical tryout · Sports background required.' },
                            { id: 'SPJ', label: 'Special Program in Journalism (SPJ)', desc: 'Written exam (SPJQE) + Interview.' },
                            { id: 'SPFL', label: 'Special Program in Foreign Language (SPFL)', desc: 'Based on NAT English score.' },
                            { id: 'SPTVE', label: 'Special Program in Tech-Voc Education (SPTVE)', desc: 'Aptitude assessment.' },
                          ].map((p) => (
                            <div key={p.id} className={cn(
                              "flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer",
                              scpType === p.id ? "border-primary bg-white" : "border-border hover:border-primary/30"
                            )} onClick={() => setValue('scpType', p.id as 'STE' | 'SPA' | 'SPS' | 'SPJ' | 'SPFL' | 'SPTVE')}>
                              <div className="flex items-center gap-3 mb-1">
                                <RadioGroupItem value={p.id} id={`scp-${p.id}`} className="w-5 h-5 border-primary" />
                                <Label htmlFor={`scp-${p.id}`} className="font-bold cursor-pointer">{p.label}</Label>
                              </div>
                              <p className="text-[11px] text-muted-foreground pl-8 italic">{p.desc}</p>
                              
                              {/* Sub-fields */}
                              {scpType === 'SPA' && p.id === 'SPA' && (
                                <div className="pl-8 pt-4 space-y-2">
                                  <Label className="text-[10px] font-bold uppercase text-primary">Preferred Art Field *</Label>
                                  <Select onValueChange={(val) => setValue('spaArtField', val)} defaultValue={watch('spaArtField')}>
                                    <SelectTrigger className="h-10 bg-muted/30 font-bold">
                                      <SelectValue placeholder="Select Art Field" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {SPA_ART_FIELDS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {scpType === 'SPS' && p.id === 'SPS' && (
                                <div className="pl-8 pt-4 space-y-2">
                                  <Label className="text-[10px] font-bold uppercase text-primary">Primary Sport *</Label>
                                  <div className="grid grid-cols-2 gap-2">
                                    {SPS_SPORTS.map(s => (
                                      <div key={s} className="flex items-center space-x-2">
                                        <Checkbox 
                                          id={`sport-${s}`} 
                                          checked={watch('spsSports')?.includes(s)}
                                          onCheckedChange={(checked) => {
                                            const curr = watch('spsSports') || [];
                                            if (checked) setValue('spsSports', [...curr, s]);
                                            else setValue('spsSports', curr.filter(i => i !== s));
                                          }}
                                        />
                                        <Label htmlFor={`sport-${s}`} className="text-xs font-medium cursor-pointer">{s}</Label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {scpType === 'SPFL' && p.id === 'SPFL' && (
                                <div className="pl-8 pt-4 space-y-2">
                                  <Label className="text-[10px] font-bold uppercase text-primary">Preferred Language *</Label>
                                  <Select onValueChange={(val) => setValue('spflLanguage', val)} defaultValue={watch('spflLanguage')}>
                                    <SelectTrigger className="h-10 bg-muted/30 font-bold">
                                      <SelectValue placeholder="Select Language" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {SPFL_LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grade 11: SHS Track Section */}
      <AnimatePresence>
        {gradeLevel === '11' && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-8 pb-8">
              <div className="p-6 border border-primary/10 bg-primary/5 rounded-2xl space-y-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <GraduationCap className="w-5 h-5 text-primary" />
                  </div>
                  <Label className="text-base font-bold">SHS Program Selection *</Label>
                </div>

                <div className="space-y-4">
                  <Label className="text-sm font-bold uppercase tracking-widest text-primary/60">Choose Track</Label>
                  <RadioGroup 
                    value={shsTrack} 
                    onValueChange={(val: 'Academic' | 'TechPro') => {
                      setValue('shsTrack', val);
                      setValue('electiveCluster', undefined);
                    }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  >
                    {(['Academic', 'TechPro'] as const).map((t) => (
                      <div key={t} className={cn(
                        "flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer bg-white",
                        shsTrack === t ? "border-primary ring-2 ring-primary/5 shadow-sm" : "border-border hover:border-primary/20"
                      )} onClick={() => setValue('shsTrack', t)}>
                        <RadioGroupItem value={t} id={`track-${t}`} className="w-5 h-5 border-primary" />
                        <Label htmlFor={`track-${t}`} className="font-bold cursor-pointer">{t === 'Academic' ? 'Academic Track' : 'Tech-Voc Track'}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <AnimatePresence>
                  {!!shsTrack && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-6 pt-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-bold uppercase tracking-widest text-primary/60">Preferred Elective Cluster *</Label>
                          <Select value={electiveCluster} onValueChange={(val) => setValue('electiveCluster', val)}>
                            <SelectTrigger className="h-12 bg-white border-2 font-bold">
                              <SelectValue placeholder="Select Elective Cluster" />
                            </SelectTrigger>
                            <SelectContent>
                              {clusters.map((c) => (
                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <AnimatePresence>
                          {showStemGrades && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="pt-4">
                                <div className="p-6 bg-amber-50 border-2 border-amber-200 rounded-2xl space-y-6">
                                  <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                                    <div>
                                      <h4 className="font-bold text-amber-900">STEM Eligibility Check</h4>
                                      <p className="text-xs text-amber-800 font-medium leading-relaxed">
                                        STEM requires a Grade 10 Science and Mathematics final grade of 85 or higher.
                                      </p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                      <Label htmlFor="g10Science" className="text-xs font-bold uppercase text-amber-900/60">G10 Science Final Grade</Label>
                                      <Input autoComplete="off" id="g10Science" type="number" {...register('g10ScienceGrade', { valueAsNumber: true })} className="h-11 border-amber-200 bg-white font-bold" placeholder="0-100" />
                                      {watch('g10ScienceGrade') !== undefined && watch('g10ScienceGrade')! < 85 && (
                                        <p className="text-[10px] font-bold text-amber-700 italic">Note: Below 85. Registrar will review your case.</p>
                                      )}
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="g10Math" className="text-xs font-bold uppercase text-amber-900/60">G10 Math Final Grade</Label>
                                      <Input autoComplete="off" id="g10Math" type="number" {...register('g10MathGrade', { valueAsNumber: true })} className="h-11 border-amber-200 bg-white font-bold" placeholder="0-100" />
                                      {watch('g10MathGrade') !== undefined && watch('g10MathGrade')! < 85 && (
                                        <p className="text-[10px] font-bold text-amber-700 italic">Note: Below 85. Registrar will review your case.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* General Preferences (All applicants) */}
      <div className="space-y-10 pt-6 border-t border-border/40">
        <div className="space-y-4">
          <Label className="text-sm font-bold uppercase tracking-widest text-primary">Type of Learner *</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['Regular', 'Transferee', 'Returning Learner', 'OSCYA', 'ALS'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setValue('learnerType', t)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                  watch('learnerType') === t ? "border-primary bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] pointer-events-none" : "border-border bg-white hover:bg-[hsl(var(--sidebar-accent))]"
                )}
              >
                <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0", watch('learnerType') === t ? "border-[hsl(var(--accent-foreground))]" : "border-muted-foreground")}>
                  {watch('learnerType') === t && <div className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--accent-foreground))]" />}
                </div>
                <span className="font-bold">{t}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
