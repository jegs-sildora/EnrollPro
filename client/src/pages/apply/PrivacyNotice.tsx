import { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Lock, ArrowDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settingsStore';

interface PrivacyNoticeProps {
  onAccept: () => void;
}

export default function PrivacyNotice({ onAccept }: PrivacyNoticeProps) {
  const [agreed, setAgreed] = useState(false);
  const [hasScrolledNotice, setHasScrolledNotice] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { schoolName } = useSettingsStore();

  const handleNoticeScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 20;
    if (atBottom) {
      setHasScrolledNotice(true);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <Card className="shadow-lg border-border rounded-2xl overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-6">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Data Privacy Notice</CardTitle>
            <p className="text-sm text-muted-foreground font-medium">
              Republic Act No. 10173 · SY 2026–2027
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-6 px-6 md:px-10">
          <div className="space-y-4 text-sm leading-relaxed">
            <div
              ref={scrollContainerRef}
              onScroll={handleNoticeScroll}
              className="max-h-80 overflow-y-auto border rounded-xl p-5 bg-muted/5 space-y-5 relative scroll-smooth"
            >
              <section>
                <h3 className="font-bold text-foreground mb-2 text-base">{schoolName.toUpperCase()}</h3>
                <p className="text-muted-foreground">The Department of Education (DepEd) and {schoolName} collect personal information for processing admission and enrollment applications, assigning learners to grade levels and programs, and encoding profiles into the Learner Information System (LIS).</p>
              </section>

              <section>
                <h4 className="font-bold text-foreground mb-2">Why we collect your information</h4>
                <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                  <li>To process admission and enrollment application.</li>
                  <li>To assign the learner to a grade level, section, and program.</li>
                  <li>To encode the learner's profile into the DepEd Learner Information System (LIS).</li>
                  <li>To communicate regarding application status and schedules.</li>
                  <li>To tag equity program beneficiaries (4Ps, IP, LWD).</li>
                </ul>
              </section>

              <section>
                <h4 className="font-bold text-foreground mb-2">What information we collect</h4>
                <p className="text-muted-foreground"><strong>Personal Information:</strong> Full name, birthdate, sex, place of birth, address, LRN, PSA BC number.</p>
                <p className="mt-2 text-muted-foreground"><strong>Sensitive Info:</strong> Disability status, IP affiliation, 4Ps status, G10 grades (for STEM).</p>
              </section>

              <section>
                <h4 className="font-bold text-foreground mb-2">Your rights under RA 10173</h4>
                <p className="text-muted-foreground">You have the right to be informed, access, rectification, object, erasure, damages, and file a complaint with the National Privacy Commission.</p>
              </section>

              <section className="pb-4 border-b">
                <h4 className="font-bold text-foreground mb-2">How we protect your information</h4>
                <p className="text-muted-foreground">Data is stored securely in the LIS. Access is restricted to authorized personnel. Physical forms are retained for no more than one year.</p>
              </section>

              <div className="pt-2 text-center text-xs text-muted-foreground italic">
                End of Privacy Notice. You may now proceed to consent.
              </div>
            </div>

            <div className={cn(
              "flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest transition-all duration-500 py-1",
              hasScrolledNotice ? "text-primary" : "text-primary/60 animate-pulse"
            )}>
              {hasScrolledNotice ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-3" />
                  <span>Notice fully read • Consent enabled</span>
                </>
              ) : (
                <>
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>Scroll to the bottom to enable consent</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-6 bg-muted/30 border-t p-6 md:p-10">
          <div className={cn(
            "flex items-start space-x-3 transition-opacity duration-300",
            !hasScrolledNotice && "opacity-50 grayscale pointer-events-none"
          )}>
            <Checkbox 
              id="privacy-consent" 
              checked={agreed} 
              onCheckedChange={(checked) => setAgreed(checked === true)}
              className="mt-1 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            />
            <Label 
              htmlFor="privacy-consent" 
              className="text-sm font-medium leading-relaxed cursor-pointer select-none"
            >
              I have read and I agree to the Data Privacy Notice above. I freely consent to the collection and processing of my child's information by {schoolName} and DepEd.
              <span className="text-destructive ml-1">*</span>
            </Label>
          </div>
          <Button 
            onClick={onAccept} 
            disabled={!agreed} 
            className="w-full h-12 text-base font-semibold transition-all bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
          >
            Proceed to Application Form →
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
