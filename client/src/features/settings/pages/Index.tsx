import { useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import SchoolProfileTab from "./SchoolProfileTab";
import SchoolYearTab from "./SchoolYearTab";
import CurriculumTab from "./CurriculumTab";
import SectionsTab from "./SectionsTab";
import EnrollmentGateTab from "./EnrollmentGateTab";
import { motion, AnimatePresence } from "motion/react";

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "profile";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          System Configuration
        </h1>
        <p className="text-sm text-muted-foreground font-medium">
          Manage school identity, school year, curriculum, and enrollment
          settings
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-6 p-1 bg-white border-border">
          <TabsTrigger
            value="profile"
            className="flex-1 min-w-25 font-bold transition-all"
          >
            School Profile
          </TabsTrigger>
          <TabsTrigger
            value="school-year"
            className="flex-1 min-w-25 font-bold transition-all"
          >
            School Year
          </TabsTrigger>
          <TabsTrigger
            value="curriculum"
            className="flex-1 min-w-25 font-bold transition-all"
          >
            Curriculum
          </TabsTrigger>
          <TabsTrigger
            value="sections"
            className="flex-1 min-w-25 font-bold transition-all"
          >
            Sections
          </TabsTrigger>
          <TabsTrigger
            value="enrollment"
            className="flex-1 min-w-25 font-bold transition-all"
          >
            Enrollment Gate
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          {activeTab === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <TabsContent
                value="profile"
                forceMount
                className="mt-0 focus-visible:outline-none ring-0"
              >
                <SchoolProfileTab />
              </TabsContent>
            </motion.div>
          )}

          {activeTab === "school-year" && (
            <motion.div
              key="school-year"
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <TabsContent
                value="school-year"
                forceMount
                className="mt-0 focus-visible:outline-none ring-0"
              >
                <SchoolYearTab />
              </TabsContent>
            </motion.div>
          )}

          {activeTab === "curriculum" && (
            <motion.div
              key="curriculum"
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <TabsContent
                value="curriculum"
                forceMount
                className="mt-0 focus-visible:outline-none ring-0"
              >
                <CurriculumTab />
              </TabsContent>
            </motion.div>
          )}

          {activeTab === "sections" && (
            <motion.div
              key="sections"
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <TabsContent
                value="sections"
                forceMount
                className="mt-0 focus-visible:outline-none ring-0"
              >
                <SectionsTab />
              </TabsContent>
            </motion.div>
          )}

          {activeTab === "enrollment" && (
            <motion.div
              key="enrollment"
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <TabsContent
                value="enrollment"
                forceMount
                className="mt-0 focus-visible:outline-none ring-0"
              >
                <EnrollmentGateTab />
              </TabsContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Tabs>
    </div>
  );
}
