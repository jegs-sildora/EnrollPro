import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import { Clock } from "lucide-react";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";
import { useSettingsStore } from "@/store/settings.slice";
import { useAuthStore } from "@/store/auth.slice";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  getMockedSystemDate,
  MOCKED_SYSTEM_DATE_ANCHOR_KEY,
  MOCKED_SYSTEM_DATE_KEY,
} from "@/shared/lib/utils";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);
const SECOND_OPTIONS = MINUTE_OPTIONS;
const SYSTEM_DATE_SYNC_TIMEOUT_MS = 3_000;

interface MockDateTimeParts {
  date: string;
  time: string;
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

  return {
    date: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    time: `${getPart("hour").padStart(2, "0")}:${getPart("minute").padStart(2, "0")}:${getPart("second").padStart(2, "0")}`,
  };
}

export function TimeMachineWidget() {
  const { showTimeMachineWidget } = useSettingsStore();

  if (!showTimeMachineWidget) {
    return null;
  }

  return <TimeMachineWidgetCore />;
}

function TimeMachineWidgetCore() {
  const { showTimeMachineWidget } = useSettingsStore();
  const { user } = useAuthStore();
  const [initialMockDateTime] = useState(() => {
    const saved = localStorage.getItem(MOCKED_SYSTEM_DATE_KEY);
    const parts = saved ? getManilaDateTimeParts(saved) : null;
    return {
      parts: parts ?? {
        date: "",
        time: "12:00:00",
      },
      hasOverride: Boolean(parts),
    };
  });
  const [mockDate, setMockDate] = useState(initialMockDateTime.parts.date);
  const [mockTime, setMockTime] = useState(initialMockDateTime.parts.time);
  const [hasMockOverride, setHasMockOverride] = useState(
    initialMockDateTime.hasOverride,
  );
  useEffect(() => {
    const mockedDate = getMockedSystemDate();
    if (!mockedDate || !user) return;

    void api
      .put("/system/date-override", {
        mockedDate: mockedDate.toISOString(),
      }, {
        timeout: SYSTEM_DATE_SYNC_TIMEOUT_MS,
      })
      .catch(() => {
        // The request header continues to provide a scoped fallback if the
        // server is temporarily unavailable during local development.
      });
  }, [user, hasMockOverride]);

  const handleDateChange = (val: string) => {
    setMockDate(val);
  };

  const applyMockedDateTime = async () => {
    if (!mockDate) return;

    let isoDate = mockDate;
    if (mockDate.includes("/")) {
      const parts = mockDate.split("/");
      if (parts.length === 3) {
        isoDate = `${parts[2]}-${parts[0]}-${parts[1]}`;
      }
    }
    
    // Ensure time has seconds
    const timeParts = mockTime.split(":");
    const finalTime = timeParts.length === 2 ? `${mockTime}:00` : mockTime;
    
    const mockedTimestamp = `${isoDate}T${finalTime}+08:00`;

    localStorage.setItem(MOCKED_SYSTEM_DATE_KEY, mockedTimestamp);
    localStorage.setItem(MOCKED_SYSTEM_DATE_ANCHOR_KEY, String(Date.now()));
    setHasMockOverride(true);
    
    try {
      await api.put(
        "/system/date-override",
        {
          mockedDate: new Date(mockedTimestamp).toISOString(),
        },
        { timeout: SYSTEM_DATE_SYNC_TIMEOUT_MS },
      );
      window.location.reload();
    } catch (error: unknown) {
      sileo.warning({
        title: "Mock Time Applied Locally",
        description:
          error instanceof Error
            ? `Server synchronization failed: ${error.message}`
            : "Server synchronization failed.",
      });
    }
  };

  const resetToRealTime = async () => {
    try {
      await api.delete("/system/date-override", {
        timeout: SYSTEM_DATE_SYNC_TIMEOUT_MS,
      });
      setMockDate("");
      localStorage.removeItem(MOCKED_SYSTEM_DATE_KEY);
      localStorage.removeItem(MOCKED_SYSTEM_DATE_ANCHOR_KEY);
      setHasMockOverride(false);
      window.location.reload();
    } catch (error: unknown) {
      sileo.error({
        title: "Reset Failed",
        description:
          error instanceof Error
            ? error.message
            : "The real system clock could not be restored.",
      });
    }
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
                Override the running system date and time for testing term rollover and public admission periods.
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-foreground">Mocked Date</label>
              <HybridDatePicker
                value={mockDate}
                onChange={handleDateChange}
                placeholder="MM-DD-YYYY"
                className="w-full border rounded-md"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-foreground">Mocked Time</label>
              <input
                type="time"
                step="1"
                value={mockTime}
                onChange={(e) => setMockTime(e.target.value)}
                className="w-full flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
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


