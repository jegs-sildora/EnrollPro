import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settingsStore';

interface ConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmText?: string;
  loading?: boolean;
  confirmClassName?: string;
}

export function ConfirmationModal({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText = 'Confirm',
  loading = false,
  confirmClassName,
}: ConfirmationModalProps) {
  const { colorScheme, selectedAccentHsl } = useSettingsStore();

  const accentHsl = selectedAccentHsl ?? colorScheme?.accent_hsl;
  const currentHex = colorScheme?.palette?.find(p => p.hsl === accentHsl)?.hex;
  const isFefe01 = currentHex?.toLowerCase() === '#fefe01';

  // Check if color is "light" (uses black foreground)
  const accentForeground = colorScheme?.palette?.find(p => p.hsl === accentHsl)?.foreground 
    ?? colorScheme?.accent_foreground;
  const isLightColor = accentForeground === '0 0% 0%';

  const applyOverride = isFefe01 || isLightColor;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-[calc(100%-2rem)] sm:max-w-md p-6 sm:p-8 rounded-2xl overflow-hidden"
        style={applyOverride ? {
          '--primary': '200 68% 9%',
          '--primary-foreground': '0 0% 100%',
        } as React.CSSProperties : {}}
      >
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl font-bold tracking-tight">{title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed font-medium">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end mt-8">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-11 px-6 font-semibold sm:w-auto w-full rounded-xl hover:bg-primary/10 hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={() => {
              onConfirm();
              if (!loading) onOpenChange(false);
            }}
            disabled={loading}
            className={cn("h-11 px-6 font-bold sm:w-auto w-full rounded-xl hover:opacity-90", confirmClassName)}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Processing...
              </span>
            ) : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
