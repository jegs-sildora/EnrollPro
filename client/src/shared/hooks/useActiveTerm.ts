import { useState, useEffect } from "react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";

export function useActiveTerm() {
  const { activeSchoolYearId } = useSettingsStore();
  const [activeTerm, setActiveTerm] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeSchoolYearId) {
      setActiveTerm(null);
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

        if (checkTerm(year.term1Start, year.term1End)) {
          setActiveTerm("T1");
        } else if (checkTerm(year.term2Start, year.term2End)) {
          setActiveTerm("T2");
        } else if (checkTerm(year.term3Start, year.term3End)) {
          setActiveTerm("T3");
        } else if (checkTerm(year.term4Start, year.term4End)) {
          setActiveTerm("T4");
        } else {
          // If the date falls outside any explicit range, 
          // default to T1 as per the directive's expectation or leave as null.
          setActiveTerm("T1");
        }
      })
      .catch(() => {
        setActiveTerm(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [activeSchoolYearId]);

  return { activeTerm, isLoading };
}
