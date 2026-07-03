import { useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import SchoolProfileTab from "./SchoolProfileTab";
import SchoolYearTab from "./SchoolYearTab";

import { motion, AnimatePresence } from "motion/react";

import { useSettingsStore } from "@/store/settings.slice";
import { useEffect } from "react";
import api from "@/shared/api/axiosInstance";
import { useHeaderStore } from "@/store/header.slice";

const VALID_TABS = [
  "profile",
  "school-year",
] as const;
type SettingsTab = (typeof VALID_TABS)[number];

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const wizard = searchParams.get("wizard");
  const defaultTab = wizard === "new-school-year" ? "school-year" : "profile";

  const activeTab: SettingsTab = VALID_TABS.includes(
    (requestedTab ?? "") as SettingsTab,
  )
    ? ((requestedTab as SettingsTab) ?? defaultTab)
    : defaultTab;

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  const { activeSchoolYearId } = useSettingsStore();
  useEffect(() => {
    async function checkStatus() {
      if (!activeSchoolYearId) return;
      try {
        await api.get("/school-years");
      } catch (err) {
        // silent
      }
    }
    checkStatus();
  }, [activeSchoolYearId]);

  const setTitle = useHeaderStore((s) => s.setTitle);

  useEffect(() => {
    setTitle("Global System Configuration");
    return () => setTitle(null);
  }, [setTitle]);

  return (
    <div className="space-y-6">
      <Tabs
        onValueChange={handleTabChange}
        className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-6 p-1 bg-white border-border relative">
          <TabsTrigger
            value="profile"
            className="flex-1 min-w-25 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary-foreground text-foreground">
            {activeTab === "profile" && (
              <motion.div
                layoutId="settings-active-pill"
                className="absolute inset-0 bg-primary rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className="relative z-20">School Profile</span>
          </TabsTrigger>
          <TabsTrigger
            value="school-year"
            className="flex-1 min-w-25 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary-foreground text-foreground">
            {activeTab === "school-year" && (
              <motion.div
                layoutId="settings-active-pill"
                className="absolute inset-0 bg-primary rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className="relative z-20">School Year Management</span>
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          {activeTab === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full">
              <TabsContent
                value="profile"
                forceMount
                className="mt-0 focus-visible:outline-none ring-0">
                <SchoolProfileTab />
              </TabsContent>
            </motion.div>
          )}

          {activeTab === "school-year" && (
            <motion.div
              key="school-year"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full">
              <TabsContent
                value="school-year"
                forceMount
                className="mt-0 focus-visible:outline-none ring-0">
                <SchoolYearTab />
              </TabsContent>
            </motion.div>
          )}

        </AnimatePresence>
      </Tabs>
    </div>
  );
}
