import { useState, useEffect } from "react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";

export function useActiveTerm() {
  const { activeSchoolYearId } = useSettingsStore();
  const [activeTerm, setActiveTerm] = useState<string | null>(null);
  const [activeTermLabel, setActiveTermLabel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeSchoolYearId) {
      setActiveTerm(null);
      setActiveTermLabel(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    api.get("/school-years")
      .then((res) => {
        // Find the active school year
        const year = res.data.years?.find((y: unknown) => {
          if (typeof y === "object" && y !== null && "id" in y) {
            return (y as { id: number }).id === activeSchoolYearId;
          }
          return false;
        });

        if (!year) {
          setActiveTerm(null);
          return;
        }

        const now = new Date();
        const checkTerm = (start: string | null | undefined, end: string | null | undefined) => {
          if (!start || !end) return false;
          return now >= new Date(start) && now <= new Date(end);
        };

        const termFormat = (year as any).termFormat || "TRIMESTER";
        const prefix = termFormat === "QUARTERS" ? "QUARTER" : "TERM";

        let activeTermCode = "T1";
        if (checkTerm(year.term1Start, year.term1End)) {
          activeTermCode = "T1";
        } else if (checkTerm(year.term2Start, year.term2End)) {
          activeTermCode = "T2";
        } else if (checkTerm(year.term3Start, year.term3End)) {
          activeTermCode = "T3";
        } else if (checkTerm(year.term4Start, year.term4End)) {
          activeTermCode = "T4";
        }

        setActiveTerm(activeTermCode);
        setActiveTermLabel(`${prefix} ${activeTermCode.replace("T", "")}`);
      })
      .catch(() => {
        setActiveTerm(null);
        setActiveTermLabel(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [activeSchoolYearId]);

  return { activeTerm, activeTermLabel, isLoading };
}
