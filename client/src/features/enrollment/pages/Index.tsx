import { useEffect } from "react";
import { useHeaderStore } from "@/store/header.slice";
import { SectioningWorkspace } from "../components/SectioningWorkspace";
import { PhaseBanner } from "@/shared/components/PhaseBanner";

export default function EnrollmentManagement() {
  const setTitle = useHeaderStore((s) => s.setTitle);

  useEffect(() => {
    setTitle("Class Sectioning and SF1");
    return () => setTitle(null);
  }, [setTitle]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] min-h-0 space-y-4 sm:space-y-6">
      <PhaseBanner />
      <SectioningWorkspace />
    </div>
  );
}
