import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import {
  CheckCircle2,
  FileText,
  Download,
  Home,
  Loader2,
  Search,
} from "lucide-react";
import { useSettingsStore } from "@/store/settings.slice";
import { cn, formatManilaDate, getManilaNow } from "@/shared/lib/utils";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useNavigate } from "react-router";
import TrackingNextSteps from "@/features/admission/components/TrackingNextSteps";
import type { ApplicationSubmitResponse } from "@enrollpro/shared";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

type EnrollmentSuccessProps = Pick<
  ApplicationSubmitResponse,
  | "trackingNumber"
  | "applicantType"
  | "programType"
  | "status"
  | "currentStep"
  | "assessmentData"
> & {
  onBackHome?: () => void;
};

export default function EnrollmentSuccess({
  trackingNumber,
  applicantType,
  programType,
  status,
  currentStep,
  assessmentData,
  onBackHome,
}: EnrollmentSuccessProps) {
  const { schoolName, logoUrl } = useSettingsStore();
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
      pdf.save(`Early_Registration_Confirmation_${trackingNumber}.pdf`);

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
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      {/* PDF Container */}
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
                BASIC EDUCATION ENROLLMENT FORM Portal
              </p>
              <div
                style={{ backgroundColor: "#061E29", color: "#ffffff" }}
                className="flex items-center justify-center px-6 py-3 rounded-xl text-xs font-black tracking-widest uppercase text-center">
                <p className="-mt-3">
                  Official BASIC EDUCATION ENROLLMENT FORM Confirmation Slip
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
              Application Received!
            </h2>
            <p style={{ color: "#4b5563" }} className="text-xl font-medium">
              Your application has been successfully submitted to{" "}
              <span style={{ color: "#061E29" }} className="font-bold">
                {schoolName}
              </span>
              .
            </p>
          </div>

          <div
            style={{ backgroundColor: "#f9fafb", borderColor: "#061E29" }}
            className="p-12 rounded-lg border-4 text-center space-y-6 relative overflow-hidden border-dashed">
            <p
              style={{ color: "#6b7280" }}
              className="text-xs uppercase tracking-[0.3em] font-black">
              Application Tracking Number
            </p>

            <p
              style={{ color: "#061E29" }}
              className="text-7xl  font-black tracking-tighter">
              {trackingNumber}
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
            className="space-y-8 bg-white p-8 border-2 rounded-lg">
            <h3
              style={{ color: "#061E29" }}
              className="text-2xl font-black flex items-center gap-3 uppercase tracking-tight -mt-3">
              Important Next Steps
            </h3>
            <TrackingNextSteps
              applicantType={applicantType}
              programType={programType}
              status={status}
              currentStep={currentStep}
              assessmentData={assessmentData}
            />
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
                className="px-4 py-2  text-xs font-bold">
                VALID_AUTHENTIC_SUBMISSION_{trackingNumber?.replace(/-/g, "_") || "PENDING"}
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

      {/* Regular Web UI */}
      <Card className="shadow-lg border-2 border-primary/10">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-16 h-16 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">
            Application Submitted Successfully!
          </CardTitle>
          <CardDescription className="text-lg">
            Thank you for applying to
            {schoolName ? <span className="font-bold"> {schoolName}</span> : ""}
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div
            onClick={handleCopy}
            className={cn(
              "bg-muted p-8 rounded-2xl text-center space-y-3 border-2 border-dashed cursor-pointer transition-all duration-200 group relative overflow-hidden",
              copied
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/2",
            )}>
            <p className="text-[0.625rem] text-muted-foreground uppercase tracking-[0.2em] font-black">
              Your Application Tracking Number
            </p>
            <div className="flex items-center justify-center gap-4">
              <p className="text-xl sm:text-4xl font-black text-primary tracking-tighter">
                {trackingNumber}
              </p>
            </div>
            <p
              className={cn(
                "text-xs font-black transition-all duration-200",
                copied ? "text-primary scale-110" : "text-muted-foreground",
              )}>
              {copied ? "COPIED TO CLIPBOARD!" : "CLICK TO COPY"}
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Next Steps
            </h3>
            <TrackingNextSteps
              applicantType={applicantType}
              programType={programType}
              status={status}
              currentStep={currentStep}
              assessmentData={assessmentData}
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-4 pt-10 border-t border-border/60">
            <Button
              variant="outline"
              className="h-12 px-8 font-bold flex-1 gap-2"
              onClick={onBackHome}>
              <Home className="w-4 h-4" />
              Back to Home
            </Button>
            <Button
              className="h-12 px-8 font-bold flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate("/monitor")}>
              <Search className="w-4 h-4" />
              Monitor Status
            </Button>
            <Button
              className="h-12 px-8 font-bold flex-1 gap-2 bg-slate-800 text-white hover:bg-slate-700"
              onClick={downloadPDF}
              disabled={isGenerating}>
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isGenerating ? "Generating..." : "Download Slip"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
