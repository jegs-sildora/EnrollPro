import { useEffect } from "react";
import { useHeaderStore } from "@/store/header.slice";
import { SectioningWorkspace } from "../components/SectioningWorkspace";

export default function EnrollmentManagement() {
  const setTitle = useHeaderStore((s) => s.setTitle);

  useEffect(() => {
    setTitle("Class Sectioning and SF1");
    return () => setTitle(null);
  }, [setTitle]);

  return (
<div className="flex flex-col flex-1 h-full w-full min-h-0">
      <SectioningWorkspace />
    </div>
  );
}
