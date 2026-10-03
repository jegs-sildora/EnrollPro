import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { motionClassNames } from "@/shared/lib/motion";
import { AnimatePresence, motion } from "motion/react";

const DialogContext = React.createContext<{
  open: boolean;
}>({
  open: false,
});

const Dialog = ({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  defaultOpen,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen);
      }
      setControlledOpen?.(newOpen);
    },
    [isControlled, setControlledOpen]
  );

  return (
    <DialogContext.Provider value={{ open }}>
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props}>
        {children}
      </DialogPrimitive.Root>
    </DialogContext.Provider>
  );
};

const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

/**
 * Defers animation start until after the browser has completed one full
 * paint cycle. This prevents the Framer Motion JS animation loop from
 * competing with React's mount/hydration and Radix's focus-trap setup,
 * which is the root cause of entry-only frame drops.
 */
function useDeferredMount() {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    // Double rAF: first rAF schedules after the current paint,
    // second rAF fires after the browser has actually painted.
    let inner: number;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        setReady(true);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  return ready;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MotionDialogOverlay = motion.create(DialogPrimitive.Overlay as any) as any;

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  const ready = useDeferredMount();

  return (
    <MotionDialogOverlay
      forceMount
      ref={ref}
      initial={{ opacity: 0 }}
      animate={ready ? { opacity: 1 } : { opacity: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
      style={{ willChange: "opacity" }}
      className={cn(
        "fixed inset-0 z-50 bg-black/80",
        className,
      )}
      {...props}
    />
  );
});
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  showClose?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MotionDialogContent = motion.create(DialogPrimitive.Content as any) as any;

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, showClose = true, ...props }, ref) => {
  const { open } = React.useContext(DialogContext);
  const ready = useDeferredMount();

  return (
    <AnimatePresence>
      {open && (
        <DialogPortal forceMount>
          <DialogOverlay />
          <MotionDialogContent
            forceMount
            ref={ref}
            aria-describedby={props["aria-describedby"] ?? undefined}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={ready ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            style={{ willChange: "transform, opacity" }}
            className={cn(
              "fixed inset-0 m-auto z-50 grid w-full max-w-3xl h-fit max-h-[95vh] overflow-y-auto gap-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-6 shadow-lg",
              className,
            )}
            {...props}
          >
            <DialogPrimitive.Title className="sr-only">Dialog</DialogPrimitive.Title>
            {children}
            {showClose ? (
              <DialogPrimitive.Close className={cn(
                "absolute right-4 top-3 rounded-full p-2 text-primary-foreground bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 disabled:pointer-events-none",
                motionClassNames.closeButton,
              )}>
                <X strokeWidth={3} className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            ) : null}
          </MotionDialogContent>
        </DialogPortal>
      )}
    </AnimatePresence>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

// DeferredDialogPanel was removed since we inline the motion component in DialogContent

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-bold leading-none ", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-[hsl(var(--foreground))]z", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
