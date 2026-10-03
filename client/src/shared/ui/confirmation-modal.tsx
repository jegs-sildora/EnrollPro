import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { motionClassNames } from "@/shared/lib/motion";
import { useSettingsStore } from "@/store/settings.slice";
import {
  AlertTriangle,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  LoaderCircle,
  X,
  type LucideIcon,
} from "lucide-react";

export type ConfirmationModalVariant =
  | "danger"
  | "info"
  | "warning"
  | "success"
  | "primary";

interface ConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  footerWarning?: React.ReactNode;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  confirmClassName?: string;
  confirmDisabled?: boolean;
  variant?: ConfirmationModalVariant;
  icon?: LucideIcon;
  loadingOnly?: boolean;
  loadingText?: string;
  hideIcon?: boolean;
  hideCancel?: boolean;
  showClose?: boolean;
  align?: "left" | "center";
  className?: string;
  onCancel?: () => void;
  preventOutsideClick?: boolean;
}

const variantStyles: Record<
  ConfirmationModalVariant,
  {
    icon: LucideIcon;
    iconBg: string;
    iconRing: string;
    iconText: string;
  }
> = {
  danger: {
    icon: AlertTriangle,
    iconBg: "bg-[hsl(var(--primary))]",
    iconRing: "ring-[6px] ring-[hsl(var(--primary)/0.1)]",
    iconText: "text-[hsl(var(--primary-foreground))]",
  },
  warning: {
    icon: AlertCircle,
    iconBg: "bg-[hsl(var(--primary))]",
    iconRing: "ring-[6px] ring-[hsl(var(--primary)/0.1)]",
    iconText: "text-[hsl(var(--primary-foreground))]",
  },
  info: {
    icon: Info,
    iconBg: "bg-[hsl(var(--primary))]",
    iconRing: "ring-[6px] ring-[hsl(var(--primary)/0.1)]",
    iconText: "text-[hsl(var(--primary-foreground))]",
  },
  success: {
    icon: CheckCircle2,
    iconBg: "bg-[hsl(var(--primary))]",
    iconRing: "ring-[6px] ring-[hsl(var(--primary)/0.1)]",
    iconText: "text-[hsl(var(--primary-foreground))]",
  },
  primary: {
    icon: HelpCircle,
    iconBg: "bg-[hsl(var(--primary))]",
    iconRing: "ring-[6px] ring-[hsl(var(--primary)/0.1)]",
    iconText: "text-[hsl(var(--primary-foreground))]",
  },
};

export function ConfirmationModal({
  open,
  onOpenChange,
  title,
  description,
  footerWarning,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
  confirmClassName,
  confirmDisabled = false,
  variant = "danger",
  icon: CustomIcon,
  loadingOnly = false,
  loadingText = "Processing...",
  hideIcon = false,
  hideCancel = false,
  showClose = false,
  align = "center",
  className,
  onCancel,
  preventOutsideClick = false,
}: ConfirmationModalProps) {
  const { colorScheme, selectedAccentHsl } = useSettingsStore();

  const accentHsl = selectedAccentHsl;
  const currentHex = colorScheme?.palette?.find(
    (p) => p.hsl === accentHsl,
  )?.hex;
  const currentPalette = colorScheme?.palette?.find((p) => p.hsl === accentHsl);
  const currentForeground =
    currentPalette?.foreground ?? colorScheme?.accent_foreground;
  const isFefe01 = currentHex?.toLowerCase() === "#fefe01";
  const isLightColor = currentForeground === "0 0% 0%";

  const applyOverride = isFefe01 || isLightColor;

  const style = variantStyles[variant];
  const Icon = CustomIcon || style.icon;

  const headerAlignClass = align === "left" ? "text-left items-start" : "text-center items-center";
  const titleAlignClass = align === "left" ? "text-left" : "text-center";
  const descAlignClass = align === "left" ? "text-left" : "text-center";
  const footerAlignClass = align === "left" ? "sm:justify-end" : "sm:justify-center";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={cn("fixed inset-0 z-[9999] bg-black/72 backdrop-blur-[1px]", motionClassNames.overlay)} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onInteractOutside={(e) => {
            if (preventOutsideClick) {
              e.preventDefault();
            }
          }}
          className={cn(
            "fixed left-[50%] top-[50%] z-[9999] grid w-full max-w-3xl h-fit max-h-[95vh] overflow-y-auto gap-4 rounded-lg border border-[hsl(var(--border))] bg-sidebar p-8 shadow-2xl",
            motionClassNames.dialogContent,
            className
          )}
          style={
            applyOverride
              ? ({
                "--primary": "200 68% 9%",
                "--primary-foreground": "0 0% 100%",
              } as React.CSSProperties)
              : {}
          }>
        {showClose && (
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full bg-[hsl(var(--primary))] p-1.5 text-[hsl(var(--primary-foreground))] shadow-sm transition-opacity hover:opacity-90 disabled:pointer-events-none data-[state=open]:bg-secondary">
            <X className="h-4 w-4" strokeWidth={3} />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
        {/* ── Icon badge ─────────────────────────────────────────────── */}
        {!hideIcon && (
          <div className="flex justify-center mb-5">
          <span
            className={cn(
              "flex items-center justify-center",
              "w-14 h-14 rounded-full",
              style.iconBg,
              style.iconRing,
              style.iconText,
            )}>
              <Icon
                className="w-6 h-6"
                strokeWidth={2.5}
              />
            </span>
          </div>
        )}

        {/* ── Header ───────────────────────────────────────── */}
        <DialogHeader className={cn("space-y-2", headerAlignClass)}>
          <DialogTitle className={cn("text-2xl font-extrabold uppercase", titleAlignClass)}>{title}</DialogTitle>
          <div className="space-y-4 w-full">
            <DialogDescription className={cn("leading-relaxed text-foreground w-full", descAlignClass)}>
              {description}
            </DialogDescription>
            {footerWarning && (
              <div className="font-bold text-primary mt-2 p-3 bg-primary/5 rounded-md border-2 border-primary">
                {footerWarning}
              </div>
            )}
          </div>
        </DialogHeader>

        {loadingOnly ? (
          <div className="mt-7 flex justify-center">
            <div className="flex w-full max-w-md items-center justify-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-5 py-4  font-bold text-primary">
              <LoaderCircle className="h-5 w-5 motion-safe:animate-spin" aria-hidden="true" />
              <span>{loadingText}</span>
            </div>
          </div>
        ) : (
          /* ── Footer ─────────────────────────────────────────────── */
          <DialogFooter className={cn("flex flex-row gap-3 mt-7", footerAlignClass)}>
            {/* Cancel */}
            {!hideCancel && (
              <Button
                variant="outline"
                onClick={() => onCancel ? onCancel() : onOpenChange(false)}
                disabled={loading}
                className={cn(
                  "h-12 rounded-lg font-bold uppercase",
                  !hideCancel ? "flex-1" : "",
                  "border border-gray-200 bg-muted text-gray-700",
                  "hover:bg-gray-50 active:bg-gray-100",
                  "transition-all duration-150 active:scale-[0.97]",
                )}>
                {cancelText}
              </Button>
            )}

            {/* Confirm / primary action */}
            <Button
              variant="default"
              onClick={() => {
                onConfirm();
                if (!loading) onOpenChange(false);
              }}
              disabled={loading || confirmDisabled}
              className={cn(
                "h-12 rounded-lg font-bold uppercase",
                !hideCancel ? "flex-1" : "px-10",
                "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
                "hover:bg-[hsl(var(--primary)/0.9)]",
                "shadow-md",
                "transition-all duration-150 active:scale-[0.97]",
                confirmClassName,
              )}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </span>
              ) : (
                confirmText
              )}
            </Button>
          </DialogFooter>
        )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
