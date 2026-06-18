import { Accessibility, Type, Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/shared/ui/tooltip';
import { useSettingsStore } from '@/store/settings.slice';

export function AccessibilityMenu() {
	const { fontSize, setFontSize } = useSettingsStore();

	const resetAll = () => {
		setFontSize(100);
	};

	return (
		<Popover>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<PopoverTrigger asChild>
							<Button
								variant='outline'
								size='sm'
								className='h-8 w-8 p-0 text-primary hover:bg-primary/10	hover:text-primary'
								aria-label='Accessibility options'
							>
								<Accessibility className='size-4' />
							</Button>
						</PopoverTrigger>
					</TooltipTrigger>
					<TooltipContent>Accessibility Options</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			<PopoverContent
				className='w-64 bg-white'
				align='end'
			>
				<div className='space-y-4'>
					<div className='flex items-center justify-between border-b pb-2'>
						<h4 className='font-bold text-base flex items-center gap-2'>
							<Accessibility className='size-4' /> Accessibility
						</h4>
						{fontSize !== 100 && (
							<Button
								variant='ghost'
								size='sm'
								className='h-7 px-2 text-base font-bold text-primary hover:text-primary hover:bg-primary/10'
								onClick={resetAll}
							>
								<RotateCcw className='mr-1 size-3' /> Reset
							</Button>
						)}
					</div>

					<div className='space-y-3'>
						<div className='space-y-2'>
							<div className='flex items-center justify-between'>
								<Label className='text-base font-bold flex items-center gap-2'>
									<Type className='size-3.5' /> Text Size
								</Label>
								<span className='text-base font-bold'>{fontSize}%</span>
							</div>
							<div className='flex items-center gap-2'>
								<Button
									variant='outline'
									size='xs'
									className='flex-1 bg-primary hover:bg-primary/90'
									onClick={() => setFontSize(Math.max(80, fontSize - 10))}
									disabled={fontSize <= 80}
									aria-label='Decrease text size'
								>
									<Minus className='size-4 font-black text-primary-foreground' />
								</Button>
								<Button
									variant='outline'
									size='xs'
									className='flex-1 bg-primary hover:bg-primary/90'
									onClick={() => setFontSize(Math.min(150, fontSize + 10))}
									disabled={fontSize >= 150}
									aria-label='Increase text size'
								>
									<Plus className='size-4 font-black text-primary-foreground' />
								</Button>
							</div>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
