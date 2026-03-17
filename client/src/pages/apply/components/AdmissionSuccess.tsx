import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, FileText, Download, Home } from 'lucide-react';
import { Link } from 'react-router';
import { useSettingsStore } from '@/stores/settingsStore';

interface AdmissionSuccessProps {
  trackingNumber: string;
}

export default function AdmissionSuccess({ trackingNumber }: AdmissionSuccessProps) {
  const { schoolName } = useSettingsStore();

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <Card className="shadow-lg border-2 border-black/10">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-16 h-16 text-black" />
          </div>
          <CardTitle className="text-2xl font-bold text-black">Application Submitted Successfully!</CardTitle>
          <CardDescription className="text-lg">
            Thank you for applying{schoolName ? ` to ${schoolName}` : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="bg-muted p-6 rounded-lg text-center space-y-2 border">
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Your Application Tracking Number</p>
            <p className="text-3xl font-mono font-bold text-foreground">{trackingNumber}</p>
            <p className="text-xs text-muted-foreground">Please save this number for future reference.</p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Next Steps
            </h3>
            <ul className="space-y-3 text-sm list-decimal pl-5">
              <li>
                <strong>Check your email:</strong> We've sent a confirmation email to the address provided.
              </li>
              <li>
                <strong>Wait for verification:</strong> Our Registrar will review your documents within 3-5 working days.
              </li>
              <li>
                <strong>Document Submission:</strong> Prepare the original copies of your PSA Birth Certificate and SF9 (Report Card).
              </li>
              <li>
                <strong>SCP Applicants:</strong> Watch out for announcements regarding entrance exams and audition schedules.
              </li>
            </ul>
          </div>

          <div className="flex flex-col md:flex-row gap-4 pt-6">
            <Button variant="outline" className="flex-1 gap-2" onClick={() => window.print()}>
              <Download className="w-4 h-4" />
              Download Confirmation Slip
            </Button>
            <Button asChild className="flex-1 gap-2">
              <Link to="/">
                <Home className="w-4 h-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
