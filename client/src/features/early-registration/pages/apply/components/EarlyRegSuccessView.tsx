import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { CheckCircle2, FileText, Download, Home, Loader2, ArrowLeft } from "lucide-react";
import { useSettingsStore } from "@/store/settings.slice";
import { cn, formatManilaDate, getManilaNow } from "@/shared/lib/utils";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

interface EarlyRegSuccessViewProps {
  registrationId: number;
  learnerName: string;
  onRegisterAnother?: () => void;
}

export default function EarlyRegSuccessView({
  registrationId,
  learnerName,
  onRegisterAnother,
}: EarlyRegSuccessViewProps) {
  const { schoolName, logoUrl } = useSettingsStore();
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [numPieces, setNumPieces] = useState(4000);
  const { width, height } = useWindowSize();
  const pdfRef = useRef<HTMLDivElement>(null);

  // Format ID as a tracking-like number: REG-2026-XXXX
  const currentYear = new Date().getFullYear();
  const referenceNumber = `REG-${currentYear}-${registrationId.toString().padStart(4, "0")}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referenceNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    {
      title: "Check your email",
      desc: "A confirmation has been sent to your primary contact email address.",
    },
    {
      title: "Document Preparation",
      desc: "Prepare original and photocopies of PSA Birth Certificate and SF9 (Report Card).",
    },
    {
      title: "Wait for verification",
      desc: "Our School Registrar will review your registration within 3-5 working days.",
    },
    {
      title: "Save your Reference Number",
      desc: "Use this number to track your registration status or during on-campus inquiries.",
    },
  ];

  const downloadPDF = async () => {
    if (!pdfRef.current) return;
    setIsGenerating(true);

    try {
      const element = pdfRef.current;
      element.style.visibility = "visible";
      element.style.position = "fixed";
      element.style.left = "-9999px";
      element.style.top = "0";

      await new Promise((resolve) => setTimeout(resolve, 800));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 800,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const imgWidth = 595.28;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
      pdf.save(`Early_Registration_Slip_${referenceNumber}.pdf`);

      element.style.visibility = "hidden";
      element.style.position = "absolute";
    } catch (error) {
      console.error("PDF Generation failed:", error);
      alert("Failed to generate PDF. Please try printing the page instead.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-0">
      {numPieces > 0 && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={numPieces}
          gravity={0.15}
          onConfettiComplete={() => setNumPieces(0)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 10000,
            pointerEvents: "none",
          }}
        />
      )}
      
      {/* PDF Container (Hidden from Web UI) */}
      <div
        ref={pdfRef}
        style={{
          visibility: "hidden",
          position: "fixed",
          left: "-9999px",
          top: "0",
          width: "800px",
          height: "auto",
          overflow: "hidden",
          padding: "60px",
          backgroundColor: "#ffffff",
          color: "#061E29",
          pointerEvents: "none",
        }}
        className="font-sans">
        <div
          style={{ borderColor: "#061E29" }}
          className="flex flex-col items-center justify-center gap-6 mb-4 border-b-2 pb-10">
          <div className="flex items-center justify-center gap-10 w-full">
            {logoUrl ? (
              <img
                src={`${API_BASE}${logoUrl}`}
                crossOrigin="anonymous"
                alt="School Logo"
                className="h-28 w-28 object-contain"
              />
            ) : (
              <div
                style={{ backgroundColor: "#f3f4f6" }}
                className="h-28 w-28 rounded-full flex items-center justify-center font-bold text-4xl text-[#061E29]">
                {schoolName?.charAt(0)}
              </div>
            )}
            <div className="text-center flex-1">
              <h1
                style={{ color: "#061E29" }}
                className="text-3xl font-black uppercase tracking-tight mb-1">
                {schoolName}
              </h1>
              <p
                style={{ color: "#4b5563" }}
                className="text-base font-bold uppercase tracking-[0.2em] mb-2">
                Basic Education Early Registration
              </p>
              <div
                style={{ backgroundColor: "#061E29", color: "#ffffff" }}
                className="flex items-center justify-center px-6 py-3 rounded-xl text-xs font-black tracking-widest uppercase text-center">
                <p className="-mt-3">
                  Official Confirmation Slip
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="text-center space-y-4">
            <h2
              style={{ color: "#061E29" }}
              className="text-4xl font-black tracking-tight">
              Registration Received!
            </h2>
            <p style={{ color: "#4b5563" }} className="text-xl font-medium">
              Early registration for <span style={{ color: "#061E29" }} className="font-bold">{learnerName}</span> has been successfully submitted.
            </p>
          </div>

          <div
            style={{ backgroundColor: "#f9fafb", borderColor: "#061E29" }}
            className="p-12 rounded-3xl border-4 text-center space-y-6 relative overflow-hidden border-dashed">
            <p
              style={{ color: "#6b7280" }}
              className="text-xs uppercase tracking-[0.3em] font-black">
              Registration Reference Number
            </p>
            <p
              style={{ color: "#061E29" }}
              className="text-7xl  font-black tracking-tighter">
              {referenceNumber}
            </p>

            <div className="pt-6 flex justify-center gap-12 text-center">
              <div className="space-y-1">
                <p
                  style={{ color: "#9ca3af" }}
                  className="text-[0.625rem] font-black uppercase">
                  Date Generated
                </p>
                <p style={{ color: "#061E29" }} className="text-sm font-bold">
                  {formatManilaDate(getManilaNow(), {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div className="space-y-1">
                <p
                  style={{ color: "#9ca3af" }}
                  className="text-[0.625rem] font-black uppercase">
                  Time Generated
                </p>
                <p style={{ color: "#061E29" }} className="text-sm font-bold">
                  {formatManilaDate(getManilaNow(), {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          </div>

          <div
            style={{ borderColor: "#f3f4f6" }}
            className="space-y-8 bg-white p-8 border-2 rounded-3xl">
            <h3
              style={{ color: "#061E29" }}
              className="text-2xl font-black flex items-center gap-3 uppercase tracking-tight -mt-3">
              Important Next Steps
            </h3>
            <div className="grid grid-cols-1 gap-6 text-sm">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div
                    style={{ backgroundColor: "#061E29" }}
                    className="w-2 h-2 rounded-full mt-3 shrink-0"
                  />
                  <div>
                    <p
                      style={{ color: "#061E29" }}
                      className="font-black uppercase tracking-wide">
                      {step.title}
                    </p>
                    <p style={{ color: "#4b5563" }} className="font-medium">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{ borderColor: "#061E29" }}
            className="border-t-4 pt-12 mt-12 flex justify-between items-end">
            <div className="space-y-2">
              <p
                style={{ color: "#9ca3af" }}
                className="text-[0.625rem] font-black uppercase tracking-widest">
                Security Validation
              </p>
              <div
                style={{ backgroundColor: "#061E29", color: "#ffffff" }}
                className="px-4 py-2  text-xs font-bold uppercase">
                VALID_EARLY_REG_{referenceNumber.replace(/-/g, "_")}
              </div>
            </div>
            <div className="text-right space-y-1">
              <p
                style={{ color: "#061E29" }}
                className="font-black uppercase tracking-tight text-lg leading-none">
                EnrollPro Management System
              </p>
              <p
                style={{ color: "#9ca3af" }}
                className="text-[0.625rem] font-bold">
                This document is electronically generated. No physical signature
                required.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Web UI Card */}
      <Card className="shadow-2xl border-2 border-primary/10 rounded-[2.5rem] overflow-hidden bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-2 pt-10">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
              <CheckCircle2 className="w-20 h-20 text-primary relative z-10 animate-in zoom-in duration-500" />
            </div>
          </div>
          <CardTitle className="text-3xl font-black text-primary uppercase tracking-tight">
            Registration Successful!
          </CardTitle>
          <CardDescription className="text-lg font-medium text-muted-foreground mt-2">
            Nai-submit na ang early registration ni{" "}
            <span className="font-bold text-foreground">{learnerName}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 p-8 md:p-12">
          <div
            onClick={handleCopy}
            className={cn(
              "bg-muted/50 p-10 rounded-[2rem] text-center space-y-4 border-2 border-dashed cursor-pointer transition-all duration-300 group relative overflow-hidden",
              copied
                ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                : "border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5",
            )}>
            <p className="text-[0.7rem] text-muted-foreground uppercase tracking-[0.3em] font-black">
              Your Reference Number
            </p>
            <div className="flex items-center justify-center gap-4">
              <p className="text-3xl sm:text-5xl font-black text-primary tracking-tighter tabular-nums">
                {referenceNumber}
              </p>
            </div>
            <p
              className={cn(
                "text-xs font-black tracking-widest transition-all duration-300",
                copied ? "text-primary scale-110" : "text-muted-foreground group-hover:text-primary/70",
              )}>
              {copied ? "COPIED TO CLIPBOARD!" : "CLICK TO COPY"}
            </p>
          </div>

          <div className="space-y-6 bg-white/50 p-8 rounded-3xl border border-border/50">
            <h3 className="font-black text-xl flex items-center gap-3 uppercase tracking-tight text-primary">
              <FileText className="w-6 h-6" />
              Next Steps
            </h3>
            <div className="grid grid-cols-1 gap-5">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-4 items-start group">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-black uppercase tracking-wide text-sm text-foreground/80">
                      {step.title}
                    </p>
                    <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6">
            <Button
              variant="outline"
              size="lg"
              className="h-14 px-8 font-black flex-1 gap-2 rounded-2xl border-2 uppercase tracking-widest text-xs hover:bg-muted"
              onClick={onRegisterAnother}>
              <ArrowLeft className="w-4 h-4" />
              Register Another
            </Button>
            <Button
              size="lg"
              className="h-14 px-8 font-black flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/20 rounded-2xl uppercase tracking-widest text-xs"
              onClick={downloadPDF}
              disabled={isGenerating}>
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isGenerating
                ? "Generating PDF..."
                : "Download Confirmation Slip"}
            </Button>
          </div>
          
          <div className="text-center">
            <Button
              variant="link"
              className="text-muted-foreground font-bold hover:text-primary transition-colors gap-2 group"
              onClick={() => window.location.href = "/"}>
              <Home className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
              Return to Website Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
