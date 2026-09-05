import { useState, useEffect } from "react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";

export function useActiveTerm() {
  const { activeSchoolYearId } = useSettingsStore();
  const [activeTerm, setActiveTerm] = useState<string | null>(null);
  const [activeTermLabel, setActiveTermLabel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const handler = () => setNonce(n => n + 1);
    window.addEventListener("refetch-active-term", handler);
    return () => window.removeEventListener("refetch-active-term", handler);
  }, []);

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

        interface SchoolYear {
          id: number;
          termFormat?: string;
          activeTerm?: string;
          term1Start?: string | null;
          term1End?: string | null;
          term2Start?: string | null;
          term2End?: string | null;
          term3Start?: string | null;
          term3End?: string | null;
          term4Start?: string | null;
          term4End?: string | null;
        }

        const sy = year as SchoolYear;
        const termFormat = sy.termFormat || "TRIMESTER";
        const prefix = termFormat === "QUARTERS" ? "QUARTER" : "TERM";

        let activeTermCode = "T1";
        
        if (sy.activeTerm) {
          activeTermCode = sy.activeTerm;
        } else if (checkTerm(sy.term1Start, sy.term1End)) {
          activeTermCode = "T1";
        } else if (checkTerm(sy.term2Start, sy.term2End)) {
          activeTermCode = "T2";
        } else if (checkTerm(sy.term3Start, sy.term3End)) {
          activeTermCode = "T3";
        } else if (checkTerm(sy.term4Start, sy.term4End)) {
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
  }, [activeSchoolYearId, nonce]);

  return { activeTerm, activeTermLabel, isLoading };
}
