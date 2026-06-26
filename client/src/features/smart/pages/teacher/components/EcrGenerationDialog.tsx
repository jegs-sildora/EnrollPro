// @ts-nocheck
import React from "react";
import { FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent } from "@/features/smart/components/ui/dialog";

interface EcrGenerationDialogProps {
  open: boolean;
  percentage: number;
  progress: string;
}

export function EcrGenerationDialog({ open, percentage, progress }: EcrGenerationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md rounded-[2.5rem] border-0 shadow-2xl p-0 overflow-hidden bg-white">
        <div className="p-10 text-center">
          <div className="relative w-32 h-32 mx-auto mb-8">
            <svg className="w-full h-full -rotate-90">
              <circle cx="64" cy="64" r="58" stroke="#f8fafc" strokeWidth="10" fill="none" />
              <circle
                cx="64"
                cy="64"
                r="58"
                stroke="var(--theme-primary)"
                strokeWidth="10"
                fill="none"
                strokeDasharray="364.4"
                strokeDashoffset={364.4 * (1 - percentage / 100)}
                className="transition-all duration-700 ease-out"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-black" style={{ color: "var(--theme-primary)" }}>
                {percentage}%
              </span>
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-900 mb-2">Generating Workbook</h3>
          <p className="text-slate-500 font-medium text-sm mb-8 px-4">{progress}</p>
          <div className="bg-slate-50 rounded-3xl p-6 text-left border border-slate-100 flex items-start gap-5">
            <div className="p-3 rounded-2xl bg-white shadow-sm">
              <FileSpreadsheet className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Message</p>
              <p className="text-xs font-bold text-slate-700 leading-relaxed">
                Your Electronic Class Record is being auto-filled with student data. It will download automatically.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
