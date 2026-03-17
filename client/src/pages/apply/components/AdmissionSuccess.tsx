import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, FileText, Download, Home, Copy, Check, Loader2 } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { cn } from '@/lib/utils';
import depedLogo from '@/assets/deped-logo.png';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

interface AdmissionSuccessProps {
  trackingNumber: string;
  onBackHome?: () => void;
}

export default function AdmissionSuccess({ trackingNumber, onBackHome }: AdmissionSuccessProps) {
  const { schoolName, logoUrl } = useSettingsStore();
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [numPieces, setNumPieces] = useState(1000);
  const { width, height } = useWindowSize();
  const pdfRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(trackingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPDF = async () => {
    if (!pdfRef.current) return;
    setIsGenerating(true);

    try {
      const element = pdfRef.current;
      // Show element for capture (off-screen)
      element.style.visibility = 'visible';
      element.style.position = 'fixed';
      element.style.left = '-9999px';
      element.style.top = '0';
      
      // Small delay to ensure rendering and image loading
      await new Promise(resolve => setTimeout(resolve, 800));

      const canvas = await html2canvas(element, {
        scale: 2, 
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800,
        // Ensure no oklch colors are parsed by avoiding theme variables where possible
        // or using an ignore strategy. Hardcoding standard colors in the container is best.
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      
      const imgWidth = 595.28; 
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Admission_Confirmation_${trackingNumber}.pdf`);
      
      element.style.visibility = 'hidden';
      element.style.position = 'absolute';
    } catch (error) {
      console.error('PDF Generation failed:', error);
      alert('Failed to generate PDF. Please try printing the page instead.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      {numPieces > 0 && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={numPieces}
          gravity={0.15}
          onConfettiComplete={() => setNumPieces(0)}
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 10000, pointerEvents: 'none' }}
        />
      )}
      {/* ── PDF Container (Using hardcoded hex colors to avoid oklch parsing errors) ── */}
      <div 
        ref={pdfRef} 
        style={{ 
          visibility: 'hidden', 
          position: 'absolute', 
          left: '-9999px',
          width: '800px', 
          padding: '60px',
          backgroundColor: '#ffffff',
          color: '#061E29',
        }} 
        className="font-sans"
      >
        <div style={{ borderColor: '#061E29' }} className="flex flex-col items-center justify-center gap-6 mb-4 border-b-2 pb-10">
          <div className="flex items-center justify-center gap-10 w-full">
            {logoUrl ? (
              <img 
                src={`${API_BASE}${logoUrl}`} 
                crossOrigin="anonymous"
                alt="School Logo" 
                className="h-28 w-28 object-contain" 
              />
            ) : (
              <div style={{ backgroundColor: '#f3f4f6' }} className="h-28 w-28 rounded-full flex items-center justify-center font-bold text-4xl text-[#061E29]">
                {schoolName?.charAt(0)}
              </div>
            )}
            <div className="text-center flex-1">
              <h1 style={{ color: '#061E29' }} className="text-3xl font-black uppercase tracking-tight mb-1">{schoolName}</h1>
              <p style={{ color: '#4b5563' }} className="text-base font-bold uppercase tracking-[0.2em] mb-2">Online Admission Portal</p>
              <div style={{ backgroundColor: '#061E29', color: '#ffffff' }} className="flex items-center justify-center px-6 py-3 rounded-xl text-xs font-black tracking-widest uppercase text-center">
                <p className='-mt-3'>Official Admission Confirmation Slip</p>
              </div>

            </div>
            <img 
              src={depedLogo} 
              crossOrigin="anonymous"
              alt="DepEd Logo" 
              className="h-28 w-28 object-contain" 
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="text-center space-y-4">
            <h2 style={{ color: '#061E29' }} className="text-4xl font-black tracking-tight">Application Received!</h2>
            <p style={{ color: '#4b5563' }} className="text-xl font-medium">
              Your application has been successfully submitted to <span style={{ color: '#061E29' }} className="font-bold">{schoolName}</span>.
            </p>
          </div>

          <div style={{ backgroundColor: '#f9fafb', borderColor: '#061E29' }} className="p-12 rounded-3xl border-4 text-center space-y-6 relative overflow-hidden border-dashed">
             <p style={{ color: '#6b7280' }} className="text-xs uppercase tracking-[0.3em] font-black">Application Tracking Number</p>
             <p style={{ color: '#061E29' }} className="text-7xl font-mono font-black tracking-tighter">{trackingNumber}</p>
             
             <div className="pt-6 flex justify-center gap-12 text-center">
                <div className="space-y-1">
                  <p style={{ color: '#9ca3af' }} className="text-[10px] font-black uppercase">Date Generated</p>
                  <p style={{ color: '#061E29' }} className="text-sm font-bold">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <div className="space-y-1">
                  <p style={{ color: '#9ca3af' }} className="text-[10px] font-black uppercase">Time Generated</p>
                  <p style={{ color: '#061E29' }} className="text-sm font-bold">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
             </div>
          </div>

          <div style={{ borderColor: '#f3f4f6' }} className="space-y-8 bg-white p-8 border-2 rounded-3xl">
            <h3 style={{ color: '#061E29' }} className="text-2xl font-black flex items-center gap-3 uppercase tracking-tight -mt-3">
              Important Next Steps
            </h3>
            <div className="grid grid-cols-1 gap-6 text-sm">
              {[
                { title: 'Check your email', desc: 'A confirmation has been sent to your primary contact email.' },
                { title: 'Wait for verification', desc: 'Our Registrar will review your documents within 3-5 working days.' },
                { title: 'Prepare original documents', desc: 'Submit PSA Birth Certificate and SF9 (Report Card) upon request.' },
                { title: 'Monitor Portal', desc: 'Use your tracking number to check the status of your application.' }
              ].map((step, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div style={{ backgroundColor: '#061E29' }} className="w-2 h-2 rounded-full mt-3 shrink-0" />
                  <div>
                    <p style={{ color: '#061E29' }} className="font-black uppercase tracking-wide">{step.title}</p>
                    <p style={{ color: '#4b5563' }} className="font-medium">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderColor: '#061E29' }} className="border-t-4 pt-12 mt-12 flex justify-between items-end">
            <div className="space-y-2">
              <p style={{ color: '#9ca3af' }} className="text-[10px] font-black uppercase tracking-widest">Security Validation</p>
              <div style={{ backgroundColor: '#061E29', color: '#ffffff' }} className="px-4 py-2 font-mono text-xs font-bold">
                VALID_AUTHENTIC_SUBMISSION_{trackingNumber.replace(/-/g, '_')}
              </div>
            </div>
            <div className="text-right space-y-1">
              <p style={{ color: '#061E29' }} className="font-black uppercase tracking-tight text-lg leading-none">EnrollPro Management System</p>
              <p style={{ color: '#9ca3af' }} className="text-[10px] font-bold">This document is electronically generated. No physical signature required.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Regular Web UI (Uses Theme Variables) ── */}
      <Card className="shadow-lg border-2 border-[#061E29]/10">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-16 h-16 text-[#061E29]" />
          </div>
          <CardTitle className="text-2xl font-bold text-[#061E29]">Application Submitted Successfully!</CardTitle>
          <CardDescription className="text-lg">
            Thank you for applying to{schoolName ? <span className="font-bold"> {schoolName}</span> : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div 
            onClick={handleCopy}
            className={cn(
              "bg-muted p-8 rounded-2xl text-center space-y-3 border-2 border-dashed cursor-pointer transition-all duration-200 group relative overflow-hidden",
              copied ? "border-[#061E29] bg-[#061E29]/5" : "border-muted-foreground/20 hover:border-[#061E29]/50 hover:bg-[#061E29]/2"
            )}
          >
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black">Your Application Tracking Number</p>
            <div className="flex items-center justify-center gap-4">
              <p className="text-4xl font-mono font-black text-foreground tracking-tighter">{trackingNumber}</p>
              <div className={cn(
                "p-2 rounded-lg transition-colors",
                copied ? "bg-[#061E29] text-white" : "bg-muted-foreground/10 group-hover:bg-[#061E29]/20"
              )}>
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </div>
            </div>
            <p className={cn(
              "text-xs font-bold transition-all duration-200",
              copied ? "text-[#061E29] scale-110" : "text-muted-foreground"
            )}>
              {copied ? "COPIED TO CLIPBOARD!" : "CLICK TO COPY"}
            </p>
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
            <Button 
              variant="outline" 
              className="flex-1 gap-2 h-12 font-bold" 
              onClick={downloadPDF}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isGenerating ? 'Generating PDF...' : 'Download Confirmation Slip (PDF)'}
            </Button>
            <Button 
              className="flex-1 gap-2 h-12 font-bold"
              onClick={onBackHome}
            >
              <Home className="w-4 h-4" />
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
