import { useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import SchoolProfileTab from "./SchoolProfileTab";
import SchoolYearTab from "./SchoolYearTab";
import { cn } from "@/shared/lib/utils";

import { motion, AnimatePresence } from "motion/react";

import { useSettingsStore } from "@/store/settings.slice";
import { useCallback, useEffect } from "react";
import api from "@/shared/api/axiosInstance";
import { useHeaderStore } from "@/store/header.slice";
import { useGuardedTabChange } from "@/shared/hooks/useUnsavedChanges";

const VALID_TABS = [
  "profile",
  "school-year",
] as const;
type SettingsTab = (typeof VALID_TABS)[number];

export default function Settings() {
  const { activeSchoolYearId, uiPreferences, updateUiPreference } = useSettingsStore();
  const requestedTab = uiPreferences.settingsTab;

  const activeTab: SettingsTab = VALID_TABS.includes(
    (requestedTab ?? "") as SettingsTab,
  )
    ? (requestedTab as SettingsTab)
    : "profile";

  const handleTabChange = useCallback((value: string) => {
    updateUiPreference("settingsTab", value);
  }, [updateUiPreference]);
  const guardedTabChange = useGuardedTabChange(handleTabChange);

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
    <div className="flex flex-1 h-full w-full min-h-0 flex-col">
      <Tabs
        value={activeTab}
        onValueChange={guardedTabChange}
        className="w-full">
        <TabsList className="w-full flex flex-col sm:flex-row h-auto gap-1 mb-4 p-1 bg-muted border border-border rounded-xl relative shadow-sm">
          <TabsTrigger
            value="profile"
            className="w-full sm:flex-1 min-w-25 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg py-2">
            {activeTab === "profile" && (
              <motion.div
                layoutId="settings-active-pill"
                className="absolute inset-0 bg-primary shadow-sm rounded-lg"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-20 uppercase text-sm sm:text-base", activeTab === "profile" ? "text-primary-foreground" : "text-foreground")}>School Profile</span>
          </TabsTrigger>
          <TabsTrigger
            value="school-year"
            className="w-full sm:flex-1 min-w-25 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg py-2">
            {activeTab === "school-year" && (
              <motion.div
                layoutId="settings-active-pill"
                className="absolute inset-0 bg-primary shadow-sm rounded-lg"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-20 uppercase text-sm sm:text-base", activeTab === "school-year" ? "text-primary-foreground" : "text-foreground")}>School Year Management</span>
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
