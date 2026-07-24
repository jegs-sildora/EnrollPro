import { Toaster } from 'sileo';
import type { ReactNode } from 'react';
import { useSettingsStore } from '@/store/settings.slice';

export default function GuestLayout({ children }: { children: ReactNode }) {
	const { selectedAccentHsl, accentForeground } = useSettingsStore();
	const accentHsl = selectedAccentHsl;
	const toastTheme = accentForeground === '0 0% 100%' ? 'light' : 'dark';

	return (
		<div className='min-h-screen font-sans'>
			<Toaster
				position='top-right'
				theme={toastTheme}
				options={accentHsl ? { fill: `hsl(${accentHsl})` } : undefined}
			/>
			{children}
		</div>
	);
}
