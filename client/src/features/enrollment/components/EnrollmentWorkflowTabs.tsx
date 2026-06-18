import { motion } from "motion/react";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  ENROLLMENT_SUB_MENU_OPTIONS,
  type EnrollmentSubMenu,
} from "@/features/enrollment/workflow.constants";

interface EnrollmentWorkflowTabsProps {
  value: EnrollmentSubMenu;
  onValueChange: (value: EnrollmentSubMenu) => void;
}

export function EnrollmentWorkflowTabs({
  value,
  onValueChange,
}: EnrollmentWorkflowTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) =>
        onValueChange(nextValue as EnrollmentSubMenu)
      }
      className="w-full">
      <TabsList className="grid w-full h-auto gap-1 p-1 bg-white border border-border relative grid-cols-2 lg:grid-cols-4">
        {ENROLLMENT_SUB_MENU_OPTIONS.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className="w-full min-w-0 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {value === option.value && (
              <motion.div
                layoutId="enrollment-active-pill"
                className="absolute inset-0 bg-primary rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className="relative z-20 text-base sm:text-base leading-tight">
              {option.label}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
