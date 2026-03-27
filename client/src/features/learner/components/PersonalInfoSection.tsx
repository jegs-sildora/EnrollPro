import { format } from "date-fns";
import { User } from "lucide-react";

import type { LearnerProfile } from "../types";

interface Props {
  learner: LearnerProfile;
}

export function PersonalInfoSection({ learner }: Props) {
  const fullName =
    `${learner.lastName}, ${learner.firstName} ${learner.middleName || ""}${learner.suffix ? ` ${learner.suffix}` : ""}`.trim();

  const info = [
    { label: "Full Name", value: fullName },
    { label: "LRN", value: learner.lrn },
    {
      label: "Date of Birth",
      value: format(new Date(learner.birthDate), "MMMM d, yyyy"),
    },
    { label: "Sex", value: learner.sex },
    { label: "Mother Tongue", value: learner.motherTongue || "N/A" },
    { label: "Nationality", value: learner.nationality || "Filipino" },
    { label: "Religion", value: learner.religion || "N/A" },
  ];

  const addr = learner.currentAddress;
  const addressString = addr
    ? [
        addr.houseNumber,
        addr.street,
        addr.barangay ? `Brgy. ${addr.barangay}` : null,
        addr.municipality,
        addr.province,
      ]
        .filter(Boolean)
        .join(", ")
    : "N/A";

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-2 border-b pb-2 mb-4 border-primary/20'>
        <User className='h-5 w-5 text-primary' />
        <h2 className='text-sm font-bold uppercase tracking-widest text-primary'>
          My Information
        </h2>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4'>
        {info.map((item) => (
          <div
            key={item.label}
            className='grid grid-cols-[140px_1fr] gap-4 items-start py-2 border-b border-muted/30 last:border-0 md:[&:nth-last-child(-n+2)]:border-0'>
            <span className='text-[10px] font-bold text-muted-foreground uppercase tracking-wider pt-0.5'>
              {item.label}
            </span>
            <span className='text-sm font-bold text-foreground'>
              {item.value}
            </span>
          </div>
        ))}
        <div className='grid grid-cols-[140px_1fr] gap-4 items-start py-2 col-span-1 md:col-span-2'>
          <span className='text-[10px] font-bold text-muted-foreground uppercase tracking-wider pt-0.5'>
            Address
          </span>
          <span className='text-sm font-bold text-foreground leading-relaxed'>
            {addressString}
          </span>
        </div>
      </div>
    </div>
  );
}
