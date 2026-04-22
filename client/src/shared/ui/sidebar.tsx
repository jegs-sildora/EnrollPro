import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { PanelLeft } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/shared/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { SidebarContext, useSidebar } from '@/shared/ui/use-sidebar';

const SIDEBAR_COOKIE_NAME = 'sidebar:state';
const SIDEBAR_WIDTH = '16rem';
const SIDEBAR_WIDTH_ICON = '3rem';
const SIDEBAR_KEYBOARD_SHORTCUT = 'b';

const SidebarProvider = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'> & {
		defaultOpen?: boolean;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	}
>(
	(
		{
			defaultOpen = true,
			open: openProp,
			onOpenChange: setOpenProp,
			className,
			style,
			children,
			...props
		},
		ref,
	) => {
		const [_open, _setOpen] = React.useState(defaultOpen);
		const open = openProp ?? _open;
		const setOpen = React.useCallback(
			(value: boolean | ((value: boolean) => boolean)) => {
				const openState = typeof value === 'function' ? value(open) : value;
				if (setOpenProp) {
					setOpenProp(openState);
				} else {
					_setOpen(openState);
				}
				document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${60 * 60 * 24 * 7}`;
			},
			[setOpenProp, open],
		);

		const toggleSidebar = React.useCallback(() => {
			setOpen((o) => !o);
		}, [setOpen]);

		React.useEffect(() => {
			const handleKeyDown = (event: KeyboardEvent) => {
				if (
					event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
					(event.metaKey || event.ctrlKey)
				) {
					event.preventDefault();
					toggleSidebar();
				}
			};
			window.addEventListener('keydown', handleKeyDown);
			return () => window.removeEventListener('keydown', handleKeyDown);
		}, [toggleSidebar]);

		const state = open ? 'expanded' : 'collapsed';

		const contextValue = React.useMemo<SidebarContext>(
			() => ({ state, open, setOpen, toggleSidebar }),
			[state, open, setOpen, toggleSidebar],
		);

		return (
			<SidebarContext.Provider value={contextValue}>
				<TooltipProvider delayDuration={0}>
					<div
						style={
							{
								'--sidebar-width': SIDEBAR_WIDTH,
								'--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
								...style,
							} as React.CSSProperties
						}
						className={cn(
							'group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar',
							className,
						)}
						ref={ref}
						{...props}
					>
						{children}
					</div>
				</TooltipProvider>
			</SidebarContext.Provider>
		);
	},
);
SidebarProvider.displayName = 'SidebarProvider';

const Sidebar = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'> & {
		side?: 'left' | 'right';
		variant?: 'sidebar' | 'floating' | 'inset';
		collapsible?: 'offcanvas' | 'icon' | 'none';
	}
>(
	(
		{
			side = 'left',
			variant = 'sidebar',
			collapsible = 'offcanvas',
			className,
			children,
			...props
		},
		ref,
	) => {
		const { state } = useSidebar();

		if (collapsible === 'none') {
			return (
				<div
					className={cn(
						'flex h-full flex-col bg-sidebar text-sidebar-foreground',
						className,
					)}
					style={{ width: 'var(--sidebar-width)' }}
					ref={ref}
					{...props}
				>
					{children}
				</div>
			);
		}

		return (
			<div
				ref={ref}
				className='group peer text-sidebar-foreground'
				data-state={state}
				data-collapsible={state === 'collapsed' ? collapsible : ''}
				data-variant={variant}
				data-side={side}
			>
				{/* Spacer – reserves horizontal space so SidebarInset is pushed over */}
				<div
					className={cn(
						'relative shrink-0 bg-transparent transition-[width] duration-200 ease-linear h-svh',
						'group-data-[collapsible=offcanvas]:w-0',
					)}
					style={{
						width:
							state === 'collapsed' && collapsible === 'icon'
								? 'var(--sidebar-width-icon)'
								: 'var(--sidebar-width)',
					}}
				/>
				{/* Fixed sidebar panel */}
				<div
					className={cn(
						'fixed inset-y-0 z-10 flex h-svh transition-[left,right,width] duration-200 ease-linear',
						side === 'left'
							? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
							: 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
						variant === 'floating' || variant === 'inset'
							? 'p-2'
							: 'group-data-[side=left]:border-r group-data-[side=right]:border-l border-sidebar-border',
						className,
					)}
					style={{
						width:
							state === 'collapsed' && collapsible === 'icon'
								? variant === 'floating' || variant === 'inset'
									? 'calc(var(--sidebar-width-icon) + 1rem + 2px)'
									: 'var(--sidebar-width-icon)'
								: 'var(--sidebar-width)',
					}}
					{...props}
				>
					<div
						data-sidebar='sidebar'
						className={cn(
							'flex h-full w-full flex-col bg-sidebar overflow-hidden',
							variant === 'floating' || variant === 'inset'
								? 'rounded-lg border border-sidebar-border shadow-sm'
								: '',
						)}
					>
						{children}
					</div>
				</div>
			</div>
		);
	},
);
Sidebar.displayName = 'Sidebar';

const SidebarTrigger = React.forwardRef<
	React.ComponentRef<typeof Button>,
	React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
	const { toggleSidebar } = useSidebar();

	return (
		<Button
			ref={ref}
			data-sidebar='trigger'
			variant='ghost'
			size='icon'
			className={cn('h-7 w-7', className)}
			onClick={(event) => {
				onClick?.(event);
				toggleSidebar();
			}}
			{...props}
		>
			<PanelLeft />
			<span className='sr-only'>Toggle Sidebar</span>
		</Button>
	);
});
SidebarTrigger.displayName = 'SidebarTrigger';

const SidebarHeader = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		data-sidebar='header'
		className={cn('flex flex-col gap-2 p-2', className)}
		{...props}
	/>
));
SidebarHeader.displayName = 'SidebarHeader';

const SidebarFooter = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		data-sidebar='footer'
		className={cn('flex flex-col gap-2 p-2', className)}
		{...props}
	/>
));
SidebarFooter.displayName = 'SidebarFooter';

const SidebarContent = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		data-sidebar='content'
		className={cn(
			'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden group-data-[collapsible=icon]:overflow-hidden',
			className,
		)}
		{...props}
	/>
));
SidebarContent.displayName = 'SidebarContent';

const SidebarGroup = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		data-sidebar='group'
		className={cn('relative flex w-full min-w-0 flex-col p-2', className)}
		{...props}
	/>
));
SidebarGroup.displayName = 'SidebarGroup';

const SidebarGroupLabel = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
	const Comp = asChild ? Slot : 'div';
	return (
		<Comp
			ref={ref}
			data-sidebar='group-label'
			className={cn(
				'flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
				'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
				className,
			)}
			{...props}
		/>
	);
});
SidebarGroupLabel.displayName = 'SidebarGroupLabel';

const SidebarGroupContent = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		data-sidebar='group-content'
		className={cn('w-full text-sm', className)}
		{...props}
	/>
));
SidebarGroupContent.displayName = 'SidebarGroupContent';

const SidebarMenu = React.forwardRef<
	HTMLUListElement,
	React.ComponentProps<'ul'>
>(({ className, ...props }, ref) => (
	<ul
		ref={ref}
		data-sidebar='menu'
		className={cn('flex w-full min-w-0 flex-col gap-1', className)}
		{...props}
	/>
));
SidebarMenu.displayName = 'SidebarMenu';

const SidebarMenuItem = React.forwardRef<
	HTMLLIElement,
	React.ComponentProps<'li'>
>(({ className, ...props }, ref) => (
	<li
		ref={ref}
		data-sidebar='menu-item'
		className={cn('group/menu-item relative', className)}
		{...props}
	/>
));
SidebarMenuItem.displayName = 'SidebarMenuItem';

const sidebarMenuButtonVariants = cva(
	'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-all duration-200 ease-linear hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-accent data-[active=true]:font-bold data-[active=true]:text-accent-foreground data-[active=true]:hover:text-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
	{
		variants: {
			variant: {
				default: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
				outline:
					'bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]',
			},
			size: {
				default: 'h-8 text-sm',
				sm: 'h-7 text-xs',
				lg: 'h-12 text-sm group-data-[collapsible=icon]:p-0!',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);

const SidebarMenuButton = React.forwardRef<
	HTMLButtonElement,
	React.ComponentProps<'button'> & {
		asChild?: boolean;
		isActive?: boolean;
		tooltip?: string | React.ComponentProps<typeof TooltipContent>;
	} & VariantProps<typeof sidebarMenuButtonVariants>
>(
	(
		{
			asChild = false,
			isActive = false,
			variant = 'default',
			size = 'default',
			tooltip,
			className,
			...props
		},
		ref,
	) => {
		const Comp = asChild ? Slot : 'button';
		const { state } = useSidebar();

		const button = (
			<Comp
				ref={ref}
				data-sidebar='menu-button'
				data-size={size}
				data-active={isActive}
				className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
				{...props}
			/>
		);

		if (!tooltip) return button;

		if (typeof tooltip === 'string') {
			tooltip = { children: tooltip };
		}

		return (
			<Tooltip>
				<TooltipTrigger asChild>{button}</TooltipTrigger>
				<TooltipContent
					side='right'
					align='center'
					hidden={state !== 'collapsed'}
					{...tooltip}
				/>
			</Tooltip>
		);
	},
);
SidebarMenuButton.displayName = 'SidebarMenuButton';

const SidebarSeparator = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		data-sidebar='separator'
		className={cn('mx-2 h-px bg-sidebar-border', className)}
		{...props}
	/>
));
SidebarSeparator.displayName = 'SidebarSeparator';

const SidebarInset = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'main'>
>(({ className, ...props }, ref) => (
	<main
		ref={ref}
		className={cn(
			'relative flex min-h-svh flex-1 flex-col bg-background min-w-0',
			className,
		)}
		{...props}
	/>
));
SidebarInset.displayName = 'SidebarInset';

export {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarSeparator,
	SidebarTrigger,
};
