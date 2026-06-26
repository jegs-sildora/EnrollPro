import { useSettingsStore } from "@/store/settings.slice";
import { useEffect, useState } from "react";

export function useBOSYSentinel() {
  const { enrollOpenDate: bosyStartDate, enrollCloseDate: bosyEndDate } = useSettingsStore();
  const [isEnrollmentOpen, setIsEnrollmentOpen] = useState(false);

  useEffect(() => {
    const checkStatus = () => {
      if (!bosyStartDate || !bosyEndDate) {
        setIsEnrollmentOpen(false);
        return;
      }

      const toManilaDateToken = (value: Date): number => {
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Manila",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        const parts = formatter.formatToParts(value);
        const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
        const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
        const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");
        return year * 10000 + month * 100 + day;
      };

      const open = new Date(bosyStartDate);
      const close = new Date(bosyEndDate);
      if (Number.isNaN(open.getTime()) || Number.isNaN(close.getTime())) {
        setIsEnrollmentOpen(false);
        return;
      }

      const todayToken = toManilaDateToken(new Date());
      const openToken = toManilaDateToken(open);
      const closeToken = toManilaDateToken(close);

      setIsEnrollmentOpen(todayToken >= openToken && todayToken <= closeToken);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 1000);
    return () => clearInterval(interval);
  }, [bosyStartDate, bosyEndDate]);

  return {
    isEnrollmentOpen,
    bosyStartDate,
    bosyEndDate,
  };
}

