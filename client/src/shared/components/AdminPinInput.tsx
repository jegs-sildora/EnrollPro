import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";

interface AdminPinInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
  ariaLabel?: string;
}

const sanitizePin = (raw: string, length: number) =>
  raw.replace(/\D/g, "").slice(0, length);

export function AdminPinInput({
  value,
  onChange,
  length = 6,
  invalid = false,
  disabled = false,
  autoFocus = false,
  onBlur,
  ariaLabel = "Admin PIN",
}: AdminPinInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const normalizedValue = useMemo(
    () => sanitizePin(value, length),
    [value, length],
  );

  const digits = useMemo(
    () => Array.from({ length }, (_, index) => normalizedValue[index] ?? ""),
    [normalizedValue, length],
  );

  useEffect(() => {
    if (!autoFocus || disabled) {
      return;
    }
    inputRefs.current[0]?.focus();
  }, [autoFocus, disabled]);

  const setDigitAtIndex = (index: number, digit: string) => {
    const nextDigits = [...digits];
    nextDigits[index] = digit;
    onChange(sanitizePin(nextDigits.join(""), length));
  };

  const handlePaste = (
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    const pasted = sanitizePin(event.clipboardData.getData("text"), length);
    if (!pasted) {
      return;
    }

    event.preventDefault();

    const nextDigits = [...digits];
    let cursor = index;

    for (const char of pasted) {
      if (cursor >= length) {
        break;
      }
      nextDigits[cursor] = char;
      cursor += 1;
    }

    onChange(sanitizePin(nextDigits.join(""), length));
    inputRefs.current[Math.min(cursor, length - 1)]?.focus();
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <Input
          key={`admin-pin-${index}`}
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`${ariaLabel} digit ${index + 1}`}
          onBlur={onBlur}
          onPaste={(event) => handlePaste(index, event)}
          onChange={(event) => {
            const nextDigit = event.target.value.replace(/\D/g, "").slice(-1);
            if (!nextDigit && event.target.value !== "") {
              return;
            }

            setDigitAtIndex(index, nextDigit);

            if (nextDigit && index < length - 1) {
              inputRefs.current[index + 1]?.focus();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digits[index] && index > 0) {
              inputRefs.current[index - 1]?.focus();
              return;
            }

            if (event.key === "ArrowLeft" && index > 0) {
              event.preventDefault();
              inputRefs.current[index - 1]?.focus();
              return;
            }

            if (event.key === "ArrowRight" && index < length - 1) {
              event.preventDefault();
              inputRefs.current[index + 1]?.focus();
            }
          }}
          className={cn(
            "h-14 w-12 sm:h-16 sm:w-14 rounded-2xl border-2 bg-muted/30 px-0 text-center text-3xl sm:text-4xl font-black tabular-nums leading-none text-foreground shadow-sm transition-colors",
            "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/35",
            invalid
              ? "border-destructive text-destructive focus-visible:border-destructive focus-visible:ring-destructive/35"
              : "border-border",
          )}
        />
      ))}
    </div>
  );
}