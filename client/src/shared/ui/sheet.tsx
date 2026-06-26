import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { cn } from '@/shared/lib/utils';

const SheetContext = React.createContext<{ open: boolean }>({ open: false });
const sheetEase = [0.16, 1, 0.3, 1] as const;
const overlayEase = [0.22, 1, 0.36, 1] as const;
const sheetTransition = { type: 'tween', duration: 0.38, ease: sheetEase } as const;
const sheetReducedMotionTransition = { duration: 0.12, ease: 'linear' } as const;
const overlayTransition = { duration: 0.24, ease: overlayEase } as const;
const overlayReducedMotionTransition = { duration: 0.12, ease: 'linear' } as const;

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
>(({ className, ...props }, ref) => {
	const reduceMotion = useReducedMotion();

	return (
		<DialogPrimitive.Overlay
			asChild
			ref={ref}
			{...props}
		>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={reduceMotion ? overlayReducedMotionTransition : overlayTransition}
				className={cn('fixed inset-0 z-50 bg-black/80', className)}
			/>
		</DialogPrimitive.Overlay>
	);
});
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

const sheetVariants = cva(
	'fixed z-50 gap-4 bg-[hsl(var(--background))] p-6 shadow-lg',
	{
		variants: {
			side: {
				top: 'inset-x-0 top-0 border-b',
				bottom: 'inset-x-0 bottom-0 border-t',
				left: 'inset-y-0 left-0 h-full w-[50vw] border-r sm:max-w-[50vw]',
				right: 'inset-y-0 right-0 h-full w-[50vw] border-l sm:max-w-[50vw]',
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
		VariantProps<typeof sheetVariants> {
	showClose?: boolean;
}

const SheetContent = React.forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Content>,
	SheetContentProps
>(({ side = 'right', className, children, ...props }, ref) => {
	const { showClose = true, ...contentProps } = props;
	const { open } = React.useContext(SheetContext);
	const reduceMotion = useReducedMotion();
	const isRight = side === 'right';
	const isLeft = side === 'left';
	const isTop = side === 'top';
	const isBottom = side === 'bottom';
	const closedPosition = {
		x: reduceMotion ? 0 : isRight ? '100%' : isLeft ? '-100%' : 0,
		y: reduceMotion ? 0 : isTop ? '-100%' : isBottom ? '100%' : 0,
		opacity: reduceMotion ? 0 : 1,
	};

	return (
		<SheetPortal forceMount>
			<AnimatePresence mode="sync">
				{open && <SheetOverlay key="sheet-overlay" />}
				{open && (
					<DialogPrimitive.Content
						key="sheet-content"
						asChild
						forceMount
						ref={ref}
						{...contentProps}
					>
						<motion.div
							initial={closedPosition}
							animate={{ x: 0, y: 0, opacity: 1 }}
							exit={closedPosition}
							transition={reduceMotion ? sheetReducedMotionTransition : sheetTransition}
							className={cn(sheetVariants({ side }), className)}
						>
							{children}
							{showClose ? (
								<DialogPrimitive.Close className='absolute right-6 top-6 rounded-sm opacity-90 ring-offset-[hsl(var(--background))] transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary-foreground))] focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-[hsl(var(--primary-foreground))] bg-primary-foreground text-primary'>
									<X className='h-5 w-5' />
									<span className='sr-only'>Close</span>
								</DialogPrimitive.Close>
							) : null}
						</motion.div>
					</DialogPrimitive.Content>
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
			'text-lg font-bold text-[hsl(var(--foreground))]',
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
