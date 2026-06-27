import { useSearchParams } from "react-router";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { VerificationWorkspace } from "../components/VerificationWorkspace";
import { SectioningWorkspace } from "../components/SectioningWorkspace";
import { cn } from "@/shared/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { PhaseBanner } from "@/shared/components/PhaseBanner";

export default function EnrollmentManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "sectioning" ? "sectioning" : "verification";

  const setActiveTab = (val: string) => {
    setSearchParams({ tab: val });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] min-h-0">
      <PhaseBanner />
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between pb-6 flex-shrink-0">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold">
            Sectioning & School Form 1 (SF1) Preparation
          </h1>
          <p className="text-base leading-tight font-extrabold text-foreground">
            Validate submitted credentials and execute batch sectioning to generate official class registers.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-6 p-1 bg-white border-border relative">
          <TabsTrigger
            value="verification"
            className="flex-1 min-w-25 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            {activeTab === "verification" && (
              <motion.div
                layoutId="enrollment-main-tab-pill"
                className="absolute inset-0 bg-primary rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-20 text-base uppercase", activeTab === "verification" ? "text-primary-foreground" : "text-foreground")}>
              Document Verification
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="sectioning"
            className="flex-1 min-w-25 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            {activeTab === "sectioning" && (
              <motion.div
                layoutId="enrollment-main-tab-pill"
                className="absolute inset-0 bg-primary rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-20 text-base uppercase", activeTab === "sectioning" ? "text-primary-foreground" : "text-foreground")}>
              Section Assignment
            </span>
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 w-full h-full min-h-0"
          >
            <TabsContent value="verification" className="h-full m-0 data-[state=inactive]:hidden outline-none">
              <VerificationWorkspace />
            </TabsContent>

            <TabsContent value="sectioning" className="h-full m-0 data-[state=inactive]:hidden outline-none">
              <SectioningWorkspace />
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </div>
  );
}
