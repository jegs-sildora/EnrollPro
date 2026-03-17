import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Loader2, CheckCircle2, Clock, AlertCircle, FileText, Calendar, User } from 'lucide-react';
import api from '@/api/axiosInstance';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

const trackSchema = z.object({
  trackingNumber: z.string().min(1, 'Tracking number is required').regex(/^APP-\d{4}-\d{5}$/, 'Invalid tracking number format (e.g. APP-2026-00000)'),
});

type TrackFormData = z.infer<typeof trackSchema>;

interface ApplicationStatus {
  trackingNumber: string;
  firstName: string;
  lastName: string;
  status: string;
  applicantType: string;
  createdAt: string;
  gradeLevel: { name: string };
  strand?: { name: string };
  enrollment?: { section: { name: string }; enrolledAt: string };
  examDate?: string;
  rejectionReason?: string;
}

const statusConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; desc: string }> = {
  SUBMITTED: { 
    label: 'Submitted', 
    icon: Clock, 
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    desc: 'Your application has been received and is waiting for initial review.'
  },
  UNDER_REVIEW: { 
    label: 'Under Review', 
    icon: Search, 
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    desc: 'The Registrar is currently verifying your documents and information.'
  },
  FOR_REVISION: { 
    label: 'Action Required', 
    icon: AlertCircle, 
    color: 'text-destructive bg-destructive/5 border-destructive/20',
    desc: 'There are issues with your application. Please check your email for instructions.'
  },
  ELIGIBLE: { 
    label: 'Qualified / Eligible', 
    icon: CheckCircle2, 
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    desc: 'Your documents have been verified. You are cleared for the next step.'
  },
  ASSESSMENT_SCHEDULED: { 
    label: 'Assessment Scheduled', 
    icon: Calendar, 
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    desc: 'An entrance exam or interview has been scheduled for you.'
  },
  ASSESSMENT_TAKEN: { 
    label: 'Assessment Completed', 
    icon: CheckCircle2, 
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    desc: 'Your assessment is finished. We are currently processing the results.'
  },
  PRE_REGISTERED: { 
    label: 'Pre-Registered', 
    icon: CheckCircle2, 
    color: 'text-green-600 bg-green-50 border-green-200',
    desc: 'Congratulations! You are officially cleared for section assignment.'
  },
  ENROLLED: { 
    label: 'Officially Enrolled', 
    icon: CheckCircle2, 
    color: 'text-green-700 bg-green-100 border-green-300',
    desc: 'Welcome! You are now an officially enrolled student for the academic year.'
  },
  REJECTED: { 
    label: 'Rejected', 
    icon: AlertCircle, 
    color: 'text-gray-600 bg-gray-100 border-gray-300',
    desc: 'Your application was not accepted due to specific data integrity issues.'
  },
  NOT_QUALIFIED: { 
    label: 'Not Qualified', 
    icon: AlertCircle, 
    color: 'text-gray-600 bg-gray-100 border-gray-300',
    desc: 'You did not meet the specific requirements for your chosen program.'
  },
  WITHDRAWN: { 
    label: 'Withdrawn', 
    icon: AlertCircle, 
    color: 'text-gray-400 bg-gray-50 border-gray-200',
    desc: 'This application has been voluntarily withdrawn.'
  },
};

export default function TrackApplication() {
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<TrackFormData>({
    resolver: zodResolver(trackSchema),
  });

  const onTrack = async (data: TrackFormData) => {
    setIsLoading(true);
    setError('');
    setStatus(null);

    try {
      // Small delay for professional feel
      await new Promise(resolve => setTimeout(resolve, 500));
      const response = await api.get(`/applications/track/${data.trackingNumber}`);
      setStatus(response.data);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not find an application with that tracking number.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const config = status ? (statusConfig[status.status] || statusConfig.SUBMITTED) : null;
  const Icon = config?.icon;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Card className="shadow-xl border-2 border-[#061E29]/5 rounded-3xl overflow-hidden">
        <CardHeader className="bg-[#061E29] text-white p-8 text-center">
          <CardTitle className="text-2xl font-black uppercase tracking-tight">Application Monitor</CardTitle>
          <CardDescription className="text-white/60 font-medium">
            Enter your tracking number to check your status
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit(onTrack)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="trackingNumber" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tracking Number</Label>
              <div className="relative">
                <Input 
                  id="trackingNumber"
                  {...register('trackingNumber')}
                  placeholder="APP-2026-XXXXX"
                  className={cn(
                    "h-14 pl-12 text-lg font-mono font-black border-2 transition-all",
                    errors.trackingNumber ? "border-destructive focus-visible:ring-destructive" : "border-[#061E29]/10 focus-visible:border-[#061E29] focus-visible:ring-[#061E29]/5"
                  )}
                  autoComplete="off"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              </div>
              {errors.trackingNumber && <p className="text-xs text-destructive font-bold">{errors.trackingNumber.message}</p>}
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 text-lg font-black uppercase tracking-widest bg-[#061E29] hover:bg-[#061E29]/90 transition-all text-white"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Search className="w-5 h-5 mr-2" />}
              {isLoading ? 'Searching...' : 'Check Status'}
            </Button>
          </form>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 p-6 bg-destructive/5 border-2 border-destructive/20 rounded-2xl flex items-start gap-4"
              >
                <AlertCircle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-destructive uppercase tracking-tight">Application Not Found</h4>
                  <p className="text-sm font-medium text-destructive/80 mt-1">{error}</p>
                </div>
              </motion.div>
            )}

            {status && config && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-10 space-y-8"
              >
                <div className={cn("p-8 rounded-3xl border-2 flex flex-col items-center text-center gap-4", config.color)}>
                  <div className="p-4 rounded-full bg-white shadow-sm border border-current/20">
                    {Icon && <Icon className="w-10 h-10" />}
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-70">Current Status</h3>
                    <p className="text-3xl font-black uppercase tracking-tight mt-1">{config.label}</p>
                  </div>
                  <p className="text-sm font-bold leading-relaxed max-w-sm opacity-90">
                    {config.desc}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                  <div className="p-5 bg-muted/50 border border-border/50 rounded-2xl space-y-1">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                      <User className="w-3 h-3" /> Applicant Name
                    </p>
                    <p className="font-black text-[#061E29] uppercase">{status.lastName}, {status.firstName}</p>
                  </div>
                  <div className="p-5 bg-muted/50 border border-border/50 rounded-2xl space-y-1">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                      <FileText className="w-3 h-3" /> Grade Level
                    </p>
                    <p className="font-black text-[#061E29] uppercase">
                      {status.gradeLevel.name} 
                      {status.strand ? ` — ${status.strand.name}` : ''}
                    </p>
                  </div>
                  
                  {status.status === 'ASSESSMENT_SCHEDULED' && status.examDate && (
                    <div className="p-5 bg-purple-50 border border-purple-200 rounded-2xl space-y-1 md:col-span-2">
                      <p className="text-[10px] font-black uppercase text-purple-600 tracking-widest flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> Scheduled Assessment
                      </p>
                      <p className="font-black text-purple-900 uppercase">
                        {format(new Date(status.examDate), 'MMMM dd, yyyy @ hh:mm a')}
                      </p>
                    </div>
                  )}

                  {status.status === 'FOR_REVISION' && status.rejectionReason && (
                    <div className="p-5 bg-destructive/5 border border-destructive/20 rounded-2xl space-y-1 md:col-span-2">
                      <p className="text-[10px] font-black uppercase text-destructive tracking-widest flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3" /> Revision Details
                      </p>
                      <p className="font-bold text-destructive/90 italic">
                        "{status.rejectionReason}"
                      </p>
                    </div>
                  )}

                  <div className="p-5 bg-white border border-border rounded-2xl space-y-1 md:col-span-2 text-center">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Date Submitted</p>
                    <p className="text-xs font-bold text-muted-foreground">
                      {format(new Date(status.createdAt), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                </div>

                <div className="pt-4 text-center">
                  <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                    Last updated: {format(new Date(), 'hh:mm a')}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
