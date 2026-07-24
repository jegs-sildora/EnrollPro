import { Toaster } from 'sileo';
import type { ReactNode } from 'react';
import { useSettingsStore } from '@/store/settings.slice';
import { AnimatePresence } from 'motion/react';
import { useLocation, Outlet } from 'react-router';
import { PageTransition } from '@/shared/components/PageTransition';

export default function LearnerAuthLayout({ children }: { children?: ReactNode }) {
  const { selectedAccentHsl, accentForeground } = useSettingsStore();
  const accentHsl = selectedAccentHsl;
  const toastTheme = accentForeground === '0 0% 100%' ? 'light' : 'dark';
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}${location.hash}:${location.key}`;

  return (
    <div className='min-h-screen font-sans'>
      <Toaster
        position='top-right'
        theme={toastTheme}
        options={accentHsl ? { fill: `hsl(${accentHsl})` } : undefined}
      />
      <AnimatePresence mode='wait'>
        <PageTransition key={routeKey}>
          {children || <Outlet />}
        </PageTransition>
      </AnimatePresence>
    </div>
  );
}
