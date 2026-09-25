import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import { Clock } from "lucide-react";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";
import { useSettingsStore } from "@/store/settings.slice";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  MOCKED_SYSTEM_DATE_ANCHOR_KEY,
  MOCKED_SYSTEM_DATE_KEY,
} from "@/shared/lib/utils";
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);
const SECOND_OPTIONS = MINUTE_OPTIONS;

interface MockDateTimeParts {
  date: string;
  hour: string;
  minute: string;
  second: string;
  period: "AM" | "PM";
}

function getManilaDateTimeParts(value: string): MockDateTimeParts | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hour24 = Number(getPart("hour"));

  return {
    date: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    hour: String(hour24 % 12 || 12),
    minute: getPart("minute"),
    second: getPart("second"),
    period: hour24 >= 12 ? "PM" : "AM",
  };
}

export function TimeMachineWidget() {
  const { showTimeMachineWidget } = useSettingsStore();
  const [initialMockDateTime] = useState(() => {
    const saved = localStorage.getItem(MOCKED_SYSTEM_DATE_KEY);
    const parts = saved ? getManilaDateTimeParts(saved) : null;
    return {
      parts: parts ?? {
        date: "",
        hour: "12",
        minute: "00",
        second: "00",
        period: "AM" as const,
      },
      hasOverride: Boolean(parts),
    };
  });
  const [mockDate, setMockDate] = useState(initialMockDateTime.parts.date);
  const [mockHour, setMockHour] = useState(initialMockDateTime.parts.hour);
  const [mockMinute, setMockMinute] = useState(initialMockDateTime.parts.minute);
  const [mockSecond, setMockSecond] = useState(initialMockDateTime.parts.second);
  const [mockPeriod, setMockPeriod] = useState<"AM" | "PM">(
    initialMockDateTime.parts.period,
  );
  const [hasMockOverride, setHasMockOverride] = useState(
    initialMockDateTime.hasOverride,
  );

  const handleDateChange = (val: string) => {
    setMockDate(val);
  };

  const applyMockedDateTime = () => {
    if (!mockDate) return;

    const hour12 = Number(mockHour);
    const hour24 =
      mockPeriod === "AM"
        ? hour12 % 12
        : (hour12 % 12) + 12;
    const mockedTimestamp = `${mockDate}T${String(hour24).padStart(2, "0")}:${mockMinute}:${mockSecond}+08:00`;

    localStorage.setItem(MOCKED_SYSTEM_DATE_KEY, mockedTimestamp);
    localStorage.setItem(MOCKED_SYSTEM_DATE_ANCHOR_KEY, String(Date.now()));
    setHasMockOverride(true);
    window.location.reload();
  };

  const resetToRealTime = () => {
    setMockDate("");
    localStorage.removeItem(MOCKED_SYSTEM_DATE_KEY);
    localStorage.removeItem(MOCKED_SYSTEM_DATE_ANCHOR_KEY);
    setHasMockOverride(false);
    window.location.reload();
  };

  if (!showTimeMachineWidget) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-[9999]">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            className="h-12 w-12 rounded-full shadow-lg bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center p-0"
            title="Time Machine (Dev Only)"
          >
            <Clock className="h-6 w-6" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 max-w-[calc(100vw-2rem)] p-4 bg-background shadow-xl rounded-xl border-orange-500/50" side="top" align="start">
          <div className="space-y-4">
            <div>
              <h4 className="font-extrabold text-orange-500 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time Machine
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Override the system date and time for testing term rollover. This only affects your local browser session.
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-foreground">Mocked Date</label>
              <HybridDatePicker
                value={mockDate}
                onChange={handleDateChange}
                placeholder="YYYY-MM-DD"
                className="w-full border rounded-md"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-foreground">Mocked Time</label>
              <div className="grid grid-cols-[1fr_1fr_1fr_1.15fr] gap-2">
                <Select value={mockHour} onValueChange={setMockHour}>
                  <SelectTrigger aria-label="Mocked hour" className="w-full">
                    <SelectValue placeholder="Hour" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUR_OPTIONS.map((hour) => (
                      <SelectItem key={hour} value={hour}>
                        {hour}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={mockMinute} onValueChange={setMockMinute}>
                  <SelectTrigger aria-label="Mocked minute" className="w-full">
                    <SelectValue placeholder="Minute" />
                  </SelectTrigger>
                  <SelectContent>
                    {MINUTE_OPTIONS.map((minute) => (
                      <SelectItem key={minute} value={minute}>
                        {minute}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={mockSecond} onValueChange={setMockSecond}>
                  <SelectTrigger aria-label="Mocked second" className="w-full">
                    <SelectValue placeholder="Second" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECOND_OPTIONS.map((second) => (
                      <SelectItem key={second} value={second}>
                        {second}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={mockPeriod}
                  onValueChange={(value) => {
                    if (value === "AM" || value === "PM") {
                      setMockPeriod(value);
                    }
                  }}
                >
                  <SelectTrigger aria-label="Mocked period" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground">
                12-hour format (hour : minute : second : AM/PM)
              </p>
            </div>

            <Button
              className="w-full bg-orange-500 font-bold text-white hover:bg-orange-600"
              onClick={applyMockedDateTime}
              disabled={!mockDate}
            >
              Apply Mocked Date &amp; Time
            </Button>

            <Button
              variant="outline"
              className="w-full font-bold"
              onClick={resetToRealTime}
              disabled={!hasMockOverride}
            >
              Reset to Real Time
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
