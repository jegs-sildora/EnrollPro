import { useState } from 'react';
import depedLogo from '@/assets/deped-logo.png';
import GuestLayout from '@/layouts/GuestLayout';
import PrivacyNotice from './PrivacyNotice';
import AdmissionForm from './AdmissionForm';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settingsStore';

const CONSENT_KEY = 'enrollpro_apply_consent';
const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

export default function Apply() {
  const [hasConsented, setHasConsented] = useState(() => {
    return sessionStorage.getItem(CONSENT_KEY) === 'true';
  });
  const { schoolName, logoUrl } = useSettingsStore();

  const handleAccept = () => {
    sessionStorage.setItem(CONSENT_KEY, 'true');
    setHasConsented(true);
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
              <rect x="2" y="2" width="36" height="36" rx="2" fill="none" stroke="black" strokeWidth="1.5" />
              <rect x="42" y="2" width="36" height="36" rx="2" fill="none" stroke="black" strokeWidth="1.5" />
              <rect x="2" y="42" width="36" height="36" rx="2" fill="none" stroke="black" strokeWidth="1.5" />
              <rect x="42" y="42" width="36" height="36" rx="2" fill="none" stroke="black" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pixel-grid)" />
        </svg>
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at center, rgba(0,0,0,0.05) 0%, transparent 70%)' }}
        />
      </div>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-24 flex items-center justify-center gap-4">
          {logoUrl ? (
            <img
              src={`${API_BASE}${logoUrl}`}
              alt={`${schoolName} logo`}
              className="h-16 w-16 shrink-0 object-contain"
            />
          ) : (
            <div className="h-14 w-14 shrink-0 rounded-full bg-black/10 flex items-center justify-center">
              <span className="text-base font-bold text-foreground">{schoolName.charAt(0)}</span>
            </div>
          )}
          <div className="flex flex-col leading-tight text-center">
            <span className="text-base font-bold tracking-tight text-foreground">{schoolName}</span>
            <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Online Admission Portal</span>
          </div>
          <img src={depedLogo} alt="DepEd logo" className="h-16 w-16 shrink-0 object-contain" />
        </div>
      </header>
      <div className={cn("min-h-screen", hasConsented ? "py-12 px-4 sm:px-6 lg:px-8" : "")}>
        <AnimatePresence mode="wait">
          {!hasConsented ? (
            <motion.div
              key="privacy"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <PrivacyNotice onAccept={handleAccept} />
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <AdmissionForm />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GuestLayout>
  );
}
