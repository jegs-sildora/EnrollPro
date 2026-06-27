import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

interface TimePickerProps {
  value?: string | null; // supports "HH:mm" (24h) and "hh:mm AM/PM"
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

const DEFAULT_TIME_VALUE = "08:00 AM";

export function TimePicker({
  value,
  onChange,
  className,
  disabled = false,
}: TimePickerProps) {
  // Internal state for 12h format
  const [hour, setHour] = React.useState("08");
  const [minute, setMinute] = React.useState("00");
  const [period, setPeriod] = React.useState<"AM" | "PM">("AM");

  // Sync internal state with external value
  React.useEffect(() => {
    const trimmed = value?.trim();
    if (!trimmed) {
      setHour("08");
      setMinute("00");
      setPeriod("AM");
      return;
    }

    const twelveHourMatch = trimmed.match(
      /^([0]?[1-9]|1[0-2]):([0-5][0-9])\s*([AaPp][Mm])$/,
    );
    if (twelveHourMatch) {
      setHour(twelveHourMatch[1].padStart(2, "0"));
      setMinute(twelveHourMatch[2]);
      setPeriod(twelveHourMatch[3].toUpperCase() as "AM" | "PM");
      return;
    }

    const twentyFourHourMatch = trimmed.match(
      /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/,
    );
    if (twentyFourHourMatch) {
      const hInt = parseInt(twentyFourHourMatch[1], 10);
      const p = hInt >= 12 ? "PM" : "AM";
      let h12 = hInt % 12;
      if (h12 === 0) h12 = 12;
      setHour(h12.toString().padStart(2, "0"));
      setMinute(twentyFourHourMatch[2]);
      setPeriod(p);
      return;
    }

    setHour("");
    setMinute("");
    setPeriod("AM");
  }, [value]);

  const updateValue = (h: string, m: string, p: "AM" | "PM") => {
    const hInt = parseInt(h, 10);
    const mInt = parseInt(m, 10);
    if (
      Number.isNaN(hInt) ||
      Number.isNaN(mInt) ||
      hInt < 1 ||
      hInt > 12 ||
      mInt < 0 ||
      mInt > 59
    ) {
      return;
    }

    onChange(
      `${hInt.toString().padStart(2, "0")}:${mInt.toString().padStart(2, "0")} ${p}`,
    );
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 2) val = val.slice(-2);

    if (val === "") {
      setHour("");
      return;
    }

    if (val === "0") {
      setHour("0");
      return;
    }

    const parsedHour = parseInt(val, 10);
    if (Number.isNaN(parsedHour)) {
      setHour("");
      return;
    }

    const clampedHour = Math.min(12, Math.max(1, parsedHour));
    const displayHour =
      val.length === 1
        ? clampedHour.toString()
        : clampedHour.toString().padStart(2, "0");
    setHour(displayHour);

    updateValue(clampedHour.toString().padStart(2, "0"), minute, period);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 2) val = val.slice(-2);

    if (val === "") {
      setMinute("");
      return;
    }

    const parsedMinute = parseInt(val, 10);
    if (Number.isNaN(parsedMinute)) {
      setMinute("");
      return;
    }

    const clampedMinute = Math.min(59, Math.max(0, parsedMinute));
    const displayMinute =
      val.length === 1
        ? clampedMinute.toString()
        : clampedMinute.toString().padStart(2, "0");
    setMinute(displayMinute);

    updateValue(hour, clampedMinute.toString().padStart(2, "0"), period);
  };

  const handleHourBlur = () => {
    if (!hour) {
      setHour("08");
      const normalizedMinute = minute ? minute.padStart(2, "0") : "00";
      setMinute(normalizedMinute);
      updateValue("08", normalizedMinute, period);
      return;
    }

    const parsedHour = parseInt(hour, 10);
    if (Number.isNaN(parsedHour)) {
      setHour("");
      return;
    }

    const clampedHour = Math.min(12, Math.max(1, parsedHour));
    const normalizedHour = clampedHour.toString().padStart(2, "0");
    setHour(normalizedHour);
    updateValue(normalizedHour, minute, period);
  };

  const handleMinuteBlur = () => {
    if (!minute) {
      setMinute("00");
      const normalizedHour = hour ? hour.padStart(2, "0") : "08";
      setHour(normalizedHour);
      updateValue(normalizedHour, "00", period);
      return;
    }

    const parsedMinute = parseInt(minute, 10);
    if (Number.isNaN(parsedMinute)) {
      setMinute("");
      return;
    }

    const clampedMinute = Math.min(59, Math.max(0, parsedMinute));
    const normalizedMinute = clampedMinute.toString().padStart(2, "0");
    setMinute(normalizedMinute);
    updateValue(hour, normalizedMinute, period);
  };

  const handlePeriodChange = (p: "AM" | "PM") => {
    setPeriod(p);
    updateValue(hour, minute, p);
  };

  React.useEffect(() => {
    const trimmed = value?.trim();
    if (!trimmed) {
      onChange(DEFAULT_TIME_VALUE);
    }
  }, [onChange, value]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex items-center rounded-md border border-input bg-background px-2 py-1 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          disabled && "cursor-not-allowed opacity-60",
        )}>
        <Clock className="mr-2 h-3 w-3" />
        <input
          className="w-6 border-none bg-transparent p-0 text-center text-sm font-extrabold focus:outline-none"
          value={hour}
          onChange={handleHourChange}
          onBlur={handleHourBlur}
          maxLength={2}
          placeholder="HH"
          disabled={disabled}
        />
        <span className=" mx-0.5">:</span>
        <input
          className="w-6 border-none bg-transparent p-0 text-center text-sm font-extrabold focus:outline-none"
          value={minute}
          onChange={handleMinuteChange}
          onBlur={handleMinuteBlur}
          maxLength={2}
          placeholder="MM"
          disabled={disabled}
        />
      </div>
      <Select
        value={period}
        disabled={disabled}
        onValueChange={(v: string) => handlePeriodChange(v as "AM" | "PM")}>
        <SelectTrigger className="h-8 w-[72px] text-sm font-extrabold px-2">
          <SelectValue placeholder="AM/PM" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM" className="text-sm font-extrabold">
            AM
          </SelectItem>
          <SelectItem value="PM" className="text-sm font-extrabold">
            PM
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
