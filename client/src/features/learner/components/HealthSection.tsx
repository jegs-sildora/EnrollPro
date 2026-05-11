import { format, differenceInYears } from "date-fns";
import { Activity, Info } from "lucide-react";
import { computeBmi, computeHfa } from "@/shared/constants/bmi";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { useMemo } from "react";

import type { LearnerProfile, HealthRecord } from "../types";

interface Props {
  learner: LearnerProfile;
}

interface ProcessedHealthRecord extends HealthRecord {
  bmi: number;
  category: string;
  color: string;
  hfa: string;
  hfaColor: string;
}

export function HealthSection({ learner }: Props) {
  const records = learner.healthRecords || [];
  const birthDate = new Date(learner.birthDate);
  const sex = learner.sex;

  const getRecordDetails = (record: HealthRecord): ProcessedHealthRecord => {
    const age = differenceInYears(new Date(record.assessmentDate), birthDate);
    const bmiResult = computeBmi(record.weightKg, record.heightCm, age, sex);
    const hfaResult = computeHfa(record.heightCm, age, sex);
    return {
      ...record,
      ...bmiResult,
      hfa: hfaResult.category,
      hfaColor: hfaResult.color,
    };
  };

  const processedRecords = records.map(getRecordDetails);
  const latest = processedRecords[0];

  const columns = useMemo<ColumnDef<ProcessedHealthRecord>[]>(
    () => [
      {
        accessorKey: "schoolYear",
        header: "Year",
        cell: ({ row }) => (
          <span className="text-xs font-bold text-left block">
            {row.original.schoolYear}
          </span>
        ),
      },
      {
        accessorKey: "assessmentPeriod",
        header: "Period",
        cell: ({ row }) => (
          <span className="text-xs text-foreground text-left block">
            {row.original.assessmentPeriod}
          </span>
        ),
      },
      {
        accessorKey: "weightKg",
        header: () => <div className="text-center">Weight</div>,
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-center block">
            {row.original.weightKg.toFixed(1)} kg
          </span>
        ),
      },
      {
        accessorKey: "heightCm",
        header: () => <div className="text-center">Height</div>,
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-center block">
            {row.original.heightCm.toFixed(1)} cm
          </span>
        ),
      },
      {
        accessorKey: "bmi",
        header: () => <div className="text-center">BMI</div>,
        cell: ({ row }) => (
          <span className="text-xs font-bold text-center block ">
            {row.original.bmi.toFixed(1)}
          </span>
        ),
      },
      {
        accessorKey: "category",
        header: "Nutritional Status",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span
              className={`text-xs font-black uppercase  text-left block ${
                r.color === "red"
                  ? "text-red-600"
                  : r.color === "orange"
                    ? "text-orange-600"
                    : "text-emerald-600"
              }`}>
              ● {r.category}
            </span>
          );
        },
      },
      {
        accessorKey: "hfa",
        header: () => <div className="text-right">HFA</div>,
        cell: ({ row }) => (
          <span className="text-xs font-bold text-foreground text-right block">
            {row.original.hfa}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="text-xs font-bold uppercase  text-primary">
          Health Monitoring (SF8)
        </h2>
      </div>

      {latest ? (
        <div className="space-y-8">
          {/* Latest Measurement Card */}
          <div className="bg-primary/5 p-6 rounded-lg border border-primary/10 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xs font-black text-primary uppercase ">
                  Latest Measurement
                </h3>
                <p className="text-xs text-foreground font-bold uppercase mt-0.5">
                  SY {latest.schoolYear} • {latest.assessmentPeriod}
                </p>
              </div>
              <div className="px-3 py-1 bg-white rounded-full border border-primary/10 text-xs font-bold text-primary shadow-sm">
                Measured on {format(new Date(latest.assessmentDate), "MMMM d, yyyy")}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Weight", value: `${latest.weightKg.toFixed(1)} kg` },
                { label: "Height", value: `${latest.heightCm.toFixed(1)} cm` },
                { label: "BMI", value: latest.bmi.toFixed(1) },
                {
                  label: "Nutritional Status",
                  value: latest.category,
                  color: latest.color,
                },
                {
                  label: "Height for Age",
                  value: latest.hfa,
                  color: latest.hfaColor,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-white shadow-sm flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase  mb-1.5 leading-tight">
                    {item.label}
                  </span>
                  <span
                    className={`text-sm font-black  ${item.color === "red" ? "text-red-600" : item.color === "orange" ? "text-orange-600" : item.color === "blue" ? "text-blue-600" : "text-emerald-600"}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* History Table */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-foreground uppercase  ml-1">
              Historical Records
            </h3>
            <div className="rounded-xl border border-border overflow-hidden bg-white/50 backdrop-blur-sm shadow-sm">
              <DataTable
                columns={columns}
                data={processedRecords}
                className="border-none rounded-none bg-transparent"
                noResultsMessage="No measurements recorded."
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 rounded-lg bg-muted/20 border border-dashed border-border text-center">
          <p className="text-sm text-foreground font-medium italic">
            No health records have been entered for your account yet.
          </p>
          <p className="text-xs text-foreground mt-2 font-bold italic">
            Please visit the school clinic for your annual SF8 assessment.
          </p>
        </div>
      )}

      {/* WHO Disclaimer */}
      <div className="flex gap-4 p-5 bg-white/50 backdrop-blur-sm rounded-xl border border-border shadow-sm">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Info className="h-5 w-5 text-foreground" />
        </div>
        <p className="text-xs leading-relaxed text-foreground font-medium">
          <span className="font-bold text-foreground">Important Disclaimer:</span> BMI and nutritional status are computed using WHO 2007 Growth
          Reference for school-age children (5–19 years). This information is
          for reference only. Section assignments and academic records are based on verified official school forms. Consult the school clinic or a qualified health
          professional for medical advice.
        </p>
      </div>
    </div>
  );
}
