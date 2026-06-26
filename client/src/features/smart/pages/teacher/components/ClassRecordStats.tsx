// @ts-nocheck
import React from "react";
import { Award, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/features/smart/components/ui/card";

interface ClassRecordStatsProps {
  avg: number;
  passed: number;
  total: number;
  highest: number;
}

export function ClassRecordStats({ avg, passed, total, highest }: ClassRecordStatsProps) {
  const needsSupport = total - passed;
  const passingRate = total > 0 ? `${Math.round((passed / total) * 100)}%` : "0%";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {[
        { label: "Class Average", value: avg.toFixed(1), icon: Target, color: "indigo" },
        { label: "Passing Rate", value: passingRate, icon: TrendingUp, color: "emerald" },
        { label: "Highest Grade", value: highest, icon: Award, color: "amber" },
        { label: "Needs Support", value: needsSupport, icon: TrendingDown, color: "rose" },
      ].map((stat) => (
        <Card key={stat.label} className="border-0 shadow-lg shadow-slate-200/50 rounded-[2rem] bg-white overflow-hidden group hover:-translate-y-1 transition-all duration-300">
          <CardContent className="p-7 flex flex-col justify-between h-full">
            <div className="p-3 rounded-2xl w-fit mb-4 bg-slate-50 group-hover:bg-white transition-colors shadow-sm">
              <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-3xl font-black text-slate-900 leading-none">{stat.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
