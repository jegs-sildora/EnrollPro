import { motion } from "motion/react";
import { cn } from "@/shared/lib/utils";
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
      <TabsList className="grid w-full h-auto gap-1 mb-4 p-1 bg-white border border-border rounded-xl relative shadow-sm grid-cols-2 lg:grid-cols-4">
        {ENROLLMENT_SUB_MENU_OPTIONS.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className="w-full min-w-0 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg">
            {value === option.value && (
              <motion.div
                layoutId="enrollment-active-pill"
                className="absolute inset-0 bg-primary shadow-sm rounded-lg"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span
              className={cn(
                "relative z-20 text-base sm:text-base leading-tight uppercase",
                value === option.value ? "text-primary-foreground" : "text-foreground"
              )}>
              {option.label}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
