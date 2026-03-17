import { useSearchParams } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SchoolProfileTab from './SchoolProfileTab';
import AcademicYearTab from './SchoolYearTab';
import CurriculumTab from './CurriculumTab';
import SectionsTab from './SectionsTab';
import EnrollmentGateTab from './EnrollmentGateTab';
import { motion, AnimatePresence } from 'motion/react';

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'profile';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">System Configuration</h1>
        <p className="text-sm text-muted-foreground font-medium">
          Manage school identity, school year, curriculum, and enrollment settings
        </p>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-6 p-1 bg-muted border-border">
          <TabsTrigger value="profile" className="flex-1 min-w-25 font-bold transition-all">School Profile</TabsTrigger>
          <TabsTrigger value="academic-year" className="flex-1 min-w-25 font-bold transition-all">School Year</TabsTrigger>
          <TabsTrigger value="curriculum" className="flex-1 min-w-25 font-bold transition-all">Curriculum</TabsTrigger>
          <TabsTrigger value="sections" className="flex-1 min-w-25 font-bold transition-all">Sections</TabsTrigger>
          <TabsTrigger value="enrollment" className="flex-1 min-w-25 font-bold transition-all">Enrollment Gate</TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            <TabsContent value="profile" className="mt-0 focus-visible:outline-none ring-0">
              <SchoolProfileTab />
            </TabsContent>
            <TabsContent value="academic-year" className="mt-0 focus-visible:outline-none ring-0">
              <AcademicYearTab />
            </TabsContent>
            <TabsContent value="curriculum" className="mt-0 focus-visible:outline-none ring-0">
              <CurriculumTab />
            </TabsContent>
            <TabsContent value="sections" className="mt-0 focus-visible:outline-none ring-0">
              <SectionsTab />
            </TabsContent>
            <TabsContent value="enrollment" className="mt-0 focus-visible:outline-none ring-0">
              <EnrollmentGateTab />
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </div>
  );
}
