import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";
import {
  AlertTriangle,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
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
  onConfirm: () => void;
  confirmText?: string;
  loading?: boolean;
  confirmClassName?: string;
  variant?: ConfirmationModalVariant;
  icon?: LucideIcon;
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
  onConfirm,
  confirmText = "Confirm",
  loading = false,
  confirmClassName,
  variant = "danger",
  icon: CustomIcon,
}: ConfirmationModalProps) {
  const { colorScheme, selectedAccentHsl } = useSettingsStore();

  const accentHsl = selectedAccentHsl ?? colorScheme?.accent_hsl;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-[calc(100%-2rem)] sm:max-w-sm rounded-lg p-8 overflow-hidden",
          "bg-sidebar shadow-2xl",
        )}
        style={
          applyOverride
            ? ({
                "--primary": "200 68% 9%",
                "--primary-foreground": "0 0% 100%",
              } as React.CSSProperties)
            : {}
        }>
        {/* ── Icon badge ─────────────────────────────────────────────── */}
        <div className="flex justify-center mb-5">
          <span
            className={cn(
              "flex items-center justify-center",
              "w-14 h-14 rounded-full",
              style.iconBg,
              style.iconRing,
              style.iconText,
            )}>
            <Icon className="w-6 h-6" strokeWidth={2.5} />
          </span>
        </div>

        {/* ── Header — centred ───────────────────────────────────────── */}
        <DialogHeader className="space-y-2 text-center items-center">
          <DialogTitle className="text-xl font-bold tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* ── Footer — side-by-side, confirm on the left ─────────────── */}
        <DialogFooter className="flex flex-row gap-3 mt-7 sm:justify-center">
          {/* Cancel */}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className={cn(
              "flex-1 h-12 rounded-lg font-bold text-sm",
              "border border-gray-200 bg-white text-gray-700",
              "hover:bg-gray-50 active:bg-gray-100",
              "transition-all duration-150 active:scale-[0.97]",
            )}>
            Cancel
          </Button>

          {/* Confirm / primary action */}
          <Button
            variant="default"
            onClick={() => {
              onConfirm();
              if (!loading) onOpenChange(false);
            }}
            disabled={loading}
            className={cn(
              "flex-1 h-12 rounded-lg font-bold text-sm",
              "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
              "hover:bg-[hsl(var(--primary)/0.9)]",
              "shadow-md",
              "transition-all duration-150 active:scale-[0.97]",
              confirmClassName,
            )}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Processing...
              </span>
            ) : (
              confirmText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
