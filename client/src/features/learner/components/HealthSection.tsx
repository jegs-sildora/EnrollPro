import { format, differenceInYears } from "date-fns";
import { Activity, Info } from "lucide-react";
import { computeBmi, computeHfa } from "@/shared/constants/bmi";

import type { LearnerProfile, HealthRecord } from "../types";

interface Props {
  learner: LearnerProfile;
}

export function HealthSection({ learner }: Props) {
  const records = learner.healthRecords || [];
  const birthDate = new Date(learner.birthDate);
  const sex = learner.sex as "Male" | "Female";

  const getRecordDetails = (record: HealthRecord) => {
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

  return (
    <div className='space-y-8'>
      <div className='flex items-center gap-2 border-b pb-2 mb-4 border-blue-200'>
        <Activity className='h-5 w-5 text-blue-600' />
        <h2 className='text-sm font-bold uppercase tracking-widest text-blue-700'>
          Health Records (SF8)
        </h2>
      </div>

      {latest ? (
        <div className='space-y-6'>
          <div className='bg-blue-50/50 p-6 rounded-xl border border-blue-100'>
            <h3 className='text-xs font-bold text-blue-800 uppercase tracking-wider mb-4'>
              Most Recent Measurement
            </h3>
            <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-blue-700/70 mb-6 font-semibold'>
              <span>School Year: {latest.schoolYear}</span>
              <span>•</span>
              <span>{latest.assessmentPeriod}</span>
              <span>•</span>
              <span>
                {format(new Date(latest.assessmentDate), "MMMM d, yyyy")}
              </span>
            </div>

            <div className='grid grid-cols-2 md:grid-cols-5 gap-4'>
              {[
                { label: "Weight", value: `${latest.weightKg.toFixed(1)} kg` },
                { label: "Height", value: `${latest.heightCm.toFixed(1)} cm` },
                { label: "BMI", value: `${latest.bmi.toFixed(1)} kg/m²` },
                {
                  label: "Status",
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
                  className='bg-white p-3 rounded-lg border border-blue-100 shadow-sm'>
                  <span className='block text-[10px] font-bold text-blue-800/60 uppercase tracking-tighter mb-1'>
                    {item.label}
                  </span>
                  <span
                    className={`text-sm font-bold ${item.color === "red" ? "text-red-600" : item.color === "orange" ? "text-orange-600" : item.color === "blue" ? "text-blue-600" : "text-emerald-600"}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className='space-y-4'>
            <h3 className='text-xs font-bold text-muted-foreground uppercase tracking-wider'>
              All Measurements
            </h3>
            <div className='rounded-lg border border-muted/30 overflow-hidden bg-muted/5'>
              <table className='w-full text-sm'>
                <thead className='bg-muted/30'>
                  <tr className='text-[10px] uppercase tracking-wider text-muted-foreground font-bold'>
                    <th className='px-4 py-2 text-left'>Year</th>
                    <th className='px-4 py-2 text-left'>Period</th>
                    <th className='px-4 py-2 text-center'>Weight</th>
                    <th className='px-4 py-2 text-center'>Height</th>
                    <th className='px-4 py-2 text-center'>BMI</th>
                    <th className='px-4 py-2 text-left'>Status</th>
                    <th className='px-4 py-2 text-right'>HFA</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-muted/30'>
                  {processedRecords.map((r, i: number) => (
                    <tr key={i} className='hover:bg-muted/10 transition-colors'>
                      <td className='px-4 py-3 text-xs font-semibold'>
                        {r.schoolYear}
                      </td>
                      <td className='px-4 py-3 text-xs'>
                        {r.assessmentPeriod}
                      </td>
                      <td className='px-4 py-3 text-xs text-center'>
                        {r.weightKg.toFixed(1)}
                      </td>
                      <td className='px-4 py-3 text-xs text-center'>
                        {r.heightCm.toFixed(1)}
                      </td>
                      <td className='px-4 py-3 text-xs text-center font-mono'>
                        {r.bmi.toFixed(1)}
                      </td>
                      <td className='px-4 py-3 text-xs'>
                        <span
                          className={`font-bold ${r.color === "red" ? "text-red-600" : r.color === "orange" ? "text-orange-600" : "text-emerald-600"}`}>
                          ● {r.category}
                        </span>
                      </td>
                      <td className='px-4 py-3 text-right text-xs font-medium'>
                        {r.hfa}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className='text-center py-12 bg-muted/10 rounded-xl border border-dashed border-muted'>
          <p className='text-sm text-muted-foreground'>
            No health records have been entered for your account yet.
          </p>
          <p className='text-xs text-muted-foreground mt-1 italic'>
            Please contact the school registrar or clinic for assistance.
          </p>
        </div>
      )}

      <div className='flex gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200'>
        <Info className='h-5 w-5 text-slate-400 shrink-0' />
        <p className='text-[10px] leading-relaxed text-slate-500'>
          BMI and nutritional status are computed using WHO 2007 Growth
          Reference for school-age children (5–19 years). This information is
          for reference only. Consult the school clinic or a qualified health
          professional for medical advice.
        </p>
      </div>
    </div>
  );
}
