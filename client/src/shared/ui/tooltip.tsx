import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/shared/lib/utils';
import { motionClassNames } from '@/shared/lib/motion';

const TooltipProvider = ({
	children,
	delayDuration = 140,
	skipDelayDuration = 80,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) => (
	<TooltipPrimitive.Provider
		delayDuration={delayDuration}
		skipDelayDuration={skipDelayDuration}
		{...props}
	>
		{children}
	</TooltipPrimitive.Provider>
);

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
	React.ComponentRef<typeof TooltipPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
	<TooltipPrimitive.Portal>
		<TooltipPrimitive.Content
			ref={ref}
			sideOffset={sideOffset}
			className={cn(
				'z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-sm text-[hsl(var(--background))]',
				motionClassNames.floatingContent,
				className,
			)}
			{...props}
		/>
	</TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
