import { useState, useRef } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowDown, Check, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";

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
    <div className='max-w-5xl mx-auto p-4 md:p-8'>
      <Card className='shadow-lg border-border rounded-2xl overflow-hidden'>
        <CardHeader className='bg-muted/30 border-b pb-6'>
          <div className='flex flex-col items-center text-center gap-2'>
            <div className='w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2'>
              <ShieldCheck className='w-6 h-6 text-primary' />
            </div>
            <CardTitle className='text-2xl font-bold tracking-tight'>
              Data Privacy Notice
            </CardTitle>
            <p className='text-sm text-muted-foreground font-medium'>
              Republic Act No. 10173
            </p>
          </div>
        </CardHeader>
        <CardContent className='pt-6 px-6 md:px-10'>
          <div className='space-y-4 text-sm leading-relaxed'>
            <div
              ref={scrollContainerRef}
              onScroll={handleNoticeScroll}
              className='max-h-80 overflow-y-auto border rounded-xl p-5 bg-muted/5 space-y-5 relative scroll-smooth'>
              {/* Header Section */}
              <section>
                <h3 className='font-bold text-foreground mb-1 text-base'>
                  {schoolName.toUpperCase()} - PRIVACY NOTICE
                </h3>
                <p className='text-muted-foreground text-sm mb-2'>
                  The Department of Education (DepEd) and {schoolName} collect
                  personal information specifically to facilitate the{" "}
                  <strong>Early Registration</strong> process. This ensures the
                  timely planning of resources, classrooms, and teacher
                  assignments for the upcoming school year.
                </p>
                <p className='text-muted-foreground text-sm italic'>
                  Ang Department of Education (DepEd) kag ang {schoolName}{" "}
                  nagakolekta sang personal nga impormasyon para gid sa{" "}
                  <strong>Early Registration</strong>. Ini para sa husto nga
                  pagplano sang mga kagamitan, classroom, kag mga manunudlo para
                  sa maabot nga school year.
                </p>
              </section>

              <hr className='border-muted/20' />

              {/* Why we collect Section */}
              <section>
                <h4 className='font-bold text-foreground mb-2'>
                  Why we collect your information? / Ngaa nagakolekta kami sang
                  impormasyon?
                </h4>
                <ul className='list-disc pl-5 space-y-2 text-muted-foreground text-sm'>
                  <li>
                    To process and validate Early Registration applications.
                    <br />
                    <span className='italic'>
                      Para maproseso kag ma-validate ang inyo aplikasyon sa{" "}
                      <strong>Early Registration</strong>.
                    </span>
                  </li>
                  <li>
                    To anticipate learner distribution across grade levels and
                    programs.
                    <br />
                    <span className='italic'>
                      Para maplastar sing husto ang kadamuon sang estudyante sa
                      kada grade level kag programa.
                    </span>
                  </li>
                  <li>
                    To pre-register or update profiles in the DepEd Learner
                    Information System (LIS).
                    <br />
                    <span className='italic'>
                      Para ma-encode ukon ma-update ang profile sang estudyante
                      sa <strong>Learner Information System (LIS)</strong> sang
                      DepEd.
                    </span>
                  </li>
                  <li>
                    To communicate updates regarding registration status and
                    schedules.
                    <br />
                    <span className='italic'>
                      Para makahatag sang updates tuhoy sa status sang inyo
                      aplikasyon kag mga iskedyul.
                    </span>
                  </li>
                  <li>
                    To identify potential beneficiaries for equity programs
                    (4Ps, IP, LWD).
                    <br />
                    <span className='italic'>
                      Para makilala ang mga pamilya nga benepisyaryo sang 4Ps,
                      IP, ukon LWD (Learners with Disability).
                    </span>
                  </li>
                </ul>
              </section>

              {/* What information Section */}
              <section>
                <h4 className='font-bold text-foreground mb-2'>
                  What information we collect? / Ano nga impormasyon ang amon
                  ginakuha?
                </h4>
                <div className='space-y-3 text-sm text-muted-foreground'>
                  <p>
                    <strong>Personal Information:</strong> Full name, birthdate,
                    sex, address, LRN, PSA Birth Certificate number.
                    <br />
                    <span className='italic'>
                      <strong>Personal nga Impormasyon:</strong> Bilog nga
                      ngalan, birthday, sex, lugar sang pagkatawo, address, LRN,
                      kag PSA Birth Certificate number.
                    </span>
                  </p>
                  <p>
                    <strong>Sensitive Information:</strong> Disability status,
                    IP affiliation, 4Ps ID, and school records.
                    <br />
                    <span className='italic'>
                      <strong>Sensitibo nga Impormasyon:</strong> Kon may
                      disabilidad, IP affiliation (tribu), 4Ps status, kag mga
                      school records.
                    </span>
                  </p>
                </div>
              </section>

              {/* Protection Section */}
              <section className='pb-4 border-b'>
                <h4 className='font-bold text-foreground mb-2'>
                  How we protect your information / Paano namon ginaproteksyunan
                  ang inyo impormasyon
                </h4>
                <p className='text-muted-foreground text-sm'>
                  Data is stored securely in the LIS. Access is strictly
                  restricted to authorized personnel. Physical forms are
                  retained for no more than one year.
                  <br />
                  <span className='italic text-xs block mt-1'>
                    Ang inyo datos naga-agi sa maid-id nga seguridad sa sulod
                    sang LIS. Ang mga awtorisado nga personahe lang sang
                    eskwelahan ang puyde makatan-aw sini. Ang mga physical forms
                    ukon papel ginatago sing maayo kag gina-dispose pagkatapos
                    sang isa ka tuig.
                  </span>
                </p>
              </section>

              {/* Rights Section */}
              <section>
                <h4 className='font-bold text-foreground mb-2'>
                  Your rights under RA 10173 / Ang inyo kinamatarong sa idalom
                  sang RA 10173
                </h4>
                <p className='text-muted-foreground text-sm'>
                  You have the right to be informed, access, rectify, object, or
                  file a complaint with the National Privacy Commission.
                  <br />
                  <span className='italic text-xs block mt-1'>
                    May kinamatarong kamo nga mahibalo, makakita, magkayo sang
                    sala nga impormasyon, magpamatok sa paggamit sang datos,
                    ukon magpasaka sang reklamo sa National Privacy Commission.
                  </span>
                </p>
              </section>

              <div className='pt-2 text-center text-xs text-muted-foreground italic'>
                End of Privacy Notice. / Katapusan sang Pahibalo sa Privacy.
              </div>
            </div>

            <div
              className={cn(
                "flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest transition-all duration-500 py-1",
                hasScrolledNotice
                  ? "text-primary"
                  : "text-primary/60 animate-pulse",
              )}>
              {hasScrolledNotice ? (
                <>
                  <Check className='w-3.5 h-3.5 stroke-3' />
                  <span>Notice fully read • Consent enabled</span>
                </>
              ) : (
                <>
                  <ArrowDown className='w-3.5 h-3.5' />
                  <span>Scroll to the bottom to enable consent</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className='flex flex-col items-stretch gap-6 bg-muted/30 border-t p-6 md:p-10'>
          <div
            className={cn(
              "flex items-start space-x-3 transition-opacity duration-300",
              !hasScrolledNotice && "opacity-50 grayscale pointer-events-none",
            )}>
            <Checkbox
              id='privacy-consent'
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              className='mt-1 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground'
            />
            <Label
              htmlFor='privacy-consent'
              className='text-sm font-medium leading-relaxed cursor-pointer select-none'>
              I have read and I agree to the Data Privacy Notice above. I freely
              consent to the collection and processing of my child's information
              by {schoolName} and DepEd.
              <span className='text-destructive ml-1'>*</span>
            </Label>
          </div>
          <Button
            onClick={onAccept}
            disabled={!agreed}
            className='w-full h-12 text-base font-semibold transition-all bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground'>
            Proceed to Application Form
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
