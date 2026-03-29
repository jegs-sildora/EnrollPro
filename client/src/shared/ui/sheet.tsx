import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/shared/lib/utils';

const SheetContext = React.createContext<{ open: boolean }>({ open: false });

const Sheet = ({
	open,
	onOpenChange,
	children,
	...props
}: DialogPrimitive.DialogProps) => (
	<SheetContext.Provider value={{ open: !!open }}>
		<DialogPrimitive.Root
			open={open}
			onOpenChange={onOpenChange}
			{...props}
		>
			{children}
		</DialogPrimitive.Root>
	</SheetContext.Provider>
);

const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Overlay>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Overlay
		asChild
		ref={ref}
		{...props}
	>
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className={cn('fixed inset-0 z-50 bg-black/80', className)}
		/>
	</DialogPrimitive.Overlay>
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

const sheetVariants = cva(
	'fixed z-50 gap-4 bg-[hsl(var(--background))] p-6 shadow-lg',
	{
		variants: {
			side: {
				top: 'inset-x-0 top-0 border-b',
				bottom: 'inset-x-0 bottom-0 border-t',
				left: 'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
				right: 'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
			},
		},
		defaultVariants: {
			side: 'right',
		},
	},
);

interface SheetContentProps
	extends
		React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
		VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Content>,
	SheetContentProps
>(({ side = 'right', className, children, ...props }, ref) => {
	const { open } = React.useContext(SheetContext);
	const isRight = side === 'right';
	const isLeft = side === 'left';
	const isTop = side === 'top';
	const isBottom = side === 'bottom';

	return (
		<SheetPortal forceMount>
			<AnimatePresence>
				{open && (
					<React.Fragment key='sheet-presence'>
						<SheetOverlay />
						<DialogPrimitive.Content
							asChild
							forceMount
							ref={ref}
							{...props}
						>
							<motion.div
								initial={{
									x: isRight ? '100%' : isLeft ? '-100%' : 0,
									y: isTop ? '-100%' : isBottom ? '100%' : 0,
								}}
								animate={{ x: 0, y: 0 }}
								exit={{
									x: isRight ? '100%' : isLeft ? '-100%' : 0,
									y: isTop ? '-100%' : isBottom ? '100%' : 0,
								}}
								transition={{ type: 'spring', damping: 25, stiffness: 180 }}
								className={cn(sheetVariants({ side }), className)}
							>
								{children}
								<DialogPrimitive.Close className='absolute right-6 top-6 rounded-sm opacity-90 ring-offset-[hsl(var(--background))] transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary-foreground))] focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-[hsl(var(--primary-foreground))] bg-primary-foreground text-primary'>
									<X className='h-5 w-5' />
									<span className='sr-only'>Close</span>
								</DialogPrimitive.Close>
							</motion.div>
						</DialogPrimitive.Content>
					</React.Fragment>
				)}
			</AnimatePresence>
		</SheetPortal>
	);
});
SheetContent.displayName = DialogPrimitive.Content.displayName;

const SheetHeader = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			'flex flex-col space-y-2 text-center sm:text-left',
			className,
		)}
		{...props}
	/>
);
SheetHeader.displayName = 'SheetHeader';

const SheetFooter = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
			className,
		)}
		{...props}
	/>
);
SheetFooter.displayName = 'SheetFooter';

const SheetTitle = React.forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Title>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Title
		ref={ref}
		className={cn(
			'text-lg font-semibold text-[hsl(var(--foreground))]',
			className,
		)}
		{...props}
	/>
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Description>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Description
		ref={ref}
		className={cn('text-sm text-[hsl(var(--muted-foreground))]', className)}
		{...props}
	/>
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export {
	Sheet,
	SheetPortal,
	SheetOverlay,
	SheetTrigger,
	SheetClose,
	SheetContent,
	SheetHeader,
	SheetFooter,
	SheetTitle,
	SheetDescription,
};
