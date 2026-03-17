import { useState } from 'react';
import depedLogo from '@/assets/deped-logo.png';
import GuestLayout from '@/layouts/GuestLayout';
import PrivacyNotice from './PrivacyNotice';
import AdmissionForm from './AdmissionForm';
import TrackApplication from './Track';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settingsStore';

const CONSENT_KEY = 'enrollpro_apply_consent';
const TAB_KEY = 'enrollpro_apply_active_tab';
const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

export default function Apply() {
  const [hasConsented, setHasConsented] = useState(() => {
    return sessionStorage.getItem(CONSENT_KEY) === 'true';
  });
  const [activeTab, setActiveTab] = useState<'form' | 'monitor'>(() => {
    return (sessionStorage.getItem(TAB_KEY) as 'form' | 'monitor') || 'form';
  });

  const { schoolName, logoUrl } = useSettingsStore();

  const handleAccept = () => {
    sessionStorage.setItem(CONSENT_KEY, 'true');
    setHasConsented(true);
  };

  const handleReset = () => {
    sessionStorage.removeItem(CONSENT_KEY);
    setHasConsented(false);
  };

  const handleTabChange = (tab: 'form' | 'monitor') => {
    sessionStorage.setItem(TAB_KEY, tab);
    setActiveTab(tab);
  };

  return (
    <GuestLayout>
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: 'hsl(var(--sidebar-background)/0.5)',
        }}
      >
        {/* Pixel grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.08]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="pixel-grid" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <rect x="2" y="2" width="36" height="36" rx="2" fill="none" stroke="#061E29" strokeWidth="1.5" />
              <rect x="42" y="2" width="36" height="36" rx="2" fill="none" stroke="#061E29" strokeWidth="1.5" />
              <rect x="2" y="42" width="36" height="36" rx="2" fill="none" stroke="#061E29" strokeWidth="1.5" />
              <rect x="42" y="42" width="36" height="36" rx="2" fill="none" stroke="#061E29" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pixel-grid)" />
        </svg>
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at center, rgba(6,30,41,0.05) 0%, transparent 70%)' }}
        />
      </div>

      <header className="sticky top-0 z-50 w-full border-b border-border bg-card shadow-sm">
        <div className="max-w-360 mx-auto px-4 sm:px-12 h-20 sm:h-28 flex items-center justify-center">
          {/* ── Branding Group (Always Centered) ── */}
          <div className="flex items-center gap-4 sm:gap-10 justify-center">
            {logoUrl ? (
              <img
                src={`${API_BASE}${logoUrl}`}
                alt={`${schoolName} logo`}
                className="h-10 w-10 sm:h-20 sm:w-20 shrink-0 object-contain"
              />
            ) : (
              <div className="h-10 w-10 sm:h-16 sm:w-16 shrink-0 rounded-full bg-[#061E29]/10 flex items-center justify-center">
                <span className="text-sm sm:text-2xl font-bold text-foreground">{schoolName.charAt(0)}</span>
              </div>
            )}
            
            <div className="flex flex-col leading-tight text-center sm:text-left min-0 max-w-87.5 sm:max-w-175">
              <span className="text-sm sm:text-xl font-black tracking-tight text-foreground line-clamp-2 leading-none text-center uppercase">{schoolName}</span>
              <span className="text-[8px] sm:text-[11px] font-black tracking-[0.3em] uppercase text-muted-foreground mt-1 text-center">Online Admission Portal</span>
            </div>

            <img src={depedLogo} alt="DepEd logo" className="h-10 w-10 sm:h-20 sm:w-20 shrink-0 object-contain ml-2" />
          </div>
        </div>
      </header>

      <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-10">
          
          {/* ── Tab Switcher (Placed at the top of the content area) ── */}
          <div className="flex justify-center">
            <div className="flex bg-white/80 p-1.5 rounded-2xl border-3 border-[#061E29]/80 w-full sm:w-auto shadow-inner">
              <button 
                onClick={() => handleTabChange('form')}
                className={cn(
                  "flex-1 sm:flex-none px-8 py-3 text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] rounded-xl transition-all duration-200",
                  activeTab === 'form' 
                    ? "bg-[#061E29] text-white shadow-lg scale-[1.02]" 
                    : "text-muted-foreground hover:text-[#061E29] hover:bg-[#061E29]/5"
                )}
              >
                Application Form
              </button>
              <button 
                onClick={() => handleTabChange('monitor')}
                className={cn(
                  "flex-1 sm:flex-none px-8 py-3 text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] rounded-xl transition-all duration-200",
                  activeTab === 'monitor' 
                    ? "bg-[#061E29] text-white shadow-lg scale-[1.02]" 
                    : "text-muted-foreground hover:text-[#061E29] hover:bg-[#061E29]/5"
                )}
              >
                Monitor Portal
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'monitor' ? (
               <motion.div
                 key="monitor"
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.98 }}
                 transition={{ duration: 0.3 }}
               >
                 <TrackApplication />
               </motion.div>
            ) : !hasConsented ? (
              <motion.div
                key="privacy"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
              >
                <PrivacyNotice onAccept={handleAccept} />
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, scale: 1.02, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <AdmissionForm onReset={handleReset} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </GuestLayout>
  );
}
