import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

const Sheet = DialogPrimitive.Root;

const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Overlay>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Overlay
		ref={ref}
		className={cn(
			"fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
			className
		)}
		{...props}
	/>
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

const sheetVariants = cva(
	'fixed z-50 gap-4 bg-[hsl(var(--background))] p-6 shadow-lg transition ease-in-out',
	{
		variants: {
			side: {
				top: 'inset-x-0 top-0 border-b data-[state=open]:animate-sheet-in-top data-[state=closed]:animate-sheet-out-top',
				bottom: 'inset-x-0 bottom-0 border-t data-[state=open]:animate-sheet-in-bottom data-[state=closed]:animate-sheet-out-bottom',
				left: 'inset-y-0 left-0 h-full w-[50vw] border-r sm:max-w-[50vw] data-[state=open]:animate-sheet-in-left data-[state=closed]:animate-sheet-out-left',
				right: 'inset-y-0 right-0 h-full w-[50vw] border-l sm:max-w-[50vw] data-[state=open]:animate-sheet-in-right data-[state=closed]:animate-sheet-out-right',
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
>(({ side = 'right', className, children, showClose = true, ...props }, ref) => {
	return (
		<SheetPortal>
			<SheetOverlay />
			<DialogPrimitive.Content
				ref={ref}
				className={cn(sheetVariants({ side }), className, "outline-none flex flex-col")}
				{...props}
			>
				{children}
				{showClose ? (
					<DialogPrimitive.Close className='absolute right-6 top-5 rounded-sm opacity-90 ring-offset-[hsl(var(--background))] transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary-foreground))] focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-[hsl(var(--primary-foreground))] bg-primary-foreground text-primary'>
						<X className='h-5 w-5' />
						<span className='sr-only'>Close</span>
					</DialogPrimitive.Close>
				) : null}
			</DialogPrimitive.Content>
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
			'text-lg font-extrabold text-[hsl(var(--foreground))]',
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
	SheetTrigger,
	SheetClose,
	SheetContent,
	SheetHeader,
	SheetFooter,
	SheetTitle,
	SheetDescription,
};
