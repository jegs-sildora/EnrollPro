import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { motionClassNames } from '@/shared/lib/motion';

const Checkbox = React.forwardRef<
	React.ComponentRef<typeof CheckboxPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
	<div
		className='inline-flex'
		onClick={(e) => {
			e.stopPropagation();
		}}
	>
		<CheckboxPrimitive.Root
			ref={ref}
			className={cn(
				'peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
				motionClassNames.controlSurface,
				className,
			)}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				className={cn(
					'flex h-full w-full items-center justify-center text-current pointer-events-none data-[state=checked]:scale-100 data-[state=unchecked]:scale-75 data-[state=unchecked]:opacity-0',
					motionClassNames.controlIndicator,
				)}
			>
				<Check className='h-3 w-3 pointer-events-none' strokeWidth={4} />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	</div>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
