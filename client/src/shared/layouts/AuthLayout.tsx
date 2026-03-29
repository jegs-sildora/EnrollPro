import { Toaster } from 'sileo';
import type { ReactNode } from 'react';
import { useSettingsStore } from '@/store/settings.slice';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router';

export default function AuthLayout({ children }: { children: ReactNode }) {
	const { selectedAccentHsl, colorScheme, accentForeground } =
		useSettingsStore();
	const accentHsl =
		selectedAccentHsl ??
		(colorScheme as { accent_hsl?: string } | null)?.accent_hsl;
	const toastTheme = accentForeground === '0 0% 100%' ? 'light' : 'dark';
	const location = useLocation();

	return (
		<div className='min-h-screen font-sans'>
			<Toaster
				position='top-right'
				theme={toastTheme}
				options={accentHsl ? { fill: `hsl(${accentHsl})` } : undefined}
			/>
			<AnimatePresence mode='wait'>
				<motion.div
					key={location.pathname}
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -10 }}
					transition={{ duration: 0.2 }}
				>
					{children}
				</motion.div>
			</AnimatePresence>
		</div>
	);
}
